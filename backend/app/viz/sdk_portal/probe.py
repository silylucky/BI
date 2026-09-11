from __future__ import annotations

import time
from dataclasses import dataclass

from app.auth.deps import UserContext
from app.viz.sdk_portal.errors import SdkPortalError
from app.viz.sdk_portal.schemas import LifecyclePhase, SdkLifecycleIn, SdkPortalInitIn
from app.viz.sdk_portal.service import lifecycle_manifest, validate_sdk_init

probe_sdk_validate_budget_ms = 50
probe_sdk_lifecycle_budget_ms = 50


@dataclass(frozen=True)
class SdkPortalProbeResult:
    elapsed_ms: float
    ok: bool


def probe_validate_sdk_budget_ms(payload: SdkPortalInitIn) -> SdkPortalProbeResult:
    started = time.perf_counter()
    try:
        validate_sdk_init(payload)
        ok = True
    except SdkPortalError:
        ok = False
    return SdkPortalProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)


def probe_lifecycle_budget_ms(phase: LifecyclePhase, actor: UserContext) -> SdkPortalProbeResult:
    started = time.perf_counter()
    try:
        lifecycle_manifest(SdkLifecycleIn(phase=phase), actor)
        ok = True
    except SdkPortalError:
        ok = False
    return SdkPortalProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
