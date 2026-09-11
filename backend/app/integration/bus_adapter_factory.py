from __future__ import annotations

from app.governance.bus.adapter import BusAdapter, InMemoryBusAdapter, register_with_retry
from app.governance.catalog.schemas import CatalogEntryOut


class RetryingBusAdapter:
    def __init__(self, inner: BusAdapter, max_attempts: int = 3) -> None:
        self._inner = inner
        self._max_attempts = max_attempts

    def register(self, *, entry: CatalogEntryOut, trace_id: str):
        return register_with_retry(
            self._inner,
            entry=entry,
            trace_id=trace_id,
            max_attempts=self._max_attempts,
        )


def get_bus_adapter(*, max_attempts: int = 3) -> RetryingBusAdapter:
    return RetryingBusAdapter(InMemoryBusAdapter(), max_attempts=max_attempts)
