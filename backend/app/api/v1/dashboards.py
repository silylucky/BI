from __future__ import annotations

import uuid
from typing import Annotated, Generator, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.core.http.download import content_disposition_attachment

PERM_READ = "dashboard:read"
PERM_EDIT = "dashboard:edit"
PERM_THEME_READ = "theme:read"
PERM_THEME_MANAGE = "theme:manage"
from app.dashboard import service as dash_service
from app.dashboard.editor_save_schemas import DashboardEditorSaveIn
from app.dashboard.schemas import DashboardCreate, DashboardLayoutUpdate, DashboardUpdate
from app.dashboard.templates.errors import DashboardTemplateError
from app.dashboard.templates.schemas import DashboardFromTemplateIn
from app.dashboard.templates import service as template_service
from app.dashboard.theme.errors import ThemeAnalysisError
from app.dashboard.theme import service as theme_service
from app.dashboard.entity_overview.errors import EntityOverviewError
from app.dashboard.entity_overview.schemas import EntityOverviewItem, EntityOverviewOut
from app.dashboard.entity_overview import service as overview_service
from app.dashboard.global_filters.errors import GlobalFilterError
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem, GlobalFilterLinkageOut
from app.dashboard.global_filters import service as global_filter_service
from app.dashboard.export_jobs_schemas import DashboardExportJobIn
from app.dashboard.export_snapshot import (
    execute_export_dataset_query,
    execute_export_query,
    get_export_layout,
)
from app.query.dataset.schemas import DatasetExecuteRequest
from app.query.schemas import ExecuteRequest
from app.datasources.models import get_meta_session

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


class WidgetExecuteIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    filter_values: dict[str, str] = Field(default_factory=dict, alias="filterValues")


def _db() -> Generator[Session, None, None]:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: dash_service.DashboardError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _parse_user_id(user: UserContext) -> uuid.UUID | None:
    try:
        return uuid.UUID(user.id)
    except ValueError:
        return None


