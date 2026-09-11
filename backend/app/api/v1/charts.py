from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.auth.deps import UserContext, require_permission

PERM_READ = "dashboard:read"
PERM_EDIT = "dashboard:edit"
from app.schemas.chart_view import ChartViewConfig, ChartViewError, validate_chart_view_config
from app.viz.embed import ChartEmbedConfig, ChartEmbedError, validate_chart_embed_config
from app.viz.sdk_portal.errors import SdkPortalError
from app.viz.sdk_portal.schemas import (
    SdkCapabilitiesOut,
    SdkLifecycleIn,
    SdkLifecycleOut,
    SdkPortalInitIn,
    SdkPortalValidateOut,
)
from app.viz.sdk_portal import service as sdk_portal_service
from app.viz.registry import export_chart_type_catalog
from app.viz.render import build_render_spec

router = APIRouter(prefix="/charts", tags=["charts"])


def _error_response(exc: ChartViewError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/types")
def list_chart_types(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> list[dict]:
    return export_chart_type_catalog()


@router.post("/validate", response_model=ChartViewConfig)
def validate_chart(
    payload: dict,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> ChartViewConfig | JSONResponse:
    try:
        return validate_chart_view_config(payload)
    except ChartViewError as exc:
        return _error_response(exc)


@router.post("/render-spec", response_model=None)
def render_spec_chart(
    payload: dict,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> dict | JSONResponse:
    try:
        cfg = validate_chart_view_config(payload)
    except ChartViewError as exc:
        return _error_response(exc)
    return build_render_spec(cfg)


def _embed_error_response(exc: ChartEmbedError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


def _sdk_error(exc: SdkPortalError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message, "detail": detail})


@router.post("/sdk/validate", response_model=SdkPortalValidateOut)
def validate_sdk_portal(
    payload: SdkPortalInitIn,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> SdkPortalValidateOut | JSONResponse:
    try:
        return sdk_portal_service.validate_sdk_init(payload)
    except SdkPortalError as exc:
        return _sdk_error(exc)


@router.post("/sdk/lifecycle", response_model=None)
def sdk_lifecycle(
    payload: SdkLifecycleIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> SdkLifecycleOut | JSONResponse:
    try:
        return sdk_portal_service.lifecycle_manifest(payload, actor)
    except SdkPortalError as exc:
        return _sdk_error(exc)


@router.get("/sdk/capabilities", response_model=SdkCapabilitiesOut)
def sdk_capabilities(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> SdkCapabilitiesOut:
    return sdk_portal_service.list_capabilities()


@router.post("/embed/validate", response_model=None)
def validate_embed(
    payload: dict,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
) -> ChartEmbedConfig | JSONResponse:
    try:
        return validate_chart_embed_config(payload)
    except ChartEmbedError as exc:
        return _embed_error_response(exc)
