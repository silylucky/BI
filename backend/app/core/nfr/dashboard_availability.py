from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Literal

from app.auth.deps import UserContext
from app.core.nfr.dashboard_first_screen import DashboardFirstScreenProbeIn, probe_dashboard_first_screen
from app.core.nfr.dashboard_sla import (
    DashboardSlaError,
    DashboardSlaProbeIn,
    probe_dashboard_sla,
)
from app.core.nfr.errors import DASHBOARD_SLA_BELOW_TARGET

OVERALL = Literal["available", "degraded", "unavailable"]

CORE_DASHBOARD_IDS = ("core-dash", "executive-overview")
P95_THRESHOLD_MS = 5000


@dataclass(frozen=True)
class DashboardAvailabilityReport:
    dashboard_id: str
    within_sla: bool
    within_first_screen_budget: bool
    overall_status: OVERALL
    sla_uptime_percent: float
    first_screen_p95_ms: float


@dataclass(frozen=True)
class AvailabilityProbeResult:
    elapsed_ms: float
    ok: bool


def build_dashboard_availability_report(
    dashboard_id: str,
    actor: UserContext,
    *,
    simulate_breach: bool = False,
) -> DashboardAvailabilityReport:
    sla_in = DashboardSlaProbeIn(dashboardId=dashboard_id, simulateBreach=simulate_breach)
    try:
        sla = probe_dashboard_sla(sla_in, actor)
        within_sla = sla.within_sla
        sla_uptime = sla.uptime_percent
    except DashboardSlaError as exc:
        if exc.code != DASHBOARD_SLA_BELOW_TARGET:
            raise
        within_sla = False
        sla_uptime = 99.0
    fs = probe_dashboard_first_screen(DashboardFirstScreenProbeIn(dashboardId=dashboard_id), actor)
    within_fs = fs.elapsed_ms <= P95_THRESHOLD_MS
    if within_sla and within_fs:
        overall: OVERALL = "available"
    elif within_sla or within_fs:
        overall = "degraded"
    else:
        overall = "unavailable"
    return DashboardAvailabilityReport(
        dashboard_id=dashboard_id,
        within_sla=within_sla,
        within_first_screen_budget=within_fs,
        overall_status=overall,
        sla_uptime_percent=sla_uptime,
        first_screen_p95_ms=float(fs.elapsed_ms),
    )


def probe_core_dashboards_smoke(
    actor: UserContext, *, simulate_breach: bool = False
) -> list[DashboardAvailabilityReport]:
    return [
        build_dashboard_availability_report(did, actor, simulate_breach=simulate_breach)
        for did in CORE_DASHBOARD_IDS
    ]


def probe_dashboard_availability_budget_ms(actor: UserContext) -> AvailabilityProbeResult:
    started = time.perf_counter()
    build_dashboard_availability_report("probe-dash", actor)
    elapsed = (time.perf_counter() - started) * 1000
    return AvailabilityProbeResult(elapsed_ms=elapsed, ok=elapsed < 50)
