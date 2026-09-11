"""Tests for public execution status mapping."""

from __future__ import annotations

from app.reports.scheduler.status_public import normalize_execute_out, to_public_execution_status
from app.reports.scheduler.schemas import ScheduleExecuteOut
import uuid
from datetime import UTC, datetime


def test_to_public_execution_status_maps_semi_real() -> None:
    assert to_public_execution_status("semi_real_failed") == "failed"
    assert to_public_execution_status("semi_real_succeeded") == "succeeded"
    assert to_public_execution_status("semi_real_delivery_degraded") == "delivery_degraded"


def test_normalize_execute_out_returns_copy() -> None:
    out = ScheduleExecuteOut(
        executionId=uuid.uuid4(),
        scheduleId=uuid.uuid4(),
        status="semi_real_failed",
        artifactRef="semi://x",
        idempotencyKey="k1",
        executedAt=datetime.now(UTC).isoformat(),
    )
    public = normalize_execute_out(out)
    assert public.status == "failed"
    assert out.status == "semi_real_failed"
