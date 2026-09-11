from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.nfr.errors import (
    DASHBOARD_SLA_ALERT_THRESHOLD_OUT_OF_RANGE,
    DASHBOARD_SLA_BELOW_TARGET,
    DASHBOARD_SLA_DASHBOARD_REQUIRED,
    DASHBOARD_SLA_FORBIDDEN,
    DASHBOARD_SLA_INVALID_DASHBOARD_ID,
    DASHBOARD_SLA_WINDOW_OUT_OF_RANGE,
)

_MOCK_UPTIME = 99.7
_ALERTS = {"enabled": True, "channels": ["email", "webhook"], "thresholdPercent": 99.5}
_DASHBOARD_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$")
_USER_DASHBOARD_SLA_SCOPE: dict[str, str] = {}
probe_dashboard_sla_budget_ms_limit = 50


@dataclass(frozen=True)
class DashboardSlaProbeResult:
    elapsed_ms: float
    ok: bool


class DashboardSlaError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class DashboardSlaProbeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: str = Field(default="", alias="dashboardId", max_length=128)
    window_hours: int = Field(default=24, alias="windowHours")
    sla_target_percent: float = Field(default=99.5, alias="slaTargetPercent")
    simulate_breach: bool = Field(default=False, alias="simulateBreach")


class DashboardSlaValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    dashboard_id: str = Field(alias="dashboardId")


class DashboardSlaProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: str = Field(alias="dashboardId")
    uptime_percent: float = Field(alias="uptimePercent")
    sla_target_percent: float = Field(alias="slaTargetPercent")
    within_sla: bool = Field(alias="withinSla")
    window_hours: int = Field(alias="windowHours")
    sampled_at: datetime = Field(alias="sampledAt")


class DashboardSlaAlertsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    enabled: bool
    channels: list[str]
    threshold_percent: float = Field(alias="thresholdPercent")
    configured: bool


def set_user_dashboard_sla_scope(user_id: str, dashboard_prefix: str) -> None:
    _USER_DASHBOARD_SLA_SCOPE[user_id] = dashboard_prefix


def _default_actor() -> UserContext:
    return UserContext(id="dev", username="dev", roles=["admin"])


def _assert_acl(actor: UserContext, dashboard_id: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_DASHBOARD_SLA_SCOPE.get(actor.id, "sla-dash-")
    if not dashboard_id.startswith(prefix):
        raise DashboardSlaError(DASHBOARD_SLA_FORBIDDEN, "enterprise user out of dashboard SLA scope", 403)


def _guard_dashboard_id(dashboard_id: str) -> None:
    if not _DASHBOARD_ID_RE.match(dashboard_id):
        raise DashboardSlaError(
            DASHBOARD_SLA_INVALID_DASHBOARD_ID,
            "Invalid dashboardId",
            422,
            [{"field": "dashboardId", "message": "invalid pattern"}],
        )


def _guard(payload: DashboardSlaProbeIn, actor: UserContext) -> DashboardSlaProbeIn:
    if not payload.dashboard_id or not payload.dashboard_id.strip():
        raise DashboardSlaError(
            DASHBOARD_SLA_DASHBOARD_REQUIRED,
            "dashboardId is required",
            422,
            [{"field": "dashboardId", "message": "required"}],
        )
    dash = payload.dashboard_id.strip()
    _guard_dashboard_id(dash)
    _assert_acl(actor, dash)
    if payload.window_hours < 1 or payload.window_hours > 168:
        raise DashboardSlaError(DASHBOARD_SLA_WINDOW_OUT_OF_RANGE, "windowHours out of range", 422)
    if payload.sla_target_percent < 90.0 or payload.sla_target_percent > 99.99:
        raise DashboardSlaError("DASHBOARD_SLA_TARGET_OUT_OF_RANGE", "slaTargetPercent out of range", 422)
    return payload.model_copy(update={"dashboard_id": dash})


def validate_dashboard_sla(
    payload: DashboardSlaProbeIn, actor: UserContext | None = None,
) -> DashboardSlaValidateOut:
    item = _guard(payload, actor or _default_actor())
    return DashboardSlaValidateOut(valid=True, dashboard_id=item.dashboard_id)


def probe_dashboard_sla(
    payload: DashboardSlaProbeIn, actor: UserContext | None = None,
) -> DashboardSlaProbeOut:
    item = _guard(payload, actor or _default_actor())
    uptime = 99.0 if item.simulate_breach else _MOCK_UPTIME
    within = uptime >= item.sla_target_percent
    if item.simulate_breach and not within:
        raise DashboardSlaError(DASHBOARD_SLA_BELOW_TARGET, "SLA below target", 503)
    return DashboardSlaProbeOut(
        dashboard_id=item.dashboard_id,
        uptime_percent=uptime,
        sla_target_percent=item.sla_target_percent,
        within_sla=within,
        window_hours=item.window_hours,
        sampled_at=datetime.now(UTC),
    )


def get_dashboard_sla_alerts(threshold_percent: float | None = None) -> DashboardSlaAlertsOut:
    threshold = _ALERTS["thresholdPercent"] if threshold_percent is None else threshold_percent
    if threshold_percent is not None and (threshold < 90.0 or threshold > 99.99):
        raise DashboardSlaError(
            DASHBOARD_SLA_ALERT_THRESHOLD_OUT_OF_RANGE,
            "thresholdPercent out of range",
            422,
            [{"field": "thresholdPercent", "message": "must be between 90 and 99.99"}],
        )
    channels = _ALERTS["channels"]
    return DashboardSlaAlertsOut(
        enabled=_ALERTS["enabled"],
        channels=channels,
        threshold_percent=threshold,
        configured=bool(channels),
    )


def probe_validate_dashboard_sla_budget_ms(actor: UserContext) -> DashboardSlaProbeResult:
    started = time.perf_counter()
    validate_dashboard_sla(
        DashboardSlaProbeIn(dashboardId="sla-dash-probe", windowHours=24, slaTargetPercent=99.5),
        actor,
    )
    elapsed = (time.perf_counter() - started) * 1000
    return DashboardSlaProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_dashboard_sla_budget_ms_limit)


def probe_dashboard_sla_probe_budget_ms(actor: UserContext) -> DashboardSlaProbeResult:
    started = time.perf_counter()
    probe_dashboard_sla(DashboardSlaProbeIn(dashboardId="sla-dash-probe"), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return DashboardSlaProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_dashboard_sla_budget_ms_limit)
