from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.integration.models import EmbedTokenRecord


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def save_token(db: Session, token: str, expires_at: datetime, payload: dict) -> None:
    row = EmbedTokenRecord(token=token, expires_at=_aware(expires_at), payload=payload)
    db.merge(row)
    db.commit()


def get_token(db: Session, token: str) -> tuple[datetime, dict] | None:
    _purge_expired(db)
    row = db.get(EmbedTokenRecord, token)
    if row is None:
        return None
    exp = _aware(row.expires_at)
    if datetime.now(UTC) > exp:
        db.delete(row)
        db.commit()
        return None
    meta = dict(row.payload)
    meta["expires_at"] = exp
    return exp, meta


def _purge_expired(db: Session) -> None:
    now = datetime.now(UTC)
    db.execute(delete(EmbedTokenRecord).where(EmbedTokenRecord.expires_at < now))
    db.commit()


def clear_all(db: Session) -> None:
    db.execute(delete(EmbedTokenRecord))
    db.commit()
