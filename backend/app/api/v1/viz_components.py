from __future__ import annotations

import uuid
from typing import Annotated, Generator, Literal

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.datasources.models import get_meta_session
from app.viz.components import service as component_service
from app.viz.components.errors import VizComponentError
from app.viz.components.schemas import (
    VizComponentBatchResolveIn,
    VizComponentCreateIn,
    VizComponentUpdateIn,
)

PERM_READ = "dashboard:read"
PERM_EDIT = "dashboard:edit"
PERM_MANAGE = "viz:component.manage"

router = APIRouter(prefix="/viz-components", tags=["viz-components"])


def _db() -> Generator[Session, None, None]:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: VizComponentError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("")
def list_components(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    surface_kind: Annotated[
        Literal["dashboard", "data-screen"] | None,
        Query(alias="surfaceKind"),
    ] = None,
    widget_type: Annotated[
        Literal["chart", "filter", "text", "media"] | None,
        Query(alias="widgetType"),
    ] = None,
    chart_palette_category: Annotated[str | None, Query(alias="chartPaletteCategory")] = None,
    status: Annotated[Literal["draft", "published", "archived"] | None, Query()] = None,
    category_key: Annotated[str | None, Query(alias="categoryKey")] = None,
    visibility: Annotated[Literal["org", "private"] | None, Query()] = None,
    q: str | None = None,
    include_drafts: Annotated[bool, Query(alias="includeDrafts")] = False,
):
    try:
        return component_service.list_components(
            db,
            user,
            surface_kind=surface_kind,
            widget_type=widget_type,
            chart_palette_category=chart_palette_category,
            status=status,
            category_key=category_key,
            visibility=visibility,
            q=q,
            include_drafts=include_drafts,
            limit=limit,
            offset=offset,
        )
    except VizComponentError as exc:
        return _error_response(exc)


@router.post("/batch-resolve")
def batch_resolve_components(
    payload: VizComponentBatchResolveIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.batch_resolve(db, payload.ids, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.get("/{component_id}/references")
def get_component_references(
    component_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.get_component_references(db, component_id, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.get("/{component_id}")
def get_component(
    component_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.get_component(db, component_id, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_component(
    payload: VizComponentCreateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.create_component(db, payload, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.put("/{component_id}")
def update_component(
    component_id: uuid.UUID,
    payload: VizComponentUpdateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.update_component(db, component_id, payload, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.put("/{component_id}/thumbnail")
async def upload_component_thumbnail(
    component_id: uuid.UUID,
    request: Request,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        content = await request.body()
        content_type = request.headers.get("content-type", "application/octet-stream")
        return component_service.save_component_thumbnail(db, component_id, content, content_type, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.get("/{component_id}/thumbnail")
def download_component_thumbnail(
    component_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        body, media_type = component_service.get_component_thumbnail(db, component_id, user)
        return Response(
            content=body,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=3600"},
        )
    except VizComponentError as exc:
        return _error_response(exc)


@router.post("/{component_id}/publish")
def publish_component(
    component_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.publish_component(db, component_id, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.post("/{component_id}/archive")
def archive_component(
    component_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return component_service.archive_component(db, component_id, user)
    except VizComponentError as exc:
        return _error_response(exc)


@router.delete("/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_component(
    component_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        component_service.delete_component(db, component_id, user)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except VizComponentError as exc:
        return _error_response(exc)
