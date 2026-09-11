from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.nfr.errors import (
    DASHBOARD_FIRST_SCREEN_BUDGET_OUT_OF_RANGE,
    DASHBOARD_FIRST_SCREEN_DASHBOARD_REQUIRED,
    DASHBOARD_FIRST_SCREEN_FORBIDDEN,
    DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID,
    DASHBOARD_FIRST_SCREEN_WIDGET_OUT_OF_RANGE,
)

_MOCK_ELAPSED_MS = 800
_SLOW_ELAPSED_MS = 6000
_DASHBOARD_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$")
_USER_FIRST_SCREEN_SCOPE: dict[str, str] = {}
probe_first_screen_budget_ms_limit = 50

M5_EXTENDED_WIDGET_FIXTURE: dict[str, object] = {
    "id": "dash-m5-extended",
    "widgetTypes": ["map", "heatmap", "kpi", "timeline"],
    "widgetCount": 4,
}


def _resolve_fixture_profile(dashboard_id: str, widget_count: int) -> dict[str, object] | None:
    if dashboard_id == M5_EXTENDED_WIDGET_FIXTURE["id"]:
        return dict(M5_EXTENDED_WIDGET_FIXTURE)
    if widget_count == 4 and os.environ.get("NFR001_FIXTURE_PROFILE") == "extended":
        return dict(M5_EXTENDED_WIDGET_FIXTURE)
    return None


@dataclass(frozen=True)
class FirstScreenProbeResult:
    elapsed_ms: float
    ok: bool


class DashboardFirstScreenError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class DashboardFirstScreenProbeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: str = Field(default="", alias="dashboardId", max_length=128)
    budget_ms: int = Field(default=5000, alias="budgetMs")
    widget_count: int = Field(default=12, alias="widgetCount")
    simulate_slow: bool = Field(default=False, alias="simulateSlow")


class DashboardFirstScreenValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    dashboard_id: str = Field(alias="dashboardId")
    budget_ms: int = Field(alias="budgetMs")


class DashboardFirstScreenProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dashboard_id: str = Field(alias="dashboardId")
    elapsed_ms: int = Field(alias="elapsedMs")
    within_budget: bool = Field(alias="withinBudget")
    budget_ms: int = Field(alias="budgetMs")
    widget_count: int = Field(alias="widgetCount")
    sampled_at: datetime = Field(alias="sampledAt")
    fixture_profile: dict[str, object] | None = Field(default=None, alias="fixtureProfile")


def _default_actor() -> UserContext:
    return UserContext(id="dev", username="dev", roles=["admin"])


def set_user_first_screen_scope(user_id: str, dashboard_prefix: str) -> None:
    _USER_FIRST_SCREEN_SCOPE[user_id] = dashboard_prefix


def _assert_acl(actor: UserContext, dashboard_id: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_FIRST_SCREEN_SCOPE.get(actor.id, "dash-")
    if not dashboard_id.startswith(prefix):
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_FORBIDDEN,
            "enterprise user out of first-screen scope",
            403,
        )


def _guard_dashboard_id(dashboard_id: str) -> None:
    if not _DASHBOARD_ID_RE.match(dashboard_id):
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID,
            "Invalid dashboardId",
            422,
            [{"field": "dashboardId", "message": "invalid pattern"}],
        )


def _guard(payload: DashboardFirstScreenProbeIn, actor: UserContext) -> DashboardFirstScreenProbeIn:
    if not payload.dashboard_id or not payload.dashboard_id.strip():
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_DASHBOARD_REQUIRED,
            "dashboardId is required",
            422,
            [{"field": "dashboardId", "message": "required"}],
        )
    _guard_dashboard_id(payload.dashboard_id.strip())
    _assert_acl(actor, payload.dashboard_id)
    if payload.budget_ms < 1000 or payload.budget_ms > 30000:
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_BUDGET_OUT_OF_RANGE,
            "budgetMs out of range",
            422,
        )
    if payload.widget_count < 1 or payload.widget_count > 64:
        raise DashboardFirstScreenError(
            DASHBOARD_FIRST_SCREEN_WIDGET_OUT_OF_RANGE,
            "widgetCount out of range",
            422,
        )
    return payload


def validate_dashboard_first_screen(
    payload: DashboardFirstScreenProbeIn, actor: UserContext | None = None,
) -> DashboardFirstScreenValidateOut:
    item = _guard(payload, actor or _default_actor())
    return DashboardFirstScreenValidateOut(
        valid=True,
        dashboard_id=item.dashboard_id,
        budget_ms=item.budget_ms,
    )


def probe_dashboard_first_screen(
    payload: DashboardFirstScreenProbeIn, actor: UserContext | None = None,
) -> DashboardFirstScreenProbeOut:
    item = _guard(payload, actor or _default_actor())
    slow = item.simulate_slow
    elapsed = _SLOW_ELAPSED_MS if slow else _MOCK_ELAPSED_MS
    within = elapsed <= item.budget_ms
    return DashboardFirstScreenProbeOut(
        dashboard_id=item.dashboard_id,
        elapsed_ms=elapsed,
        within_budget=within,
        budget_ms=item.budget_ms,
        widget_count=item.widget_count,
        sampled_at=datetime.now(UTC),
        fixture_profile=_resolve_fixture_profile(item.dashboard_id, item.widget_count),
    )


def probe_validate_first_screen_budget_ms(actor: UserContext) -> FirstScreenProbeResult:
    started = time.perf_counter()
    validate_dashboard_first_screen(
        DashboardFirstScreenProbeIn(dashboardId="dash-probe", budgetMs=5000, widgetCount=4),
        actor,
    )
    elapsed = (time.perf_counter() - started) * 1000
    return FirstScreenProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_first_screen_budget_ms_limit)


def probe_first_screen_probe_budget_ms(actor: UserContext) -> FirstScreenProbeResult:
    started = time.perf_counter()
    probe_dashboard_first_screen(DashboardFirstScreenProbeIn(dashboardId="dash-probe"), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return FirstScreenProbeResult(elapsed_ms=elapsed, ok=elapsed < probe_first_screen_budget_ms_limit)
