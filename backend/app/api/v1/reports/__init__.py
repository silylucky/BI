from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext, require_any_permission, require_permission
from app.core.config import get_settings
from app.core.http.download import content_disposition_attachment

PERM_READ = "report:read"
PERM_MANAGE = "report:manage"
PERM_SCHEDULE = "dashboard:schedule"


class DismissRecentFailuresIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    execution_ids: list[uuid.UUID] = Field(alias="executionIds")

from app.reports.catalog.errors import ReportCatalogError
from app.reports.catalog.schemas import CatalogNodeCreate, CatalogNodeMove, CatalogNodeOut, CatalogNodeUpdate
from app.reports.catalog import service as catalog_service
from app.reports.errors import ReportBatchError, ReportExtensionError
from app.reports.extension.schemas import (
    ExtensionConfigUpsert,
    ExtensionRevisionListOut,
    ExtensionRevisionOut,
    TemplateReadinessIn,
)
from app.reports.extension import service as extension_service
from app.reports.batch.schemas import BatchCreateReportsIn, BatchExportJobIn, BatchDryRunOut
from app.reports.batch import service as batch_service
from app.reports.batch.dry_run import batch_dry_run
from app.reports.batch import export_jobs as batch_export_jobs
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.schemas import ScheduleCreate, ScheduleTransitionIn, ScheduleUpdate
from app.reports.scheduler import service as scheduler_service
from app.reports.scheduler import executor as scheduler_executor
from app.api.v1.reports.engine import router as engine_router
from app.api.v1.reports.standard import router as standard_router
from app.api.v1.reports.templates import router as templates_router
from app.api.v1.reports.center import router as center_router

router = APIRouter(prefix="/reports", tags=["reports"])


