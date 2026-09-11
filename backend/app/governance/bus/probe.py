from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from unittest.mock import patch

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.governance.bus.adapter import BusRegisterResult, InMemoryBusAdapter
from app.governance.bus.auto import auto_register
from app.governance.catalog import service as catalog_service
from app.governance.catalog.schemas import CatalogEntryCreate

probe_auto_register_budget_ms_limit = 50
probe_semi_auto_register_budget_ms_limit = 50


@dataclass(frozen=True)
class AutoRegisterProbeResult:
    elapsed_ms: float
    ok: bool


@dataclass(frozen=True)
class SemiAutoProbeResult:
    elapsed_ms: float
    ok: bool


def _mock_register(*, entry, trace_id: str) -> BusRegisterResult:
    return BusRegisterResult(
        status="succeeded",
        bus_id="probe-bus",
        bus_payload={"busId": "probe-bus"},
    )


def probe_auto_register_budget_ms(
    db: Session, actor: UserContext, entry_id: uuid.UUID,
) -> AutoRegisterProbeResult:
    started = time.perf_counter()
    with patch.object(InMemoryBusAdapter, "register", side_effect=_mock_register):
        try:
            auto_register(db, actor, entry_id)
        except catalog_service.CatalogError:
            pass
    elapsed = (time.perf_counter() - started) * 1000
    return AutoRegisterProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_auto_register_budget_ms_limit)


def probe_semi_auto_register_budget_ms(
    db: Session, actor: UserContext,
) -> SemiAutoProbeResult:
    started = time.perf_counter()
    entry = catalog_service.create_entry(
        db,
        CatalogEntryCreate(
            name="semi-auto-probe",
            http_method="POST",
            path=f"/api/v1/gov/semi-probe-{uuid.uuid4().hex[:8]}",
            category_codes=["CAT-01"],
            status="active",
        ),
    )
    with patch.object(InMemoryBusAdapter, "register", side_effect=_mock_register):
        try:
            catalog_service.register_entry_to_bus(db, entry.id)
        except catalog_service.CatalogError:
            pass
    elapsed = (time.perf_counter() - started) * 1000
    return SemiAutoProbeResult(
        elapsed_ms=elapsed,
        ok=elapsed < probe_semi_auto_register_budget_ms_limit,
    )
