from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import AuthRole, AuthUser, AuthUserRole
from app.auth.profile.service import _email as user_email
from app.reports.scheduler.errors import ScheduleError
from app.reports.scheduler.schemas import ScheduleRecipientIn

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_recipients(raw: list[dict] | list[ScheduleRecipientIn]) -> list[ScheduleRecipientIn]:
    out: list[ScheduleRecipientIn] = []
    for item in raw:
        if isinstance(item, ScheduleRecipientIn):
            out.append(item)
        else:
            out.append(ScheduleRecipientIn.model_validate(item))
    return out


def resolve_recipient_emails(session: Session, recipients: list[ScheduleRecipientIn]) -> list[str]:
    emails: list[str] = []
    seen: set[str] = set()
    for recipient in recipients:
        if recipient.type == "email":
            addr = recipient.value.strip()
            if not _EMAIL_RE.match(addr):
                raise ScheduleError(
                    "RPT_SCHEDULE_RECIPIENT_INVALID",
                    f"Invalid email: {recipient.value}",
                    422,
                )
            if addr.lower() not in seen:
                seen.add(addr.lower())
                emails.append(addr)
            continue
        if recipient.type == "user":
            user = None
            try:
                user_id = uuid.UUID(recipient.value)
                user = session.get(AuthUser, user_id)
            except ValueError:
                user = session.scalar(
                    select(AuthUser).where(AuthUser.username == recipient.value),
                )
            if user is None:
                raise ScheduleError(
                    "RPT_SCHEDULE_RECIPIENT_NOT_FOUND",
                    f"User not found: {recipient.value}",
                    404,
                )
            addr = user_email(user)
            if addr.lower() not in seen:
                seen.add(addr.lower())
                emails.append(addr)
            continue
        if recipient.type == "role":
            rows = session.scalars(
                select(AuthUser)
                .join(AuthUserRole, AuthUserRole.user_id == AuthUser.id)
                .join(AuthRole, AuthRole.id == AuthUserRole.role_id)
                .where(AuthRole.code == recipient.value, AuthRole.is_active.is_(True)),
            ).all()
            if not rows:
                raise ScheduleError(
                    "RPT_SCHEDULE_RECIPIENT_NOT_FOUND",
                    f"No users for role: {recipient.value}",
                    404,
                )
            for user in rows:
                addr = user_email(user)
                if addr.lower() not in seen:
                    seen.add(addr.lower())
                    emails.append(addr)
    return emails


def validate_recipients_present(recipients: list[ScheduleRecipientIn] | list[dict]) -> list[ScheduleRecipientIn]:
    normalized = _normalize_recipients(recipients)
    if not normalized:
        raise ScheduleError(
            "RPT_SCHEDULE_RECIPIENT_REQUIRED",
            "At least one recipient is required",
            422,
        )
    return normalized
