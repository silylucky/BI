"""Report schedule delivery: email only."""

from __future__ import annotations

from typing import Any

from app.core.config import Settings, get_settings
from app.core.platform_config.resolve import resolve_email_smtp
from app.core.platform_config.slots import EMAIL_SLOT_QQ, normalize_email_slot
from app.reports.scheduler.delivery_adapter import _deliver_explicit_mock, _send_smtp


def deliver_to_channels(
    channels: list[str],
    *,
    artifact_ref: str,
    artifact_kind: str | None,
    recipient_emails: list[str] | None,
    attachments: list[tuple[bytes, str, str]],
    mock_mode: str | None,
    settings: Settings | None = None,
    email_smtp_slot: str | None = EMAIL_SLOT_QQ,
    session=None,
    owner_id=None,
    **_: Any,
) -> dict[str, Any]:
    del session, owner_id
    settings = settings or get_settings()
    if mock_mode is not None:
        return _deliver_explicit_mock(["email"], mock_mode)

    smtp = resolve_email_smtp(slot=normalize_email_slot(email_smtp_slot))
    step = _send_smtp(
        artifact_ref,
        smtp,
        recipient_emails=recipient_emails,
        artifact_kind=artifact_kind,
        attachments=attachments,
    )
    steps = [step]
    delivered = [s for s in steps if s.get("status") == "delivered"]
    failed = [s for s in steps if s.get("status") in {"failed", "degraded"}]
    if delivered and not failed:
        overall = "delivered"
    elif delivered:
        overall = "degraded"
    elif any(s.get("status") == "failed" for s in steps):
        overall = "failed"
    else:
        overall = "unconfigured"
    error = next((s.get("error") for s in steps if s.get("error")), None)
    return {
        "status": overall,
        "attempts": 1,
        "deliverySteps": steps,
        "deliveryMode": "email",
        "error": error,
    }
