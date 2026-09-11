from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat05 import service as cat05_service

probe_ticket_stats_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat05ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_ticket_stats_budget_ms(key: str) -> Cat05ProbeResult:
    started = time.perf_counter()
    admin = UserContext(id="probe", username="probe", roles=["admin"])
    cat05_service.get_ticket_stats(key, admin)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat05ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_ticket_stats_budget_ms_limit)
