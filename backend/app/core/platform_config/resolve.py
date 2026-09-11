from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth.models import get_meta_session
from app.core.config import Settings, get_settings
from app.core.crypto.credentials import decrypt_credential
from app.core.platform_config.models import PlatformDeliveryConfig
from app.core.platform_config.slots import (
    CHANNEL_EMAIL_QQ,
    EMAIL_SLOT_QQ,
    channel_for_slot,
    normalize_email_slot,
)
from app.core.platform_config.smtp_settings import SmtpSettings

_UNCONFIGURED = SmtpSettings("", 0, "", None, None, "none")


def _from_env(settings: Settings) -> SmtpSettings:
    host = settings.rpt_smtp_host.strip()
    from_addr = settings.rpt_smtp_from.strip()
    if not host or not from_addr:
        return _UNCONFIGURED
    return SmtpSettings(
        host=host,
        port=settings.rpt_smtp_port,
        from_addr=from_addr,
        username=(settings.rpt_smtp_user or "").strip() or None,
        password=settings.rpt_smtp_password,
        source="env",
    )


def _from_row(row: PlatformDeliveryConfig) -> SmtpSettings:
    password = None
    if row.password_encrypted:
        password = decrypt_credential(row.password_encrypted)
    return SmtpSettings(
        host=(row.host or "").strip(),
        port=row.port or 587,
        from_addr=(row.from_addr or "").strip(),
        username=(row.username or "").strip() or None,
        password=password,
        source="db",
    )


def resolve_email_smtp(
    session: Session | None = None,
    *,
    slot: str | None = EMAIL_SLOT_QQ,
) -> SmtpSettings:
    normalized = normalize_email_slot(slot)
    channel = channel_for_slot(normalized)
    owns = session is None
    db = session or get_meta_session()
    try:
        row = db.get(PlatformDeliveryConfig, channel)
        if row is None:
            if normalized == EMAIL_SLOT_QQ:
                return _from_env(get_settings())
            return _UNCONFIGURED
        if row.state == "cleared":
            return _UNCONFIGURED
        return _from_row(row)
    finally:
        if owns:
            db.close()
