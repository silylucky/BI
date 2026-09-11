from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import audit_kwargs
from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.auth.org import service as org_service
from app.auth.schemas import OrgCreate, OrgListResponse, OrgOut, OrgUpdate

router = APIRouter(prefix="/orgs", tags=["auth"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _org_error_response(exc: org_service.OrgError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("", response_model=OrgListResponse)
def list_orgs(
    _: Annotated[UserContext, Depends(require_permission("system:org.read"))],
    db: Annotated[Session, Depends(_db)],
    q: str | None = Query(default=None, max_length=128),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> OrgListResponse:
    rows, total = org_service.list_org_nodes(db, name_query=q, limit=limit, offset=offset)
    items = [OrgOut.model_validate(n) for n in rows]
    return OrgListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
def create_org(
    payload: OrgCreate,
    actor: Annotated[UserContext, Depends(require_permission("system:org.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> OrgOut | JSONResponse:
    try:
        node = org_service.create_org_node(db, payload, **audit_kwargs(actor.id, actor.username))
    except org_service.OrgError as exc:
        return _org_error_response(exc)
    return OrgOut.model_validate(node)


@router.get("/{org_id}", response_model=OrgOut)
def get_org(
    org_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission("system:org.read"))],
    db: Annotated[Session, Depends(_db)],
) -> OrgOut | JSONResponse:
    try:
        node = org_service.get_org_node(db, org_id)
    except org_service.OrgError as exc:
        return _org_error_response(exc)
    return OrgOut.model_validate(node)


@router.put("/{org_id}", response_model=OrgOut)
def update_org(
    org_id: uuid.UUID,
    payload: OrgUpdate,
    actor: Annotated[UserContext, Depends(require_permission("system:org.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> OrgOut | JSONResponse:
    try:
        node = org_service.update_org_node(
            db, org_id, payload, **audit_kwargs(actor.id, actor.username)
        )
    except org_service.OrgError as exc:
        return _org_error_response(exc)
    return OrgOut.model_validate(node)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_org(
    org_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission("system:org.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> Response:
    try:
        org_service.delete_org_node(db, org_id, **audit_kwargs(actor.id, actor.username))
    except org_service.OrgError as exc:
        return _org_error_response(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
