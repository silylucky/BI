from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.dashboard.global_filters import service as gf_service
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem

probe_linkage_budget_ms_limit = 50


@dataclass(frozen=True)
class GlobalFilterProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_linkage_budget_ms(
    session: Session, item: GlobalFilterLinkageItem, actor: UserContext,
) -> GlobalFilterProbeResult:
    started = time.perf_counter()
    gf_service.validate_linkage(session, item, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return GlobalFilterProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_linkage_budget_ms_limit)


def probe_get_linkage_budget_ms(
    session: Session, dashboard_id: uuid.UUID, actor: UserContext,
) -> GlobalFilterProbeResult:
    started = time.perf_counter()
    gf_service.get_linkage(session, dashboard_id, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return GlobalFilterProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_linkage_budget_ms_limit)
