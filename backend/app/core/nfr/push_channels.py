from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings, get_settings
from app.core.nfr.errors import PUSH_CHANNEL_ALL_FAILED
from app.core.nfr.push_config import resolve_push_mode

probe_push_dispatch_budget_ms: int = 100
PUSH_CHANNEL_ORDER: tuple[str, ...] = ()

_PUSH_MOCK_LOG: list[dict] = []


@dataclass(frozen=True)
class PushDispatchResult:
    status: str  # delivered|degraded|failed
    channel: str | None
    attempted_channels: tuple[str, ...]
    degraded_reason: str | None
    code: str | None


def clear_push_mock_log() -> None:
    _PUSH_MOCK_LOG.clear()


def dispatch_push_mock(payload: dict, settings: Settings | None = None) -> PushDispatchResult:
    del payload
    settings = settings or get_settings()
    mode = resolve_push_mode(settings)
    return PushDispatchResult(
        "failed",
        None,
        (),
        mode.degraded_reason or "push channels not configured",
        PUSH_CHANNEL_ALL_FAILED,
    )
