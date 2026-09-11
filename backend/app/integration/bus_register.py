from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import BusRegisterOut
from app.integration.bus_adapter_factory import get_bus_adapter
from app.integration.errors import IntegrationError

_NIL_UUID = uuid.UUID(int=0)


def _assert_integration_bus(actor: UserContext) -> None:
    if actor.is_root or "integration" in actor.roles:
        return
    raise IntegrationError(
        "BUS_REGISTER_INTEGRATION_FORBIDDEN",
        "Bus registration requires integration role or root",
        403,
    )


def validate_register_payload(catalog_entry_id: uuid.UUID) -> None:
    if catalog_entry_id == _NIL_UUID:
        raise IntegrationError(
            "BUS_REGISTER_INVALID_PAYLOAD",
            "Invalid catalog entry id",
            422,
            fields=[{"field": "catalogEntryId", "message": "must not be nil uuid"}],
        )


def register_on_publish(
    db: Session,
    entry_id: uuid.UUID,
    actor: UserContext,
) -> BusRegisterOut:
    validate_register_payload(entry_id)
    out, _created = register_catalog_to_bus(db, entry_id, actor)
    return out


def _build_adapter(*, max_attempts: int = 3):
    return get_bus_adapter(max_attempts=max_attempts)


def register_with_if01_adapter(
    db: Session,
    entry_id: uuid.UUID,
    actor: UserContext,
    *,
    max_attempts: int = 3,
) -> tuple[BusRegisterOut, bool]:
    return register_catalog_to_bus(db, entry_id, actor, max_attempts=max_attempts)


def register_catalog_to_bus(
    db: Session,
    entry_id: uuid.UUID,
    actor: UserContext,
    *,
    max_attempts: int = 3,
) -> tuple[BusRegisterOut, bool]:
    _assert_integration_bus(actor)
    adapter = _build_adapter(max_attempts=max_attempts)
    try:
        return catalog_service.register_entry_to_bus(db, entry_id, adapter=adapter)
    except catalog_service.CatalogError as exc:
        trace_id = getattr(exc, "trace_id", None)
        if exc.code == "BUS_REGISTRATION_TIMEOUT" and max_attempts > 1:
            raise IntegrationError(
                "BUS_REGISTER_RETRY_EXHAUSTED",
                exc.message,
                502,
                trace_id=trace_id,
            ) from exc
        raise IntegrationError(exc.code, exc.message, exc.status, trace_id=trace_id) from exc
