import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.staticfiles import StaticFiles

from app.api.v1 import api_v1_router
from app.sample_api.router import router as sample_api_router
from app.auth.deps import PermissionDeniedError
from app.auth.middleware import AuthMiddleware
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.nfr.runtime_guard import assert_runtime_compliant
from app.core.template_assets import resolve_template_assets_dir, template_assets_mount_path
from app.core.middleware import TraceIdMiddleware
from app.core.middleware.https_audit_guard import HttpsAuditGuardMiddleware
from app.reports.scheduler.jobs import get_report_scheduler, refresh_schedule_jobs
from app.reports.standard.jobs import refresh_standard_snapshot_jobs
from app.openapi.extensions import customize_openapi

settings = get_settings()
configure_logging(settings)
logger = logging.getLogger(__name__)


def _warm_meta_database() -> None:
    """预热元数据库连接池；开发环境顺带修复 admin 孤儿绑定与样例源凭证。"""
    from app.auth.bootstrap_root import ensure_admin_username_root_binding
    from app.auth.models import get_meta_session
    from app.dashboard.templates.official_demo_bootstrap import ensure_sample_db_schema
    from app.dashboard.templates.demo_datasource import ensure_official_demo_datasource
    from app.ingestion.analytics_datasource import ensure_analytics_datasource
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates
    from app.dashboard.demo_instances.seed import seed_demo_instances
    from app.dashboard.workspace_instances.seed import seed_workspace_instances
    from app.datasources.dev_credential_repair import repair_dev_datasource_credentials

    session = get_meta_session()
    try:
        session.execute(text("SELECT 1"))
        if settings.ensure_official_demo_datasource:
            try:
                ensure_sample_db_schema()
            except Exception:
                logger.warning("sample_db_schema_bootstrap_failed", exc_info=True)
            try:
                ensure_official_demo_datasource(session)
            except Exception:
                logger.warning("official_demo_datasource_seed_failed", exc_info=True)
        if settings.ensure_analytics_datasource:
            try:
                ensure_analytics_datasource(session)
            except Exception:
                logger.warning("analytics_datasource_seed_failed", exc_info=True)
        try:
            inserted = seed_builtin_dashboard_templates(session)
            if inserted:
                logger.info("dashboard_template_seed_ok inserted=%s", inserted)
        except Exception:
            logger.warning("dashboard_template_seed_failed", exc_info=True)
        if settings.ensure_official_demo_datasource and settings.ensure_demo_instances:
            try:
                demo_inserted = seed_demo_instances(session)
                if demo_inserted:
                    logger.info("demo_instances_seed_ok inserted=%s", demo_inserted)
            except Exception:
                logger.warning("demo_instances_seed_failed", exc_info=True)
        if settings.ensure_workspace_instances:
            try:
                workspace_inserted = seed_workspace_instances(session)
                if workspace_inserted:
                    logger.info("workspace_instances_seed_ok inserted=%s", workspace_inserted)
            except Exception:
                logger.warning("workspace_instances_seed_failed", exc_info=True)
        if settings.ensure_official_demo_datasource:
            try:
                from app.metadata.dataset.demo_seed import seed_demo_datasets

                ds_count = seed_demo_datasets(session)
                if ds_count:
                    logger.info("demo_datasets_seed_ok inserted=%s", ds_count)
                from app.metadata.dataset.demo_bindings import ensure_demo_dataset_bindings

                bind_count = ensure_demo_dataset_bindings(session)
                if bind_count:
                    logger.info("demo_dataset_bindings_ok bound=%s", bind_count)
            except Exception:
                logger.warning("demo_datasets_seed_failed", exc_info=True)
        if settings.vitalspan_env == "development":
            ensure_admin_username_root_binding(
                session,
                username=settings.vitalspan_bootstrap_admin_username,
            )
            repair_dev_datasource_credentials(session)
        if settings.should_seed_demo_reports:
            try:
                from app.reports.dev_seed import seed_dev_reports

                counts = seed_dev_reports(session)
                logger.info("report_dev_seed_ok %s", counts)
            except Exception:
                logger.warning("report_dev_seed_failed", exc_info=True)
    except Exception:
        logger.warning("meta_db_warmup_failed", exc_info=True)
    finally:
        session.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.ingestion.scheduler import get_scheduler, refresh_all_jobs, register_stale_run_reconcile
    from app.ingestion.sync_executor import STALE_RUN_MAX_AGE_SECONDS, reconcile_stale_running_runs

    assert_runtime_compliant()
    try:
        reconciled = reconcile_stale_running_runs(max_age_seconds=STALE_RUN_MAX_AGE_SECONDS)
        if reconciled:
            logger.info("ingestion_stale_runs_reconciled count=%s", reconciled)
    except Exception:
        logger.warning("ingestion_stale_runs_reconcile_failed", exc_info=True)
    _warm_meta_database()
    scheduler = get_scheduler()
    register_stale_run_reconcile()
    refresh_all_jobs()
    scheduler.start()
    refresh_schedule_jobs()
    refresh_standard_snapshot_jobs()
    report_scheduler = get_report_scheduler()
    report_scheduler.start()
    yield
    report_scheduler.shutdown(wait=False)
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="VitalSpan",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TraceIdMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(HttpsAuditGuardMiddleware)


@app.exception_handler(PermissionDeniedError)
async def _permission_denied_handler(_request: Request, exc: PermissionDeniedError) -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={
            "code": "PERMISSION_DENIED",
            "message": f"Missing required permission: {exc.permission}",
            "detail": None,
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(sample_api_router)
app.include_router(api_v1_router, prefix="/api/v1")


def _mount_template_assets() -> None:
    assets_dir = resolve_template_assets_dir()
    if assets_dir is None:
        logger.warning("template_assets_dir_missing")
        return
    mount_path = template_assets_mount_path(settings)
    app.mount(mount_path, StaticFiles(directory=str(assets_dir)), name="template-assets")
    logger.info("template_assets_mounted path=%s dir=%s", mount_path, assets_dir)


_mount_template_assets()


def _openapi() -> dict:
    return customize_openapi(app)


app.openapi = _openapi
