#!/usr/bin/env python3
"""Purge auth audit events older than retention window (default 365 days)."""

from __future__ import annotations

import argparse
import os
import sys

BACKEND = os.path.join(os.path.dirname(__file__), "..", "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

from app.auth.audit.retention import DEFAULT_RETENTION_DAYS, purge_audit_events_before
from app.auth.models import get_meta_session


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge aged auth_audit_events rows")
    parser.add_argument(
        "--days",
        type=int,
        default=int(os.environ.get("AUTH_AUDIT_RETENTION_DAYS", DEFAULT_RETENTION_DAYS)),
        help="Retention window in days (default: env AUTH_AUDIT_RETENTION_DAYS or 365)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count only; do not delete",
    )
    args = parser.parse_args()
    if args.days < 1:
        print("days must be >= 1", file=sys.stderr)
        return 2

    session = get_meta_session()
    try:
        if args.dry_run:
            from datetime import UTC, datetime, timedelta

            from sqlalchemy import func, select

            from app.auth.models import AuthAuditEvent

            cutoff = datetime.now(UTC) - timedelta(days=args.days)
            count = session.scalar(
                select(func.count())
                .select_from(AuthAuditEvent)
                .where(AuthAuditEvent.created_at < cutoff)
            )
            print(f"would_delete={count or 0} retention_days={args.days}")
            return 0

        deleted = purge_audit_events_before(session, retention_days=args.days)
        session.commit()
        print(f"deleted={deleted} retention_days={args.days}")
        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
