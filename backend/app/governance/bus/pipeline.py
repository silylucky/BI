from __future__ import annotations

import uuid
from typing import Literal

from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.deps import UserContext
from app.core.logging import trace_id_var
from app.governance.bus.auto import (
    _assert_auto_role,
    _assert_entry_path_scope,
    _extract_bus_id,
    _set_fsm,
    get_fsm_state,
)
from app.governance.bus.auto_schemas import AutoRegisterOut
from app.governance.bus.degradation import BusRegisterOutcome, record_deferred_registration
from app.governance.catalog import service as catalog_service
from app.integration.bus_adapter_factory import get_bus_adapter


def _audit_bus_event(
    db: Session,
    actor: UserContext,
    entry_id: uuid.UUID,
    action: str,
    trace_id: str,
    *,
    bus_id: str | None = None,
    source: str | None = None,
) -> None:
    record_platform_event(
        db,
        actor_id=actor.id,
        actor_username=actor.username,
        target_type="gov_catalog_entry",
        target_id=entry_id,
        action=action,
        detail={"traceId": trace_id, "busId": bus_id, "source": source},
        trace_id=trace_id,
    )


def _map_retry_exhausted(exc: catalog_service.CatalogError) -> catalog_service.CatalogError:
    if exc.code == "BUS_REGISTRATION_TIMEOUT":
        err = catalog_service.CatalogError(
            "BUS_REGISTER_RETRY_EXHAUSTED", exc.message, 502
        )
        err.trace_id = getattr(exc, "trace_id", None)
        return err
    return exc


def trigger_auto_bus_register(
    db: Session,
    actor: UserContext,
    entry_id: uuid.UUID,
    *,
    source: Literal["publish", "manual", "retry"],
) -> tuple[AutoRegisterOut, int]:
    _assert_auto_role(actor)
    state = get_fsm_state(entry_id)
    if state in ("failed", "auto_registering") and source != "retry":
        raise catalog_service.CatalogError(
            "GOV_AUTO_BUS_INVALID_TRANSITION",
            f"Cannot auto-register from fsm state {state}",
            409,
        )
    try:
        entry = catalog_service.get_entry(db, entry_id)
    except catalog_service.CatalogError:
        raise catalog_service.CatalogError(
            "CATALOG_ENTRY_NOT_FOUND", "Catalog entry not found", 404
        ) from None

    if entry.status != "published":
        raise catalog_service.CatalogError(
            "GOV_AUTO_BUS_NOT_PUBLISHABLE",
            "Entry must be published",
            400,
        )

    _assert_entry_path_scope(actor, entry.path)
    trace_id = trace_id_var.get() or uuid.uuid4().hex
    _set_fsm(entry_id, "auto_registering")
    try:
        adapter = get_bus_adapter(max_attempts=3)
        out, created = catalog_service.register_entry_to_bus(db, entry_id, adapter=adapter)
        _set_fsm(entry_id, "succeeded")
        bus_id = _extract_bus_id(out)
        _audit_bus_event(
            db, actor, entry_id, "bus_auto_register_succeeded", trace_id, bus_id=bus_id, source=source
        )
        db.commit()
        code = 201 if created else 200
        return (
            AutoRegisterOut(autoRegistered=created, busId=bus_id, fsmState="succeeded"),
            code,
        )
    except catalog_service.CatalogError as exc:
        mapped = _map_retry_exhausted(exc)
        if source != "publish":
            _set_fsm(entry_id, "failed")
            _audit_bus_event(
                db, actor, entry_id, "bus_auto_register_failed", trace_id, source=source
            )
            db.commit()
        raise mapped from exc


def attempt_auto_bus_register_for_publish(
    db: Session, actor: UserContext, entry_id: uuid.UUID
) -> BusRegisterOutcome:
    try:
        out, _code = trigger_auto_bus_register(db, actor, entry_id, source="publish")
        return BusRegisterOutcome(status="succeeded", bus_id=out.bus_id)
    except catalog_service.CatalogError as exc:
        trace_id = trace_id_var.get() or uuid.uuid4().hex
        code = (
            exc.code
            if exc.code == "BUS_REGISTER_RETRY_EXHAUSTED"
            else "BUS_REGISTER_RETRY_EXHAUSTED"
        )
        record_deferred_registration(db, actor, entry_id, trace_id, code)
        db.commit()
        return BusRegisterOutcome(status="deferred", error_code=code)


def retry_auto_register(
    db: Session, actor: UserContext, entry_id: uuid.UUID
) -> tuple[AutoRegisterOut, int]:
    if get_fsm_state(entry_id) not in ("failed", "deferred"):
        raise catalog_service.CatalogError(
            "GOV_AUTO_BUS_INVALID_TRANSITION",
            "Retry only allowed from failed or deferred fsm state",
            409,
        )
    return trigger_auto_bus_register(db, actor, entry_id, source="retry")
