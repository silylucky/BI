from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat07 import service as cat07_service

probe_workno_behavior_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat07ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_workno_behavior_budget_ms(workno: str = "EMP1001") -> Cat07ProbeResult:
    started = time.perf_counter()
    actor = UserContext(id="probe", username="probe", roles=["admin"])
    cat07_service.query_behavior(workno, None, None, 50, 0, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat07ProbeResult(
        elapsed_ms=elapsed,
        ok=elapsed < probe_workno_behavior_budget_ms_limit,
    )
