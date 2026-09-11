from __future__ import annotations

from typing import Literal

EmailSmtpSlot = Literal["qq", "163"]

EMAIL_SLOT_QQ: EmailSmtpSlot = "qq"
EMAIL_SLOT_163: EmailSmtpSlot = "163"
EMAIL_SLOTS: tuple[EmailSmtpSlot, ...] = (EMAIL_SLOT_QQ, EMAIL_SLOT_163)

CHANNEL_EMAIL_QQ = "email_qq"
CHANNEL_EMAIL_163 = "email_163"
LEGACY_EMAIL_CHANNEL = "email"

SLOT_TO_CHANNEL: dict[EmailSmtpSlot, str] = {
    EMAIL_SLOT_QQ: CHANNEL_EMAIL_QQ,
    EMAIL_SLOT_163: CHANNEL_EMAIL_163,
}

CHANNEL_TO_SLOT: dict[str, EmailSmtpSlot] = {
    CHANNEL_EMAIL_QQ: EMAIL_SLOT_QQ,
    CHANNEL_EMAIL_163: EMAIL_SLOT_163,
    LEGACY_EMAIL_CHANNEL: EMAIL_SLOT_QQ,
}

SLOT_LABELS: dict[EmailSmtpSlot, str] = {
    EMAIL_SLOT_QQ: "QQ 邮箱",
    EMAIL_SLOT_163: "163 邮箱",
}

SLOT_PRESETS: dict[EmailSmtpSlot, dict[str, str | int]] = {
    EMAIL_SLOT_QQ: {"host": "smtp.qq.com", "port": 587},
    EMAIL_SLOT_163: {"host": "smtp.163.com", "port": 465},
}


def normalize_email_slot(slot: str | None) -> EmailSmtpSlot:
    if slot == EMAIL_SLOT_163:
        return EMAIL_SLOT_163
    return EMAIL_SLOT_QQ


def channel_for_slot(slot: str | None) -> str:
    return SLOT_TO_CHANNEL[normalize_email_slot(slot)]
