from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.deps import UserContext, require_permission

PERM_MANAGE = "governance:manage"
from app.datasources.models import get_meta_session
from app.governance.catalog.schemas import BusRegisterOut
from app.integration import bus_register
from app.integration.errors import IntegrationError

router = APIRouter(prefix="/integration/bus", tags=["integration", "IF-01"])


class IntegrationBusRegisterIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    retry: dict | None = None


class IntegrationBusRetryIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    catalog_entry_id: uuid.UUID = Field(alias="catalogEntryId")
    registration_id: uuid.UUID | None = Field(default=None, alias="registrationId")


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


@router.post("/register", response_model=BusRegisterOut)
def register_integration_bus(
    payload: IntegrationBusRegisterIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    max_attempts = 3
    if payload.retry and "maxAttempts" in payload.retry:
        max_attempts = int(payload.retry["maxAttempts"])
    try:
        bus_register.validate_register_payload(payload.catalog_entry_id)
        out, created = bus_register.register_catalog_to_bus(
            db, payload.catalog_entry_id, actor, max_attempts=max_attempts
        )
        return JSONResponse(
            status_code=201 if created else 200,
            content=out.model_dump(by_alias=True, mode="json"),
        )
    except IntegrationError as exc:
        return _err(exc)


@router.post("/register/retry", response_model=BusRegisterOut)
def retry_integration_bus(
    payload: IntegrationBusRetryIn,
    actor: Annotated[UserContext, Depends(require_permission(PERM_MANAGE))],
    db: Annotated[Session, Depends(_db)],
):
    try:
        out, created = bus_register.register_catalog_to_bus(
            db, payload.catalog_entry_id, actor, max_attempts=3
        )
        return JSONResponse(
            status_code=201 if created else 200,
            content=out.model_dump(by_alias=True, mode="json"),
        )
    except IntegrationError as exc:
        return _err(exc)
