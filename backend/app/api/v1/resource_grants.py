from __future__ import annotations

import uuid
import uuid as uuid_mod
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.auth.resources import service as grant_service
from app.auth.schemas import ResourceGrantCreate, ResourceGrantListResponse, ResourceGrantOut
from app.core.logging import trace_id_var

router = APIRouter(prefix="/resource-grants", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _grant_error_response(exc: grant_service.GrantError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


def _audit_context(actor: UserContext) -> dict[str, str | None]:
    trace = trace_id_var.get() or uuid_mod.uuid4().hex
    return {
        "actor_id": actor.id,
        "actor_username": actor.username,
        "trace_id": trace,
    }


@router.get("", response_model=ResourceGrantListResponse)
def list_resource_grants(
    _: Annotated[UserContext, Depends(require_permission("system:grant.read"))],
    db: Annotated[Session, Depends(_db)],
    role_id: uuid.UUID | None = Query(default=None),
    resource_type: str | None = Query(default=None),
) -> ResourceGrantListResponse:
    items = [
        ResourceGrantOut.model_validate(g)
        for g in grant_service.list_grants(db, role_id=role_id, resource_type=resource_type)
    ]
    return ResourceGrantListResponse(items=items)


@router.post("", response_model=ResourceGrantOut, status_code=status.HTTP_201_CREATED)
def create_resource_grant(
    payload: ResourceGrantCreate,
    actor: Annotated[UserContext, Depends(require_permission("system:grant.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> ResourceGrantOut | JSONResponse:
    try:
        grant = grant_service.create_grant(
            db, payload, **_audit_context(actor), actor_permissions=set(actor.permissions), actor_is_root=actor.is_root
        )
    except grant_service.GrantError as exc:
        return _grant_error_response(exc)
    return ResourceGrantOut.model_validate(grant)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_resource_grant(
    grant_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission("system:grant.manage"))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        grant_service.delete_grant(
            db,
            grant_id,
            **_audit_context(actor),
            actor_permissions=set(actor.permissions),
            actor_is_root=actor.is_root,
        )
    except grant_service.GrantError as exc:
        return _grant_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
