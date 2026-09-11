"""M10 NFR-002 — report query perf smoke."""
from __future__ import annotations

from app.core.nfr.report_perf import REPORT_QUERY_FIXTURE, ReportPerfProbeIn, probe_report_perf


def test_nfr_002_01_fixture_within_budget():
    out = probe_report_perf(
        ReportPerfProbeIn(reportId=REPORT_QUERY_FIXTURE["id"], budgetMs=10000),
    )
    assert out.within_budget is True
    assert out.fixture_profile is not None
    assert out.fixture_profile["templateKey"] == "sales_summary"


def test_nfr_002_02_simulate_failure_breach():
    out = probe_report_perf(
        ReportPerfProbeIn(reportId="rpt-other", budgetMs=10000, simulateFailure=True),
    )
    assert out.sample_passed is False
