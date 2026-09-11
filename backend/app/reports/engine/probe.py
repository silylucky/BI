from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.reports.engine import service as engine_service
from app.reports.engine.schemas import RenderRunIn

probe_engine_run_budget_ms_limit = 50


@dataclass(frozen=True)
class EngineProbeResult:
    elapsed_ms: float
    ok: bool


def probe_run_template_budget_ms(
    template_id: uuid.UUID, payload: RenderRunIn, actor: UserContext,
) -> EngineProbeResult:
    started = time.perf_counter()
    engine_service.run_template(template_id, payload, actor)
    elapsed = (time.perf_counter() - started) * 1000
    return EngineProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_engine_run_budget_ms_limit)
