from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from app.core.platform_config.resolve import resolve_email_smtp
from app.core.platform_config.slots import EMAIL_SLOT_QQ, normalize_email_slot
from app.core.platform_config.smtp_probe import connect_smtp, format_smtp_error, probe_smtp_connection
from app.core.platform_config.smtp_settings import SmtpSettings

logger = logging.getLogger(__name__)


_ARTIFACT_EMAIL: dict[str, tuple[str, str]] = {
    "visual_snapshot": (
        "VitalSpan 看板定时报告（可视化快照）",
        "见附件 PDF：看板/大屏画布可视化快照。",
    ),
    "visual_snapshot_full_page": (
        "VitalSpan 看板定时报告（高清整页快照）",
        "见附件 PDF：看板整页高清可视化快照。",
    ),
    "visual_snapshot_per_widget": (
        "VitalSpan 看板定时报告（按组件分页）",
        "见附件 PDF《按组件分页》：每个看板组件单独一页，避免图表被拦腰切断。",
    ),
    "visual_snapshot_combined": (
        "VitalSpan 看板定时报告（总览 + 组件放大）",
        "见附件 PDF：前半为整页总览，后半为每个组件放大分页，便于阅读数据细节。",
    ),
    "visual_snapshot_bundle": (
        "VitalSpan 看板定时报告（整页长图 + 按组件分页）",
        "见附件两份 PDF：\n"
        "1.《整页长图》— 单页连续完整画布\n"
        "2.《按组件分页》— 每个组件单独一页",
    ),
    "layout_inventory": (
        "VitalSpan 看板定时报告（布局摘要预览）",
        "附件为看板组件布局清单 PDF/CSV（历史或降级产物），非图表渲染快照。\n\n下载引用：{ref}",
    ),
    "template_render": (
        "VitalSpan 报表定时报告",
        "报表已生成，附件引用如下：\n\n{ref}",
    ),
    "standard_render": (
        "VitalSpan 标准分析定时报告",
        "标准分析结果已生成，见附件 PDF。\n\n下载引用：{ref}",
    ),
}


def _send_smtp(
    artifact_ref: str,
    smtp: SmtpSettings,
    *,
    recipient_emails: list[str] | None = None,
    artifact_kind: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
    attachment_mime: str | None = None,
    attachments: list[tuple[bytes, str, str]] | None = None,
) -> dict:
    if not smtp.is_configured:
        return {
            "channel": "email",
            "status": "failed",
            "attempt": 1,
            "mode": "smtp",
            "error": "SMTP 未配置：请在系统管理 → 平台对接配置邮件发信。",
            "recipients": recipient_emails or [],
        }
    if not recipient_emails:
        return {
            "channel": "email",
            "status": "failed",
            "attempt": 1,
            "mode": "smtp",
            "error": "未解析到有效收件邮箱：请配置接收人（直接填邮箱或确保角色/用户资料含真实邮箱）。",
            "recipients": [],
        }
    to_addrs = recipient_emails
    subject, body_tpl = _ARTIFACT_EMAIL.get(
        artifact_kind or "",
        ("VitalSpan scheduled report", "Report artifact: {ref}"),
    )
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp.from_addr
    msg["To"] = ", ".join(to_addrs)
    body = body_tpl.format(ref=artifact_ref) if "{ref}" in body_tpl else body_tpl
    msg.set_content(body)
    att_list = attachments or []
    if not att_list and attachment_bytes and attachment_filename:
        att_list = [(attachment_bytes, attachment_mime or "application/pdf", attachment_filename)]
    for att_bytes, att_mime, att_name in att_list:
        maintype, _, subtype = (att_mime or "application/pdf").partition("/")
        subtype = subtype or "octet-stream"
        msg.add_attachment(att_bytes, maintype=maintype, subtype=subtype, filename=att_name)
    try:
        with connect_smtp(smtp, timeout=5) as conn:
            if smtp.username and smtp.password:
                conn.login(smtp.username, smtp.password)
            conn.send_message(msg)
    except OSError as exc:
        error = format_smtp_error(exc, smtp)
        logger.warning("SMTP delivery failed: %s", error)
        return {
            "channel": "email",
            "status": "failed",
            "attempt": 1,
            "mode": "smtp",
            "error": error,
            "recipients": to_addrs,
        }
    except smtplib.SMTPAuthenticationError as exc:
        error = f"SMTP 认证失败：请检查发件账号与授权码。{exc.smtp_code}"
        return {
            "channel": "email",
            "status": "failed",
            "attempt": 1,
            "mode": "smtp",
            "error": error,
            "recipients": to_addrs,
        }
    except UnicodeEncodeError:
        error = "登录用户名须为完整邮箱地址（通常与发件人相同），不能包含中文。"
        return {
            "channel": "email",
            "status": "failed",
            "attempt": 1,
            "mode": "smtp",
            "error": error,
            "recipients": to_addrs,
        }
    return {
        "channel": "email",
        "status": "delivered",
        "attempt": 1,
        "mode": "smtp",
        "recipients": to_addrs,
    }


