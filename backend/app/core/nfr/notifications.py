from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.nfr.push_channels import dispatch_push_mock

_store: dict[uuid.UUID, dict] = {}


class NotificationRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: uuid.UUID
    channel: Literal["browser", "dingtalk"] = "browser"
    message: str
    status: Literal["pending", "delivered", "degraded", "failed"] = "pending"
    created_at: str = Field(alias="createdAt")
    delivery: dict | None = None


def clear_notifications() -> None:
    _store.clear()


def create_notification(message: str, channel: str = "browser") -> NotificationRecord:
    nid = uuid.uuid4()
    result = dispatch_push_mock({"text": message})
    status = (
        "delivered"
        if result.status == "delivered"
        else ("degraded" if result.status == "degraded" else "failed")
    )
    row = NotificationRecord(
        id=nid,
        channel=channel,  # type: ignore[arg-type]
        message=message,
        status=status,
        createdAt=datetime.now(UTC).isoformat(),
        delivery={
            "status": result.status,
            "channel": result.channel,
            "attemptedChannels": list(result.attempted_channels),
            "code": result.code,
        },
    )
    _store[nid] = row.model_dump(by_alias=True, mode="json")
    return row


def get_notification(notification_id: uuid.UUID) -> NotificationRecord:
    raw = _store.get(notification_id)
    if raw is None:
        raise KeyError(notification_id)
    return NotificationRecord.model_validate(raw)
