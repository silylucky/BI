from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class PushConfigOut:
    browser_enabled: bool
    wecom_configured: bool
    dingtalk_configured: bool
    delivery_mode: str  # disabled|degraded|active
    degraded_reason: str | None


def validate_push_settings(settings: Settings) -> None:
    del settings


def resolve_push_mode(settings: Settings | None = None) -> PushConfigOut:
    del settings
    return PushConfigOut(
        False,
        False,
        False,
        "disabled",
        "第三方 IM 推送已下线，请使用邮件 SMTP 投递",
    )


def summarize_channel_probe(payload: dict | None = None) -> str:
    del payload
    return "disabled:none"
