from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from app.governance.catalog.cat01 import service as cat01_service
from app.governance.catalog.cat01.schemas import LifecycleTemplateIn

probe_lifecycle_budget_ms_limit = 50


@dataclass(frozen=True)
class Cat01ProbeResult:
    elapsed_ms: float
    ok: bool


def probe_list_lifecycle_templates_budget_ms() -> Cat01ProbeResult:
    started = time.perf_counter()
    from app.auth.deps import UserContext

    cat01_service.list_lifecycle_templates(50, 0, UserContext(id="probe", username="probe", roles=["admin"]))
    elapsed = (time.perf_counter() - started) * 1000
    return Cat01ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_lifecycle_budget_ms_limit)


def probe_validate_lifecycle_budget_ms() -> Cat01ProbeResult:
    started = time.perf_counter()
    sample = LifecycleTemplateIn.model_validate({
        "templateKey": f"LIFE_{uuid.uuid4().hex[:6].upper()}",
        "displayName": "Probe",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["created", "active"],
        "allowedRoles": ["analyst"],
    })
    cat01_service.validate_lifecycle_template(sample)
    elapsed = (time.perf_counter() - started) * 1000
    return Cat01ProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_lifecycle_budget_ms_limit)
