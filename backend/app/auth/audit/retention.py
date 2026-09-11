from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.auth.models import AuthAuditEvent

DEFAULT_RETENTION_DAYS = 365


def purge_audit_events_before(
    session: Session,
    *,
    retention_days: int = DEFAULT_RETENTION_DAYS,
    now: datetime | None = None,
) -> int:
    if retention_days < 1:
        raise ValueError("retention_days must be >= 1")
    cutoff = (now or datetime.now(UTC)) - timedelta(days=retention_days)
    result = session.execute(
        delete(AuthAuditEvent).where(AuthAuditEvent.created_at < cutoff)
    )
    return int(result.rowcount or 0)
