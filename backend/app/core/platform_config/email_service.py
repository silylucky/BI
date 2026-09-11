from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.core.crypto.credentials import decrypt_credential, encrypt_credential
from app.core.platform_config.models import AUDIT_TARGET_BY_CHANNEL, PlatformDeliveryConfig
from app.core.platform_config.resolve import resolve_email_smtp
from app.core.platform_config.schemas import EmailDeliveryConfigOut, EmailDeliveryConfigPut, EmailDeliverySlotsOut
from app.core.platform_config.slots import (
    EMAIL_SLOTS,
    SLOT_LABELS,
    channel_for_slot,
    normalize_email_slot,
)
from app.core.platform_config.smtp_probe import normalize_smtp_username, probe_smtp_connection
from app.core.platform_config.smtp_settings import SmtpSettings


class PlatformConfigError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _row_or_none(session: Session, slot: str) -> PlatformDeliveryConfig | None:
    return session.get(PlatformDeliveryConfig, channel_for_slot(slot))


def _effective_source(session: Session, slot: str) -> str:
    row = _row_or_none(session, slot)
    normalized = normalize_email_slot(slot)
    if row is None:
        if normalized == "qq" and resolve_email_smtp(session, slot=normalized).source == "env":
            return "env"
        return "none"
    if row.state == "cleared":
        return "none"
    return "db"


def get_email_config(session: Session, slot: str, *, probe: bool = True) -> EmailDeliveryConfigOut:
    normalized = normalize_email_slot(slot)
    row = _row_or_none(session, normalized)
    smtp = resolve_email_smtp(session, slot=normalized)
    source = _effective_source(session, normalized)
    configured = smtp.is_configured and source != "none"
    probe_result = probe_smtp_connection(smtp) if probe and configured else None
    if probe_result and probe_result["status"] != "reachable":
        configured = False
    return EmailDeliveryConfigOut(
        slot=normalized,
        label=SLOT_LABELS[normalized],
        configured=configured,
        source=source,
        host=row.host if row and row.state == "active" else (smtp.host if source == "env" else None),
        port=row.port if row and row.state == "active" else (smtp.port if source == "env" else None),
        from_addr=row.from_addr if row and row.state == "active" else (smtp.from_addr if source == "env" else None),
        username=row.username if row and row.state == "active" else (smtp.username if source == "env" else None),
        has_password=bool(
            (row and row.state == "active" and row.password_encrypted)
            or (source == "env" and smtp.password)
        ),
        probe_status=probe_result["status"] if probe_result else None,
        probe_error=probe_result.get("error") if probe_result else None,
    )


def list_email_configs(session: Session, *, probe: bool = True) -> EmailDeliverySlotsOut:
    return EmailDeliverySlotsOut(
        items=[get_email_config(session, slot, probe=probe) for slot in EMAIL_SLOTS],
    )


def save_email_config(
    session: Session,
    slot: str,
    payload: EmailDeliveryConfigPut,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> EmailDeliveryConfigOut:
    normalized = normalize_email_slot(slot)
    channel = channel_for_slot(normalized)
    row = _row_or_none(session, normalized)
    existing_cipher = row.password_encrypted if row and row.state == "active" else None
    password = payload.password
    if not password:
        if existing_cipher:
            password = decrypt_credential(existing_cipher)
        else:
            raise PlatformConfigError(
                "PLATFORM_SMTP_PASSWORD_REQUIRED",
                "首次保存须填写 SMTP 密码或授权码",
                422,
            )
    smtp = SmtpSettings(
        host=payload.host.strip(),
        port=payload.port,
        from_addr=payload.from_addr.strip(),
        username=None,
        password=password,
        source="db",
    )
    try:
        smtp_username = normalize_smtp_username(payload.username, smtp.from_addr)
    except ValueError as exc:
        raise PlatformConfigError("PLATFORM_SMTP_USERNAME_INVALID", str(exc), 422) from exc
    smtp = SmtpSettings(
        host=smtp.host,
        port=smtp.port,
        from_addr=smtp.from_addr,
        username=smtp_username,
        password=password,
        source="db",
    )
    probe = probe_smtp_connection(smtp)
    if probe["status"] != "reachable":
        raise PlatformConfigError(
            "PLATFORM_SMTP_PROBE_FAILED",
            probe.get("error") or "SMTP 探测失败",
            422,
        )
    if row is None:
        row = PlatformDeliveryConfig(channel=channel, state="active")
        session.add(row)
    else:
        row.state = "active"
    row.host = smtp.host
    row.port = smtp.port
    row.from_addr = smtp.from_addr
    row.username = smtp.username
    if payload.password:
        row.password_encrypted = encrypt_credential(payload.password)
    row.updated_by = uuid.UUID(actor_id)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="platform_delivery",
        target_id=AUDIT_TARGET_BY_CHANNEL[channel],
        action=f"platform_connect.email.{normalized}.save",
        detail={"channel": channel, "slot": normalized, "host": row.host, "port": row.port},
        trace_id=trace_id,
    )
    session.commit()
    return get_email_config(session, normalized, probe=False)


def clear_email_config(
    session: Session,
    slot: str,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> EmailDeliveryConfigOut:
    normalized = normalize_email_slot(slot)
    channel = channel_for_slot(normalized)
    row = _row_or_none(session, normalized)
    if row is None:
        row = PlatformDeliveryConfig(channel=channel, state="cleared")
        session.add(row)
    row.state = "cleared"
    row.host = None
    row.port = None
    row.from_addr = None
    row.username = None
    row.password_encrypted = None
    row.updated_by = uuid.UUID(actor_id)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="platform_delivery",
        target_id=AUDIT_TARGET_BY_CHANNEL[channel],
        action=f"platform_connect.email.{normalized}.clear",
        detail={"channel": channel, "slot": normalized},
        trace_id=trace_id,
    )
    session.commit()
    return get_email_config(session, normalized, probe=False)