def _catalog_error(exc: ReportCatalogError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _schedule_error(exc: ScheduleError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": None})


def _extension_error(exc: ReportExtensionError) -> JSONResponse:
    detail = exc.fields if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _batch_error(exc: ReportBatchError) -> JSONResponse:
    detail = exc.fields if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/catalog/nodes/{node_id}/extension", response_model=None)
def get_node_extension(node_id: uuid.UUID, _: Annotated[UserContext, Depends(require_permission(PERM_READ))]):
    try:
        return extension_service.get_extension(node_id)
    except ReportExtensionError as exc:
        return _extension_error(exc)


@router.put("/catalog/nodes/{node_id}/extension", response_model=None)
def upsert_node_extension(
    node_id: uuid.UUID,
    payload: ExtensionConfigUpsert,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return extension_service.upsert(node_id, payload, user)
    except ReportExtensionError as exc:
        return _extension_error(exc)


@router.delete("/catalog/nodes/{node_id}/extension", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_node_extension(
    node_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        extension_service.delete_extension(node_id, user)
        return None
    except ReportExtensionError as exc:
        return _extension_error(exc)


@router.post("/catalog/nodes/{node_id}/extension/compare-preview", response_model=None)
def extension_compare_preview(
    node_id: uuid.UUID,
    payload: dict,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return extension_service.compare_preview(
            node_id, payload.get("compareMode", "yoy"), payload.get("metricKeys")
        )
    except ReportExtensionError as exc:
        return _extension_error(exc)


@router.get("/catalog/nodes/{node_id}/extension/render-spec", response_model=None)
def get_extension_render_spec(node_id: uuid.UUID, _: Annotated[UserContext, Depends(require_permission(PERM_READ))]):
    try:
        return extension_service.get_render_spec(node_id)
    except ReportExtensionError as exc:
        return _extension_error(exc)


@router.get("/catalog/nodes/{node_id}/extension/revisions", response_model=ExtensionRevisionListOut)
def list_extension_revisions(node_id: uuid.UUID, _: Annotated[UserContext, Depends(require_permission(PERM_READ))]):
    try:
        items = extension_service.list_revision_history(node_id)
        return ExtensionRevisionListOut(
            items=[ExtensionRevisionOut.model_validate(i) for i in items]
        )
    except ReportExtensionError as exc:
        return _extension_error(exc)


@router.post("/batch/dry-run", status_code=status.HTTP_200_OK, response_model=None)
def batch_dry_run_reports(
    payload: BatchCreateReportsIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return batch_dry_run(payload)
    except ReportBatchError as exc:
        return _batch_error(exc)


@router.post("/batch", status_code=status.HTTP_201_CREATED, response_model=None)
def batch_create_reports(
    payload: BatchCreateReportsIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    try:
        return batch_service.batch_create(payload, idempotency_key)
    except ReportBatchError as exc:
        return _batch_error(exc)


@router.post("/batch/export", status_code=status.HTTP_202_ACCEPTED, response_model=None)
def submit_batch_export_job(
    payload: BatchExportJobIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return batch_export_jobs.submit_batch_export(payload, actor)
    except ReportBatchError as exc:
        return _batch_error(exc)


@router.get("/jobs/{job_id}", response_model=None)
def get_batch_export_job(
    job_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return batch_export_jobs.get_batch_export_job(job_id, actor)
    except ReportBatchError as exc:
        return _batch_error(exc)


@router.get("/jobs/{job_id}/download", response_model=None)
def download_batch_export_job(
    job_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        data, content_type, filename = batch_export_jobs.get_batch_export_download(job_id, actor)
        return Response(
            content=data,
            media_type=content_type,
            headers={"Content-Disposition": content_disposition_attachment(filename)},
        )
    except ReportBatchError as exc:
        return _batch_error(exc)


@router.get("/catalog/nodes", response_model=list[CatalogNodeOut])
def list_catalog_nodes(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    parent_id: uuid.UUID | None = Query(default=None, alias="parentId"),
):
    return catalog_service.list_nodes(parent_id, user)


@router.post("/catalog/templates/readiness", response_model=None)
def list_template_readiness(
    payload: TemplateReadinessIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    return extension_service.list_templates_readiness(payload.node_ids)


@router.post("/catalog/nodes", status_code=status.HTTP_201_CREATED, response_model=None)
def create_catalog_node(
    payload: CatalogNodeCreate,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return catalog_service.create_node(payload, user)
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.get("/catalog/nodes/{node_id}", response_model=None)
def get_catalog_node(
    node_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return catalog_service.get_node(node_id, user)
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.patch("/catalog/nodes/{node_id}", response_model=None)
def update_catalog_node(
    node_id: uuid.UUID,
    payload: CatalogNodeUpdate,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return catalog_service.update_node(node_id, payload, user)
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.delete("/catalog/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_catalog_node(
    node_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        catalog_service.delete_node(node_id, user)
        return None
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.post("/catalog/nodes/{node_id}/move", response_model=None)
def move_catalog_node(
    node_id: uuid.UUID,
    payload: CatalogNodeMove,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
):
    try:
        return catalog_service.move_node(node_id, payload, user)
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.post("/schedules", status_code=status.HTTP_201_CREATED, response_model=None)
def create_schedule(
    payload: ScheduleCreate,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
):
    try:
        return scheduler_service.create_schedule(payload, user)
    except ReportCatalogError as exc:
        return _catalog_error(exc)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.get("/schedules/delivery-health", response_model=None)
def schedule_delivery_health(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    email_smtp_slot: str | None = Query(default=None, alias="emailSmtpSlot"),
):
    from app.auth.models import get_meta_session
    from app.reports.scheduler.delivery_adapter import probe_all_smtp_health, probe_smtp_health

    session = get_meta_session()
    try:
        if email_smtp_slot:
            smtp = probe_smtp_health(session=session, slot=email_smtp_slot)
            return smtp
        return probe_all_smtp_health(session=session)
    finally:
        session.close()


@router.get("/schedules/export-health", response_model=None)
def schedule_export_health(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    force_refresh: bool = Query(default=False, alias="forceRefresh"),
):
    from app.dashboard.export_render import probe_export_render_health

    return probe_export_render_health(force_refresh=force_refresh)


@router.get("/schedules/executions/recent-failures", response_model=None)
def list_recent_schedule_failures(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    limit: int = Query(default=20, ge=1, le=100),
):
    from app.reports.scheduler import acl as schedule_acl
    from app.reports.scheduler import executor as scheduler_executor
    from app.reports.scheduler import failure_dismiss as schedule_failure_dismiss

    data = scheduler_executor.list_recent_failed_executions(limit=limit)
    dismissed = schedule_failure_dismiss.list_dismissed_execution_ids(user)
    visible: list[dict] = []
    for entry in data["items"]:
        if str(entry.get("executionId", "")) in dismissed:
            continue
        try:
            row = scheduler_service._get_row(entry["scheduleId"])
            schedule_acl.assert_schedule_read(user, row)
            visible.append(entry)
        except ScheduleError:
            continue
    return {"items": visible, "total": len(visible)}


@router.post("/schedules/executions/{execution_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def dismiss_schedule_failure(
    execution_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.reports.scheduler import failure_dismiss as schedule_failure_dismiss

    schedule_failure_dismiss.dismiss_execution(user, execution_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/schedules/executions/recent-failures/dismiss-all",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def dismiss_all_recent_schedule_failures(
    payload: DismissRecentFailuresIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.reports.scheduler import failure_dismiss as schedule_failure_dismiss

    schedule_failure_dismiss.dismiss_executions(user, payload.execution_ids)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/schedules/{schedule_id}", response_model=None)
def get_schedule(
    schedule_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    try:
        return scheduler_service.get_schedule(schedule_id, user)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.patch("/schedules/{schedule_id}", response_model=None)
def update_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
):
    try:
        return scheduler_service.update_schedule(schedule_id, payload, user)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_schedule(
    schedule_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
):
    try:
        scheduler_service.delete_schedule(schedule_id, user)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.post("/schedules/{schedule_id}/transition", response_model=None)
def transition_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleTransitionIn,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
):
    try:
        return scheduler_service.transition_schedule(schedule_id, payload.action, user)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.get("/schedules", response_model=None)
def list_schedules(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    catalog_node_id: uuid.UUID | None = Query(default=None, alias="catalogNodeId"),
    source_id: uuid.UUID | None = Query(default=None, alias="sourceId"),
    source_type: str | None = Query(default=None, alias="sourceType"),
    source_key: str | None = Query(default=None, alias="sourceKey"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    try:
        return scheduler_service.list_schedules(
            user,
            catalog_node_id=catalog_node_id,
            source_id=source_id,
            source_type=source_type,
            source_key=source_key,
            limit=limit,
            offset=offset,
        )
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.get("/schedules/{schedule_id}/executions", response_model=None)
def list_schedule_executions(
    schedule_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    try:
        row = scheduler_service._get_row(schedule_id)
        from app.reports.scheduler import acl as schedule_acl
        schedule_acl.assert_schedule_read(user, row)
        return scheduler_executor.list_executions(schedule_id, limit, offset)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.post("/schedules/executions/{execution_id}/retry", response_model=None)
def retry_schedule_execution(
    execution_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    try:
        return scheduler_executor.retry_execution(execution_id, idempotency_key or "", user)
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.post("/schedules/{schedule_id}/execute", response_model=None)
def execute_schedule(
    schedule_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    delivery_mock: Annotated[str | None, Header(alias="X-Rpt-Delivery-Mock")] = None,
    _semi_real: Annotated[str | None, Header(alias="X-Rpt-Semi-Real")] = None,
    execute_mock: Annotated[str | None, Header(alias="X-Rpt-Execute-Mock")] = None,
):
    """Customer default uses semi-real + honest delivery (unconfigured without SMTP).

    Engineering probes only: ``X-Rpt-Execute-Mock: 1`` → legacy mock_succeeded.
    Test-only delivery: ``X-Rpt-Delivery-Mock: success|fail|retry``.
    """
    try:
        key = idempotency_key or ""
        settings = get_settings()
        if execute_mock == "1":
            if settings.vitalspan_env != "development":
                return JSONResponse(
                    status_code=403,
                    content={
                        "code": "RPT_SCHEDULE_MOCK_FORBIDDEN",
                        "message": "模拟执行仅允许在开发环境使用",
                        "detail": None,
                    },
                )
            return scheduler_executor.mock_execute_schedule(schedule_id, key, user)
        if delivery_mock is not None and settings.vitalspan_env != "development":
            delivery_mock = None
        # Default + X-Rpt-Semi-Real: honest path (no silent mock delivered)
        return scheduler_executor.semi_real_execute_schedule(
            schedule_id, key, user, delivery_mock
        )
    except ScheduleError as exc:
        return _schedule_error(exc)


@router.get("/schedules/executions/{execution_id}/artifact", response_model=None)
def get_execution_artifact(
    execution_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.reports.catalog.acl import assert_artifact_access

    try:
        meta = scheduler_executor.get_execution_artifact_meta(execution_id)
        assert_artifact_access(user, meta["artifactRef"])
        return meta
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.get("/schedules/executions/{execution_id}/artifact/download", response_model=None)
def download_execution_artifact(
    execution_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    slot: str | None = Query(default=None, description="primary|full_page 或 per_widget"),
):
    from app.reports.catalog.acl import assert_artifact_access

    try:
        meta = scheduler_executor.get_execution_artifact_meta(execution_id)
        assert_artifact_access(user, meta["artifactRef"])
        data, mime, filename = scheduler_executor.get_execution_artifact_download(
            execution_id, slot=slot,
        )
        return Response(
            content=data,
            media_type=mime,
            headers={"Content-Disposition": content_disposition_attachment(filename)},
        )
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.post("/catalog/nodes/{node_id}/duplicate", response_model=None)
def duplicate_catalog_node(
    node_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    name: str | None = Query(default=None),
    parent_id: uuid.UUID | None = Query(default=None, alias="parentId"),
):
    from app.reports import service as report_service

    try:
        return report_service.duplicate_catalog_node(
            node_id, name=name, parent_id=parent_id, actor=user,
        )
    except ReportCatalogError as exc:
        return _catalog_error(exc)


@router.post("/schedules/{schedule_id}/revise", response_model=None)
def revise_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    user: Annotated[UserContext, Depends(require_any_permission(PERM_MANAGE, PERM_SCHEDULE))],
):
    from app.reports import service as report_service

    try:
        return report_service.revise_schedule(schedule_id, payload, user)
    except ScheduleError as exc:
        return _schedule_error(exc)


router.include_router(center_router)
router.include_router(engine_router)
router.include_router(standard_router)
router.include_router(templates_router)
