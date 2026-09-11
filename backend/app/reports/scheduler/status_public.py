"""Map internal execution statuses to stable public API values."""

from __future__ import annotations

from app.reports.scheduler.schemas import ScheduleExecuteOut

_PUBLIC_STATUS_MAP: dict[str, str] = {
    "semi_real_succeeded": "succeeded",
    "semi_real_failed": "failed",
    "semi_real_delivery_degraded": "delivery_degraded",
    "mock_succeeded": "succeeded",
    "mock_skipped": "skipped",
}


def to_public_execution_status(status: str) -> str:
    return _PUBLIC_STATUS_MAP.get(status, status)


def normalize_execute_out(out: ScheduleExecuteOut) -> ScheduleExecuteOut:
    public_status = to_public_execution_status(out.status)
    if public_status == out.status:
        return out
    return out.model_copy(update={"status": public_status})
