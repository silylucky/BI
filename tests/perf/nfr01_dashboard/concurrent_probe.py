"""Concurrent dashboard GET probe for NFR-001 companion perf suite."""

from __future__ import annotations

import time
from dataclasses import dataclass

from fastapi.testclient import TestClient


@dataclass(frozen=True)
class ConcurrentDashboardProbeResult:
    concurrency: int
    requests: int
    success_count: int
    error_count: int
    p95_ms: float
    max_ms: float
    within_budget: bool
    budget_ms: int


def run_concurrent_dashboard_get_probe(
    client: TestClient,
    *,
    dashboard_id: str,
    auth_headers: dict[str, str],
    concurrency: int = 8,
    requests: int = 32,
    budget_ms: int = 5000,
) -> ConcurrentDashboardProbeResult:
    """Burst GET probe; sequential execution keeps TestClient + SQLite stable in CI."""
    path = f"/api/v1/dashboards/{dashboard_id}"
    latencies: list[float] = []
    success = 0
    errors = 0

    for _ in range(requests):
        started = time.perf_counter()
        resp = client.get(path, headers=auth_headers)
        elapsed = (time.perf_counter() - started) * 1000
        if resp.status_code == 200:
            success += 1
            latencies.append(elapsed)
        else:
            errors += 1

    if not latencies:
        return ConcurrentDashboardProbeResult(
            concurrency=concurrency,
            requests=requests,
            success_count=0,
            error_count=errors,
            p95_ms=0.0,
            max_ms=0.0,
            within_budget=False,
            budget_ms=budget_ms,
        )

    sorted_ms = sorted(latencies)
    p95_index = max(0, min(len(sorted_ms) - 1, int(len(sorted_ms) * 0.95) - 1))
    p95 = sorted_ms[p95_index]
    return ConcurrentDashboardProbeResult(
        concurrency=concurrency,
        requests=requests,
        success_count=success,
        error_count=errors,
        p95_ms=p95,
        max_ms=max(latencies),
        within_budget=p95 <= budget_ms and errors == 0,
        budget_ms=budget_ms,
    )


def render_report_stub(result: ConcurrentDashboardProbeResult, *, dashboard_id: str) -> str:
    return "\n".join(
        [
            "# NFR-01 Dashboard Concurrent GET Probe",
            "",
            f"- dashboardId: `{dashboard_id}`",
            f"- concurrency: {result.concurrency}",
            f"- requests: {result.requests}",
            f"- success: {result.success_count}",
            f"- errors: {result.error_count}",
            f"- p95Ms: {result.p95_ms:.2f}",
            f"- maxMs: {result.max_ms:.2f}",
            f"- budgetMs: {result.budget_ms}",
            f"- withinBudget: {result.within_budget}",
            "",
            "> Stub report for CI companion; production perf suite may attach environment metadata.",
        ]
    )
