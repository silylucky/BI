from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission

PERM_READ = "governance:read"
PERM_MANAGE = "governance:manage"
from app.datasources.models import get_meta_session
from app.integration.errors import IntegrationError
from app.integration import query_services as svc

router = APIRouter(prefix="/services", tags=["integration", "IF-02"])


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _err(exc: IntegrationError) -> JSONResponse:
    detail: dict | None = None
    if exc.fields:
        detail = {"fields": exc.fields}
    elif exc.trace_id:
        detail = {"traceId": exc.trace_id}
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": detail},
    )


@router.get("", response_model=svc.QueryServiceListResponse)
def list_services(
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    category: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    try:
        return svc.list_published_services(db, category=category, limit=limit, offset=offset)
    except IntegrationError as exc:
        return _err(exc)


@router.get("/{service_id}", response_model=svc.QueryServiceOut)
def get_service(
    service_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        return svc.get_published_service(db, service_id)
    except IntegrationError as exc:
        return _err(exc)


@router.get("/{service_id}/openapi")
def get_service_openapi(
    service_id: uuid.UUID,
    _: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        service = svc.get_published_service(db, service_id)
        return svc.get_service_openapi_fragment(service)
    except IntegrationError as exc:
        return _err(exc)


@router.post("/{service_id}/execute", response_model=svc.QueryServiceExecuteOut)
def execute_service(
    service_id: uuid.UUID,
    payload: svc.QueryServiceExecuteIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_READ))],
    db: Annotated[Session, Depends(_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    try:
        return svc.execute_published_service(
            db,
            service_id,
            payload.parameters,
            actor,
            idempotency_key=idempotency_key,
        )
    except IntegrationError as exc:
        return _err(exc)


@router.post("/{service_id}/publish")
def publish_service_route(
    service_id: uuid.UUID,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        out, created = svc.publish_service(db, service_id, actor)
        service_out = svc._entry_to_service(out)
        status_code = 201 if created else 200
        return JSONResponse(
            status_code=status_code,
            content=service_out.model_dump(by_alias=True, mode="json"),
        )
    except IntegrationError as exc:
        return _err(exc)
