from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.governance.catalog.cat02 import service as cat02_service
from app.governance.catalog.cat02.schemas import AggregateTemplateIn

probe_aggregate_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat02ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_aggregate_budget_ms() -> Cat02ProbeResult:
    started = time.perf_counter()
    sample = AggregateTemplateIn.model_validate({
        "aggregateKey": f"AGG_{uuid.uuid4().hex[:6].upper()}",
        "displayName": "Probe",
        "dimensions": ["region"],
        "metrics": ["amount"],
        "aggregationFn": "sum",
        "attributionLabel": "probe",
    })
    cat02_service.validate_aggregate_template(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat02ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_aggregate_budget_ms_limit)


def probe_list_aggregate_budget_ms() -> Cat02ProbeResult:
    started = time.perf_counter()
    cat02_service.list_aggregate_templates(50, 0, UserContext(id="probe", username="probe", roles=["admin"]))
    elapsed = (time.perf_counter() - started) * 1000
    return Cat02ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_aggregate_budget_ms_limit)
