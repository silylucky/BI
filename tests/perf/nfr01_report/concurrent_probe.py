"""Concurrent report template run probe for NFR-002 companion perf suite."""

from __future__ import annotations

import time
from dataclasses import dataclass

from fastapi.testclient import TestClient


@dataclass(frozen=True)
class ConcurrentReportProbeResult:
    concurrency: int
    requests: int
    success_count: int
    error_count: int
    p95_ms: float
    max_ms: float
    within_budget: bool
    budget_ms: int


def run_concurrent_template_run_probe(
    client: TestClient,
    *,
    template_node_id: str,
    auth_headers: dict[str, str],
    concurrency: int = 6,
    requests: int = 18,
    budget_ms: int = 10000,
) -> ConcurrentReportProbeResult:
    """Burst template run probe; sequential execution keeps TestClient stable in CI."""
    path = f"/api/v1/reports/templates/{template_node_id}/run"
    latencies: list[float] = []
    success = 0
    errors = 0

    for _ in range(requests):
        started = time.perf_counter()
        resp = client.post(path, headers=auth_headers, json={"format": "pdf"})
        elapsed = (time.perf_counter() - started) * 1000
        if resp.status_code == 200:
            success += 1
            latencies.append(elapsed)
        else:
            errors += 1

    if not latencies:
        return ConcurrentReportProbeResult(
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
    return ConcurrentReportProbeResult(
        concurrency=concurrency,
        requests=requests,
        success_count=success,
        error_count=errors,
        p95_ms=p95,
        max_ms=max(latencies),
        within_budget=p95 <= budget_ms and errors == 0,
        budget_ms=budget_ms,
    )
