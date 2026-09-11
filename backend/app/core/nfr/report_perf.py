from __future__ import annotations

import re
import time
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

from app.auth.deps import UserContext
from app.core.nfr.errors import (
    REPORT_PERF_BUDGET_OUT_OF_RANGE,
    REPORT_PERF_FORBIDDEN,
    REPORT_PERF_INVALID_SAMPLE_QUERY,
    REPORT_PERF_REPORT_REQUIRED,
    REPORT_PERF_SAMPLE_OUT_OF_RANGE,
)

_SAMPLE_QUERY_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
_USER_REPORT_PERF_SCOPE: dict[str, str] = {}
probe_report_perf_budget_ms_limit = 50

REPORT_QUERY_FIXTURE: dict[str, object] = {
    "id": "rpt-m10-query-smoke",
    "templateKey": "sales_summary",
    "budgetMs": 10000,
    "mockElapsedMs": 120,
}


@dataclass(frozen=True)
class ReportPerfProbeBudgetResult:
    elapsed_ms: float
    ok: bool


class ReportPerfError(Exception):
    def __init__(self, code: str, message: str, status: int = 422, fields: list | None = None) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields or []
        super().__init__(message)


class ReportPerfProbeIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    report_id: str = Field(default="", alias="reportId", max_length=128)
    sample_query_id: str | None = Field(default=None, alias="sampleQueryId", max_length=64)
    budget_ms: int = Field(default=10000, alias="budgetMs")
    sample_rows: int = Field(default=100, alias="sampleRows")
    simulate_failure: bool = Field(default=False, alias="simulateFailure")


class ReportPerfValidateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    valid: bool
    report_id: str = Field(alias="reportId")
    budget_ms: int = Field(alias="budgetMs")


class ReportPerfProbeOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    report_id: str = Field(alias="reportId")
    elapsed_ms: int = Field(alias="elapsedMs")
    within_budget: bool = Field(alias="withinBudget")
    sample_passed: bool = Field(alias="samplePassed")
    budget_ms: int = Field(alias="budgetMs")
    fixture_profile: dict[str, object] | None = Field(default=None, alias="fixtureProfile")

_MOCK_ELAPSED_MS = 120


def _default_actor() -> UserContext:
    return UserContext(id="dev", username="dev", roles=["admin"])


def set_user_report_perf_scope(user_id: str, report_prefix: str) -> None:
    _USER_REPORT_PERF_SCOPE[user_id] = report_prefix


def _assert_acl(actor: UserContext, report_id: str) -> None:
    if "enterprise" not in set(actor.roles):
        return
    prefix = _USER_REPORT_PERF_SCOPE.get(actor.id, "rpt-")
    if not report_id.startswith(prefix):
        raise ReportPerfError(REPORT_PERF_FORBIDDEN, "enterprise user out of report perf scope", 403)


def _guard_sample_query_id(sample_query_id: str | None) -> None:
    if sample_query_id and not _SAMPLE_QUERY_RE.match(sample_query_id):
        raise ReportPerfError(
            REPORT_PERF_INVALID_SAMPLE_QUERY,
            "Invalid sampleQueryId",
            422,
            [{"field": "sampleQueryId", "message": "invalid pattern"}],
        )


def _guard_config(payload: ReportPerfProbeIn, actor: UserContext) -> ReportPerfProbeIn:
    if not payload.report_id or not payload.report_id.strip():
        raise ReportPerfError(
            REPORT_PERF_REPORT_REQUIRED,
            "reportId is required",
            422,
            [{"field": "reportId", "message": "required"}],
        )
    _assert_acl(actor, payload.report_id)
    _guard_sample_query_id(payload.sample_query_id)
    if payload.budget_ms < 1000 or payload.budget_ms > 30000:
        raise ReportPerfError(REPORT_PERF_BUDGET_OUT_OF_RANGE, "budgetMs out of range", 422)
    if payload.sample_rows < 1 or payload.sample_rows > 1000:
        raise ReportPerfError(REPORT_PERF_SAMPLE_OUT_OF_RANGE, "sampleRows out of range", 422)
    return payload


def _resolve_fixture_profile(report_id: str) -> dict[str, object] | None:
    if report_id == REPORT_QUERY_FIXTURE["id"]:
        return dict(REPORT_QUERY_FIXTURE)
    return None


def validate_report_perf_config(payload: ReportPerfProbeIn, actor: UserContext | None = None) -> ReportPerfValidateOut:
    item = _guard_config(payload, actor or _default_actor())
    return ReportPerfValidateOut(valid=True, report_id=item.report_id, budget_ms=item.budget_ms)


def probe_report_perf(payload: ReportPerfProbeIn, actor: UserContext | None = None) -> ReportPerfProbeOut:
    item = _guard_config(payload, actor or _default_actor())
    profile = _resolve_fixture_profile(item.report_id)
    within = _MOCK_ELAPSED_MS <= item.budget_ms
    sample_passed = not item.simulate_failure
    return ReportPerfProbeOut(
        report_id=item.report_id,
        elapsed_ms=_MOCK_ELAPSED_MS,
        within_budget=within,
        sample_passed=sample_passed,
        budget_ms=item.budget_ms,
        fixture_profile=profile,
    )


def probe_validate_report_perf_budget_ms(actor: UserContext) -> ReportPerfProbeBudgetResult:
    started = time.perf_counter()
    validate_report_perf_config(
        ReportPerfProbeIn(reportId="rpt-probe", budgetMs=10000, sampleRows=100),
        actor,
    )
    elapsed = (time.perf_counter() - started) * 1000
    return ReportPerfProbeBudgetResult(elapsed_ms=elapsed, ok=elapsed < probe_report_perf_budget_ms_limit)


def probe_report_perf_probe_budget_ms(actor: UserContext) -> ReportPerfProbeBudgetResult:
    started = time.perf_counter()
    probe_report_perf(ReportPerfProbeIn(reportId="rpt-probe"), actor)
    elapsed = (time.perf_counter() - started) * 1000
    return ReportPerfProbeBudgetResult(elapsed_ms=elapsed, ok=elapsed < probe_report_perf_budget_ms_limit)
