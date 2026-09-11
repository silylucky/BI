from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.entity_overview import service as overview_service
from app.dashboard.entity_overview.schemas import EntityOverviewItem

probe_overview_budget_ms_limit = 50


@dataclass(frozen=True)
class EntityOverviewProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_overview_budget_ms(session: Session, item: EntityOverviewItem) -> EntityOverviewProbeResult:
    started = time.perf_counter()
    overview_service.validate_overview(session, item)
    elapsed = (time.perf_counter() - started) * 1000
    return EntityOverviewProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_overview_budget_ms_limit)


def probe_get_overview_budget_ms(
    session: Session, dashboard_id: uuid.UUID, actor: UserContext,
) -> EntityOverviewProbeResult:
    started = time.perf_counter()
    overview_service.get_overview(session, dashboard_id, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return EntityOverviewProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_overview_budget_ms_limit)
