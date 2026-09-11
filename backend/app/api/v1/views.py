from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, get_current_user
from app.auth.models import get_meta_session
from app.views.protocol import export_view_json_schema
from app.views.schemas import DashboardView, ViewError
from app.views.validate import validate_dashboard_view
from app.views.role_template import get_defaults, put_defaults
from app.views.user_override import create_override, delete_override, get_override, list_overrides, update_override

router = APIRouter(prefix="/views", tags=["views", "IF-06"])


def _error_response(exc: ViewError) -> JSONResponse:
    detail = {"fields": exc.fields} if exc.fields else None
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("/schema", response_model=None)
def read_view_schema(
    _: Annotated[UserContext, Depends(get_current_user)],
) -> dict:
    return export_view_json_schema()


@router.post("/validate", response_model=DashboardView)
def validate_view(
    payload: dict,
    _: Annotated[UserContext, Depends(get_current_user)],
) -> DashboardView | JSONResponse:
    try:
        return validate_dashboard_view(payload)
    except ViewError as exc:
        return _error_response(exc)


role_defaults_router = APIRouter(prefix="/roles", tags=["views", "IF-06"])


class RoleDefaultViewsIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: uuid.UUID | None = Field(default=None, alias="dashboardId")
    report_template_node_id: uuid.UUID | None = Field(default=None, alias="reportTemplateNodeId")
    max_widget_count: int = Field(default=24, alias="maxWidgetCount")
    inherit_from_role_id: str | None = Field(default=None, alias="inheritFromRoleId")


def _views_db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


@role_defaults_router.get("/{role_id}/default-views", response_model=None)
def read_role_default_views(
    role_id: str,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    try:
        return get_defaults(role_id, actor, db)
    except ViewError as exc:
        return _error_response(exc)


@role_defaults_router.put("/{role_id}/default-views", response_model=None)
def write_role_default_views(
    role_id: str,
    payload: RoleDefaultViewsIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    try:
        return put_defaults(db, role_id, payload.model_dump(by_alias=True), actor)
    except ViewError as exc:
        return _error_response(exc)


user_views_router = APIRouter(prefix="/users", tags=["views", "IF-06"])


class UserViewOverrideIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, max_length=120)
    dashboard_id: uuid.UUID = Field(alias="dashboardId")
    layout: dict
    classification_scope: str | None = Field(default=None, alias="classificationScope")
    is_default: bool | None = Field(default=None, alias="isDefault")


@user_views_router.get("/me/views/{view_id}", response_model=None)
def get_my_view(
    view_id: str,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    try:
        return get_override(db, actor.id, view_id)
    except ViewError as exc:
        return _error_response(exc)


@user_views_router.get("/me/views", response_model=None)
def list_my_views(
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    return list_overrides(actor.id, db, list(actor.roles))


@user_views_router.post("/me/views", status_code=status.HTTP_201_CREATED, response_model=None)
def create_my_view(
    payload: UserViewOverrideIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    try:
        return create_override(db, actor, payload.model_dump(by_alias=True))
    except ViewError as exc:
        return _error_response(exc)


@user_views_router.put("/me/views/{view_id}", response_model=None)
def update_my_view(
    view_id: str,
    payload: UserViewOverrideIn,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    try:
        return update_override(db, actor, view_id, payload.model_dump(by_alias=True))
    except ViewError as exc:
        return _error_response(exc)


@user_views_router.delete("/me/views/{view_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_my_view(
    view_id: str,
    actor: Annotated[UserContext, Depends(get_current_user)],
    db: Annotated[Session, Depends(_views_db)],
):
    try:
        delete_override(db, actor, view_id)
        return None
    except ViewError as exc:
        return _error_response(exc)
