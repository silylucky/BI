from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from app.governance.catalog.schemas import CatalogEntryOut


@dataclass(frozen=True)
class BusRegisterResult:
    status: str
    bus_id: str | None = None
    registered_at: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    bus_payload: dict | None = None


class BusAdapter(Protocol):
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult: ...


_RETRYABLE = frozenset({
    "BUS_REGISTRATION_TIMEOUT",
    "BUS_REGISTRATION_SERVER_ERROR",
})


def register_with_retry(
    adapter: BusAdapter,
    *,
    entry: CatalogEntryOut,
    trace_id: str,
    max_attempts: int = 3,
) -> BusRegisterResult:
    last: BusRegisterResult | None = None
    for _ in range(max(1, max_attempts)):
        last = adapter.register(entry=entry, trace_id=trace_id)
        if last.status == "succeeded":
            return last
        if last.error_code not in _RETRYABLE:
            return last
    return last or BusRegisterResult(status="failed", error_code="BUS_REGISTER_RETRY_EXHAUSTED")


class InMemoryBusAdapter:
    def register(self, *, entry: CatalogEntryOut, trace_id: str) -> BusRegisterResult:
        if entry.status == "draft":
            return BusRegisterResult(
                status="failed",
                error_code="BUS_ENTRY_NOT_PUBLISHABLE",
                error_message="Draft entry",
            )
        if "force-fail" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_REJECTED",
                error_message="Bus rejected",
            )
        if "force-timeout" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_TIMEOUT",
                error_message="Bus registration timed out",
            )
        if "force-4xx" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_CLIENT_ERROR",
                error_message="Bus client error",
            )
        if "force-5xx" in entry.path:
            return BusRegisterResult(
                status="failed",
                error_code="BUS_REGISTRATION_SERVER_ERROR",
                error_message="Bus server error",
            )
        bus_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        return BusRegisterResult(
            status="succeeded",
            bus_id=bus_id,
            registered_at=now,
            bus_payload={"busId": bus_id, "registeredAt": now, "traceId": trace_id},
        )