def _theme_error(exc: ThemeAnalysisError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


def _overview_error(exc: EntityOverviewError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


def _filter_error(exc: GlobalFilterError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/global-filters/validate", response_model=GlobalFilterLinkageItem)
def validate_global_filters(
    payload: GlobalFilterLinkageItem,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> GlobalFilterLinkageItem | JSONResponse:
    try:
        return global_filter_service.validate_linkage(db, payload, actor)
    except GlobalFilterError as exc:
        return _filter_error(exc)


@router.put("/{dashboard_id}/global-filters", response_model=GlobalFilterLinkageOut)
def save_global_filters(
    dashboard_id: uuid.UUID,
    payload: GlobalFilterLinkageItem,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> GlobalFilterLinkageOut | JSONResponse:
    if payload.dashboard_id != dashboard_id:
        return JSONResponse(
            status_code=422,
            content={"code": "DASH_FILTER_ID_MISMATCH", "message": "dashboardId mismatch", "detail": None},
        )
    try:
        return global_filter_service.save_linkage(db, payload, user)
    except GlobalFilterError as exc:
        return _filter_error(exc)


@router.get("/{dashboard_id}/global-filters", response_model=GlobalFilterLinkageOut)
def get_global_filters(
    dashboard_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> GlobalFilterLinkageOut | JSONResponse:
    try:
        return global_filter_service.get_linkage(db, dashboard_id, user)
    except GlobalFilterError as exc:
        return _filter_error(exc)


@router.post("/{dashboard_id}/widgets/{widget_id}/execute", response_model=None)
def execute_dashboard_widget(
    dashboard_id: uuid.UUID,
    widget_id: str,
    payload: WidgetExecuteIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    from app.dashboard.global_filters.execute import execute_widget_with_filters
    from app.query.schemas import QueryError

    try:
        return execute_widget_with_filters(db, dashboard_id, widget_id, payload.filter_values, user)
    except GlobalFilterError as exc:
        return _filter_error(exc)
    except QueryError as exc:
        return JSONResponse(
            status_code=exc.status,
            content={"code": exc.code, "message": exc.message, "detail": None},
        )


@router.post("/entity-overview/validate", response_model=EntityOverviewItem)
def validate_entity_overview(
    payload: EntityOverviewItem,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> EntityOverviewItem | JSONResponse:
    try:
        return overview_service.validate_overview(db, payload)
    except EntityOverviewError as exc:
        return _overview_error(exc)


@router.put("/{dashboard_id}/entity-overview", response_model=EntityOverviewOut)
def save_entity_overview(
    dashboard_id: uuid.UUID,
    payload: EntityOverviewItem,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
) -> EntityOverviewOut | JSONResponse:
    if payload.dashboard_id != dashboard_id:
        return JSONResponse(status_code=422, content={"code": "DASH_OVERVIEW_ID_MISMATCH", "message": "dashboardId mismatch", "detail": None})
    try:
        return overview_service.save_overview(db, payload, user)
    except EntityOverviewError as exc:
        return _overview_error(exc)


@router.get("/{dashboard_id}/entity-overview", response_model=EntityOverviewOut)
def get_entity_overview(
    dashboard_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
) -> EntityOverviewOut | JSONResponse:
    try:
        return overview_service.get_overview(db, dashboard_id, user)
    except EntityOverviewError as exc:
        return _overview_error(exc)


@router.post("/theme-analysis/execute-plan", response_model=None)
def execute_theme_plan(
    payload: dict,
    user: Annotated[UserContext, Depends(require_permission(PERM_THEME_READ))],
    db: Annotated[Session, Depends(_db)],
):
    from app.dashboard.theme.execute import build_theme_execute_plan

    ref_type = payload.get("refType", "dashboard")
    ref_id = uuid.UUID(str(payload["refId"]))
    try:
        return build_theme_execute_plan(db, ref_type, ref_id, user)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)


@router.post("/theme-analysis/validate", response_model=None)
def validate_theme_analysis(
    payload: dict,
    _: Annotated[UserContext, Depends(require_permission(PERM_THEME_MANAGE))],
):
    try:
        return theme_service.validate_theme_config(payload)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)


@router.put("/theme-analysis", response_model=None)
def save_theme_analysis(
    payload: dict,
    user: Annotated[UserContext, Depends(require_permission(PERM_THEME_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return theme_service.save_theme_config(db, payload, user)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)


@router.get("/theme-analysis", response_model=None)
def get_theme_analysis(
    ref_type: str = Query(default="dashboard", alias="refType"),
    ref_id: uuid.UUID = Query(alias="refId"),
    user: Annotated[UserContext, Depends(require_permission(PERM_THEME_READ))] = None,
    db: Annotated[Session, Depends(_db)] = None,
):
    from app.dashboard.theme.acl import assert_theme_action

    try:
        assert_theme_action(user, "read")
        return theme_service.get_theme_config(db, ref_type, ref_id, user)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)


@router.get("/theme-analysis/chart-bindings", response_model=None)
def get_theme_chart_bindings(
    ref_type: str = Query(default="dashboard", alias="refType"),
    ref_id: uuid.UUID = Query(alias="refId"),
    user: Annotated[UserContext, Depends(require_permission(PERM_THEME_READ))] = None,
    db: Annotated[Session, Depends(_db)] = None,
):
    try:
        return theme_service.get_chart_bindings(db, ref_type, ref_id, user)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError
        if isinstance(exc, ConfigError) and exc.code == "CONFIG_NOT_FOUND":
            return JSONResponse(status_code=404, content={"code": "CONFIG_NOT_FOUND", "message": exc.message, "detail": None})
        raise


@router.post("/theme-analysis/query", response_model=None)
def theme_analysis_query(
    payload: dict,
    user: Annotated[UserContext, Depends(require_permission(PERM_THEME_READ))],
    db: Annotated[Session, Depends(_db)],
):
    from app.dashboard.theme.query import execute_theme_drill

    ref_type = payload.get("refType", "dashboard")
    ref_id = uuid.UUID(str(payload["refId"]))
    dimension_id = str(payload["dimensionId"])
    filters = payload.get("filters")
    try:
        return execute_theme_drill(db, user, ref_type, ref_id, dimension_id, filters)
    except ThemeAnalysisError as exc:
        return _theme_error(exc)


@router.get("")
def list_dashboards(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    surface_kind: Annotated[
        Literal["dashboard", "data-screen"] | None,
        Query(alias="surfaceKind"),
    ] = None,
    q: str | None = Query(default=None, max_length=128),
):
    return dash_service.list_dashboards(
        db,
        limit=limit,
        offset=offset,
        actor=user,
        surface_kind=surface_kind,
        q=q,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_dashboard(
    payload: DashboardCreate,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return dash_service.create_dashboard(
            db, payload, created_by=_parse_user_id(user),
        )
    except dash_service.DashboardError as exc:
        return _error_response(exc)


def _template_error(exc: DashboardTemplateError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.post("/from-template", status_code=status.HTTP_201_CREATED)
def create_dashboard_from_template(
    payload: DashboardFromTemplateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.create_dashboard_from_template(db, payload, user)
    except DashboardTemplateError as exc:
        return _template_error(exc)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.get("/{dashboard_id}")
def get_dashboard(
    dashboard_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        out = dash_service.get_dashboard(db, dashboard_id)
        dash_service.assert_dashboard_access(db, user, dashboard_id, out.created_by, slug=out.slug)
        return out
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.put("/{dashboard_id}")
def update_dashboard(
    dashboard_id: uuid.UUID,
    payload: DashboardUpdate,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        existing = dash_service.get_dashboard(db, dashboard_id)
        dash_service.assert_dashboard_access(
            db, user, dashboard_id, existing.created_by, slug=existing.slug,
        )
        return dash_service.update_dashboard(db, dashboard_id, payload)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard(
    dashboard_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        existing = dash_service.get_dashboard(db, dashboard_id)
        dash_service.assert_dashboard_access(
            db, user, dashboard_id, existing.created_by, slug=existing.slug,
        )
        dash_service.delete_dashboard(db, dashboard_id)
        from app.auth.audit.write_hooks import record_domain_delete

        record_domain_delete(
            db,
            actor_id=user.id,
            actor_username=user.username,
            target_type="dashboard",
            target_id=dashboard_id,
            detail={"name": existing.name},
        )
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.put("/{dashboard_id}/layout")
def update_layout(
    dashboard_id: uuid.UUID,
    payload: DashboardLayoutUpdate,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        existing = dash_service.get_dashboard(db, dashboard_id)
        dash_service.assert_dashboard_access(
            db, user, dashboard_id, existing.created_by, slug=existing.slug,
        )
        return dash_service.update_layout(db, dashboard_id, payload.layout_json)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.put("/{dashboard_id}/editor-save", response_model=None)
def save_dashboard_editor_state(
    dashboard_id: uuid.UUID,
    payload: DashboardEditorSaveIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    from app.dashboard.global_filters.errors import GlobalFilterError

    try:
        return dash_service.save_editor_state(
            db,
            dashboard_id,
            name=payload.name,
            layout_json=payload.layout_json,
            global_filters=payload.global_filters,
            actor=user,
        )
    except dash_service.DashboardError as exc:
        return _error_response(exc)
    except GlobalFilterError as exc:
        return _filter_error(exc)


@router.put("/{dashboard_id}/thumbnail")
async def upload_dashboard_thumbnail(
    dashboard_id: uuid.UUID,
    request: Request,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        existing = dash_service.get_dashboard(db, dashboard_id)
        dash_service.assert_dashboard_access(
            db, user, dashboard_id, existing.created_by, slug=existing.slug,
        )
        content = await request.body()
        content_type = request.headers.get("content-type", "application/octet-stream")
        return dash_service.save_dashboard_thumbnail(db, dashboard_id, content, content_type)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.get("/{dashboard_id}/thumbnail")
def download_dashboard_thumbnail(
    dashboard_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        body, media_type = dash_service.get_dashboard_thumbnail(db, dashboard_id, user)
        return Response(
            content=body,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=3600"},
        )
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.post("/{dashboard_id}/export-jobs", status_code=status.HTTP_201_CREATED)
def create_dashboard_export_job(
    dashboard_id: uuid.UUID,
    payload: DashboardExportJobIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    from app.dashboard.export_jobs import submit_dashboard_export

    try:
        return submit_dashboard_export(db, dashboard_id, payload.format, user)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.get("/export-jobs/{job_id}")
def get_dashboard_export_job_route(
    job_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.dashboard.export_jobs import get_dashboard_export_job

    try:
        return get_dashboard_export_job(job_id, user)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.get("/export-jobs/{job_id}/download")
def download_dashboard_export_job(
    job_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
):
    from app.dashboard.export_jobs import read_dashboard_export_bytes

    try:
        body, media_type, filename = read_dashboard_export_bytes(job_id, user)
        return Response(
            content=body,
            media_type=media_type,
            headers={"Content-Disposition": content_disposition_attachment(filename)},
        )
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.get("/{dashboard_id}/export-layout")
def get_dashboard_export_layout_route(
    dashboard_id: uuid.UUID,
    token: str = Query(),
    db: Annotated[Session, Depends(_db)] = None,
):
    try:
        return get_export_layout(db, dashboard_id, token)
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.post("/export-query/execute")
def post_dashboard_export_query(
    payload: ExecuteRequest,
    request: Request,
    db: Annotated[Session, Depends(_db)] = None,
):
    token = request.headers.get("X-Export-Token", "").strip()
    dash_raw = request.headers.get("X-Export-Dashboard-Id", "").strip()
    if not token or not dash_raw:
        return JSONResponse(
            status_code=401,
            content={"code": "UNAUTHORIZED", "message": "Missing export token", "detail": None},
        )
    try:
        dashboard_id = uuid.UUID(dash_raw)
        return execute_export_query(db, dashboard_id, token, payload)
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={"code": "VALIDATION_ERROR", "message": "Invalid dashboard id", "detail": None},
        )
    except dash_service.DashboardError as exc:
        return _error_response(exc)


@router.post("/export-query/dataset/execute")
def post_dashboard_export_dataset_query(
    payload: DatasetExecuteRequest,
    request: Request,
    db: Annotated[Session, Depends(_db)] = None,
):
    token = request.headers.get("X-Export-Token", "").strip()
    dash_raw = request.headers.get("X-Export-Dashboard-Id", "").strip()
    if not token or not dash_raw:
        return JSONResponse(
            status_code=401,
            content={"code": "UNAUTHORIZED", "message": "Missing export token", "detail": None},
        )
    try:
        dashboard_id = uuid.UUID(dash_raw)
        return execute_export_dataset_query(db, dashboard_id, token, payload)
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={"code": "VALIDATION_ERROR", "message": "Invalid dashboard id", "detail": None},
        )
    except dash_service.DashboardError as exc:
        return _error_response(exc)
