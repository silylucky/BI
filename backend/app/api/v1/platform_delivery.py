from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import audit_kwargs
from app.auth.deps import UserContext, require_permission
from app.auth.models import get_meta_session
from app.core.platform_config import email_service
from app.core.platform_config.schemas import (
    EmailDeliveryConfigOut,
    EmailDeliveryConfigPut,
    EmailDeliverySlotsOut,
)
from app.core.platform_config.slots import EMAIL_SLOT_QQ, normalize_email_slot

router = APIRouter(prefix="/platform/delivery", tags=["platform"])

EmailSlotPath = Literal["qq", "163"]


def _db() -> Session:
    session = get_meta_session()
    try:
        yield session
    finally:
        session.close()


def _error(exc: email_service.PlatformConfigError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"code": exc.code, "message": exc.message, "detail": None},
    )


@router.get("/email/slots", response_model=EmailDeliverySlotsOut)
def list_email_delivery_slots(
    _: Annotated[UserContext, Depends(require_permission("system:platform_connect.read"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliverySlotsOut:
    return email_service.list_email_configs(db)


@router.get("/email", response_model=EmailDeliveryConfigOut)
def get_email_delivery_config(
    _: Annotated[UserContext, Depends(require_permission("system:platform_connect.read"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliveryConfigOut:
    return email_service.get_email_config(db, EMAIL_SLOT_QQ)


@router.get("/email/{slot}", response_model=EmailDeliveryConfigOut)
def get_email_delivery_slot_config(
    slot: EmailSlotPath,
    _: Annotated[UserContext, Depends(require_permission("system:platform_connect.read"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliveryConfigOut:
    return email_service.get_email_config(db, normalize_email_slot(slot))


@router.put("/email/{slot}", response_model=EmailDeliveryConfigOut)
def put_email_delivery_slot_config(
    slot: EmailSlotPath,
    payload: EmailDeliveryConfigPut,
    actor: Annotated[UserContext, Depends(require_permission("system:platform_connect.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliveryConfigOut | JSONResponse:
    try:
        return email_service.save_email_config(
            db,
            slot,
            payload,
            **audit_kwargs(actor.id, actor.username),
        )
    except email_service.PlatformConfigError as exc:
        return _error(exc)


@router.put("/email", response_model=EmailDeliveryConfigOut)
def put_email_delivery_config(
    payload: EmailDeliveryConfigPut,
    actor: Annotated[UserContext, Depends(require_permission("system:platform_connect.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliveryConfigOut | JSONResponse:
    try:
        return email_service.save_email_config(
            db,
            EMAIL_SLOT_QQ,
            payload,
            **audit_kwargs(actor.id, actor.username),
        )
    except email_service.PlatformConfigError as exc:
        return _error(exc)


@router.delete("/email/{slot}", response_model=EmailDeliveryConfigOut)
def delete_email_delivery_slot_config(
    slot: EmailSlotPath,
    actor: Annotated[UserContext, Depends(require_permission("system:platform_connect.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliveryConfigOut:
    return email_service.clear_email_config(
        db,
        slot,
        **audit_kwargs(actor.id, actor.username),
    )


@router.delete("/email", response_model=EmailDeliveryConfigOut)
def delete_email_delivery_config(
    actor: Annotated[UserContext, Depends(require_permission("system:platform_connect.manage"))],
    db: Annotated[Session, Depends(_db)],
) -> EmailDeliveryConfigOut:
    return email_service.clear_email_config(
        db,
        EMAIL_SLOT_QQ,
        **audit_kwargs(actor.id, actor.username),
    )
