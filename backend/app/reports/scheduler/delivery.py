from __future__ import annotations

from app.core.config import Settings
from app.core.platform_config.slots import EMAIL_SLOT_QQ
from app.reports.scheduler.channels.dispatch import deliver_to_channels
from app.reports.scheduler.delivery_adapter import deliver_artifact as _legacy_deliver

_DELIVERY_LOG: list[dict] = []
_MAX_DELIVERY_LOG = 1000


def dispatch_artifact(
    artifact_ref: str,
    channels: list[str],
    mock_mode: str | None,
    settings: Settings | None = None,
    *,
    session=None,
    recipient_emails: list[str] | None = None,
    artifact_kind: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
    attachment_mime: str | None = None,
    attachments: list[tuple[bytes, str, str]] | None = None,
    email_smtp_slot: str | None = EMAIL_SLOT_QQ,
    **_: object,
) -> dict:
    att_list = attachments or []
    if not att_list and attachment_bytes and attachment_filename:
        att_list = [(attachment_bytes, attachment_mime or "application/pdf", attachment_filename)]
    if len(att_list) > 1:
        result = deliver_to_channels(
            ["email"],
            artifact_ref=artifact_ref,
            artifact_kind=artifact_kind,
            recipient_emails=recipient_emails,
            attachments=att_list,
            mock_mode=mock_mode,
            settings=settings,
            email_smtp_slot=email_smtp_slot,
            session=session,
        )
    else:
        result = _legacy_deliver(
            artifact_ref,
            ["email"],
            mock_mode,
            session,
            recipient_emails=recipient_emails,
            artifact_kind=artifact_kind,
            attachment_bytes=attachment_bytes,
            attachment_filename=attachment_filename,
            attachment_mime=attachment_mime,
            email_smtp_slot=email_smtp_slot,
        )
    if len(_DELIVERY_LOG) >= _MAX_DELIVERY_LOG:
        del _DELIVERY_LOG[: len(_DELIVERY_LOG) - _MAX_DELIVERY_LOG + 1]
    _DELIVERY_LOG.append({"ref": artifact_ref, **result})
    return result
