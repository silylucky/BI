from __future__ import annotations

import uuid
from typing import Annotated, Generator, Literal

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.dashboard.templates import service as template_service
from app.dashboard.templates.errors import DashboardTemplateError
from app.dashboard.templates.schemas import (
    DashboardFromTemplateIn,
    DashboardTemplateCreateIn,
    DashboardTemplateUpdateIn,
    VizLayoutEnvelopeIn,
)
from app.datasources.models import get_meta_session

PERM_READ = "dashboard:read"
PERM_EDIT = "dashboard:edit"
PERM_MANAGE = "dashboard:template.manage"

router = APIRouter(prefix="/dashboard-templates", tags=["dashboard-templates"])


def _db() -> Generator[Session, None, None]:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error_response(exc: DashboardTemplateError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("")
def list_templates(
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    surface_kind: Annotated[
        Literal["dashboard", "data-screen"] | None,
        Query(alias="surfaceKind"),
    ] = None,
    status: Annotated[Literal["draft", "published", "archived"] | None, Query()] = None,
    category_key: Annotated[str | None, Query(alias="categoryKey")] = None,
    visibility: Annotated[Literal["builtin", "org", "private"] | None, Query()] = None,
    q: str | None = None,
    include_drafts: Annotated[bool, Query(alias="includeDrafts")] = False,
):
    try:
        return template_service.list_templates(
            db,
            user,
            surface_kind=surface_kind,
            status=status,
            category_key=category_key,
            visibility=visibility,
            q=q,
            include_drafts=include_drafts,
            limit=limit,
            offset=offset,
        )
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.get("/{template_id}")
def get_template(
    template_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.get_template(db, template_id, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_template(
    payload: DashboardTemplateCreateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.create_template(db, payload, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.put("/{template_id}")
def update_template(
    template_id: uuid.UUID,
    payload: DashboardTemplateUpdateIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.update_template(db, template_id, payload, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.post("/{template_id}/publish")
def publish_template(
    template_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.publish_template(db, template_id, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.post("/{template_id}/archive")
def archive_template(
    template_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.archive_template(db, template_id, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        template_service.delete_template(db, template_id, user)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_template(
    payload: VizLayoutEnvelopeIn,
    user: Annotated[UserContext, Depends(require_permission(PERM_EDIT))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.import_envelope(db, payload, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)


@router.get("/{template_id}/export")
def export_template(
    template_id: uuid.UUID,
    user: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return template_service.export_envelope(db, template_id, user)
    except DashboardTemplateError as exc:
        return _error_response(exc)
