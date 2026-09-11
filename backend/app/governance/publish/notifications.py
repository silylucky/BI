from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.core.nfr.push_channels import dispatch_push_mock
from app.core.nfr.push_config import resolve_push_mode

_PUBLISH_NOTIFICATIONS: list["PublishNotificationEvent"] = []


@dataclass
class PublishNotificationEvent:
    id: str
    entry_id: uuid.UUID
    event_type: str  # submitted|approved|rejected
    timestamp: str
    delivery_mode: str
    notification_status: str  # queued|delivered|degraded
    message: str


def clear_notifications() -> None:
    _PUBLISH_NOTIFICATIONS.clear()


def emit_publish_notification(
    entry_id: uuid.UUID,
    event_type: str,
    *,
    actor: str | None = None,
) -> PublishNotificationEvent:
    _ = actor
    mode = resolve_push_mode()
    dispatch = dispatch_push_mock({"text": f"publish {event_type} {entry_id}"})
    if mode.delivery_mode == "active" and dispatch.status == "delivered":
        status = "delivered"
        message = f"{event_type} notification delivered via {dispatch.channel}"
    else:
        status = "degraded"
        message = f"{event_type} notification degraded: {mode.degraded_reason or dispatch.degraded_reason}"
    event = PublishNotificationEvent(
        id=uuid.uuid4().hex,
        entry_id=entry_id,
        event_type=event_type,
        timestamp=datetime.now(timezone.utc).isoformat(),
        delivery_mode=mode.delivery_mode,
        notification_status=status,
        message=message,
    )
    _PUBLISH_NOTIFICATIONS.append(event)
    return event


def list_notifications(entry_id: uuid.UUID) -> list[PublishNotificationEvent]:
    return [e for e in _PUBLISH_NOTIFICATIONS if e.entry_id == entry_id]
