from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.integration.models import IntegrationIdempotencyRecord

_DEFAULT_TTL_SEC = 86400


def get_cached(db: Session, cache_key: str) -> dict | None:
    _purge_expired(db)
    row = db.get(IntegrationIdempotencyRecord, cache_key)
    if row is None:
        return None
    exp = row.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=UTC)
    if datetime.now(UTC) > exp:
        db.delete(row)
        db.commit()
        return None
    return row.response_json


def put_cached(
    db: Session,
    cache_key: str,
    response: dict,
    *,
    ttl_sec: int = _DEFAULT_TTL_SEC,
) -> None:
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl_sec)
    row = IntegrationIdempotencyRecord(
        cache_key=cache_key,
        response_json=response,
        expires_at=expires_at,
    )
    db.merge(row)
    db.commit()


def _purge_expired(db: Session) -> None:
    now = datetime.now(UTC)
    db.execute(delete(IntegrationIdempotencyRecord).where(IntegrationIdempotencyRecord.expires_at < now))
    db.commit()


def clear_all(db: Session) -> None:
    db.execute(delete(IntegrationIdempotencyRecord))
    db.commit()