def _deliver_explicit_mock(channels: list[str], mock_mode: str) -> dict:
    channel_list = channels or ["email"]
    steps: list[dict] = []
    overall = "delivered"
    attempts = 1
    first_channel = channel_list[0]
    mode = mock_mode.strip().lower()
    for channel in channel_list:
        if mode == "fail" and channel == first_channel:
            steps.append({"channel": channel, "status": "failed", "attempt": 1, "mode": "mock"})
            overall = "degraded"
            continue
        if mode == "retry" and channel == first_channel:
            steps.append({"channel": channel, "status": "failed", "attempt": 1, "mode": "mock"})
            steps.append({"channel": channel, "status": "delivered", "attempt": 2, "mode": "mock"})
            attempts = 2
            continue
        steps.append({"channel": channel, "status": "delivered", "attempt": 1, "mode": "mock"})
    return {
        "status": overall,
        "attempts": attempts,
        "deliverySteps": steps,
        "deliveryMode": "mock",
    }


def probe_smtp_health(session: Session | None = None, *, slot: str | None = EMAIL_SLOT_QQ) -> dict:
    smtp = resolve_email_smtp(session, slot=normalize_email_slot(slot))
    result = probe_smtp_connection(smtp)
    return {**result, "slot": normalize_email_slot(slot)}


def probe_all_smtp_health(session: Session | None = None) -> dict[str, dict]:
    from app.core.platform_config.slots import EMAIL_SLOTS

    slots = {slot: probe_smtp_health(session, slot=slot) for slot in EMAIL_SLOTS}
    primary = slots[EMAIL_SLOT_QQ]
    return {**primary, "slots": slots}


def deliver_artifact(
    artifact_ref: str,
    channels: list[str],
    mock_mode: str | None,
    session: Session | None = None,
    *,
    recipient_emails: list[str] | None = None,
    artifact_kind: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
    attachment_mime: str | None = None,
    email_smtp_slot: str | None = EMAIL_SLOT_QQ,
) -> dict:
    channel_list = channels or ["email"]
    if mock_mode is not None:
        return _deliver_explicit_mock(channel_list, mock_mode)
    smtp = resolve_email_smtp(session, slot=normalize_email_slot(email_smtp_slot))
    step = _send_smtp(
        artifact_ref,
        smtp,
        recipient_emails=recipient_emails,
        artifact_kind=artifact_kind,
        attachment_bytes=attachment_bytes,
        attachment_filename=attachment_filename,
        attachment_mime=attachment_mime,
    )
    steps = [step]
    if step["status"] == "delivered":
        overall = "delivered"
    elif not smtp.is_configured:
        overall = "unconfigured"
    else:
        overall = "degraded"
    error = step.get("error") if step["status"] != "delivered" else None
    return {
        "status": overall,
        "attempts": 1,
        "deliverySteps": steps,
        "deliveryMode": "smtp",
        "error": error,
        "source": smtp.source,
    }
