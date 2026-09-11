from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat06 import service as cat06_service
from app.governance.catalog.cat06.schemas import ProductionStatsItemIn

probe_production_stats_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat06ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_production_stats_budget_ms(key: str) -> Cat06ProbeResult:
    started = time.perf_counter()
    admin = UserContext(id="probe", username="probe", roles=["admin"])
    cat06_service.get_production_stats(key, admin)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat06ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_production_stats_budget_ms_limit)


def probe_validate_production_stats_budget_ms() -> Cat06ProbeResult:
    started = time.perf_counter()
    sample = ProductionStatsItemIn.model_validate({
        "statsKey": "PS_PROBE",
        "displayName": "Probe",
        "vendorType": "enterprise",
        "brandId": "BRAND01",
        "locType": "all",
        "metricKeys": ["inbound"],
    })
    cat06_service.validate_production_stats(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat06ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_production_stats_budget_ms_limit)
