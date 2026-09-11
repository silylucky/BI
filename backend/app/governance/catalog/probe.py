from __future__ import annotations

import time

from app.auth.deps import UserContext
from app.core.nfr.dashboard_first_screen import FirstScreenProbeResult
from app.governance.catalog.service import get_appendix_e_taxonomy_for_actor

probe_appendix_e_taxonomy_budget_ms_limit = 50


def probe_appendix_e_taxonomy_budget_ms(actor: UserContext) -> FirstScreenProbeResult:
    started = time.perf_counter()
    get_appendix_e_taxonomy_for_actor(actor)
    elapsed = (time.perf_counter() - started) * 1000
    return FirstScreenProbeResult(
        elapsed_ms=elapsed,
        ok=elapsed < probe_appendix_e_taxonomy_budget_ms_limit,
    )
