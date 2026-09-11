"""Shared gov config persistence via query_config_records."""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError, ConfigUpsert


def _ref_id(namespace: str, key: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"vitalspan:{namespace}:{key}")


def upsert_json(
    session: Session,
    *,
    config_type: str,
    ref_type: str,
    key: str,
    payload: dict,
) -> dict:
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=config_type,
            schema_version="1.0",
            ref_type=ref_type,
            ref_id=_ref_id(config_type, key),
            payload=payload,
        ),
    )
    return record.payload


def get_json(
    session: Session,
    *,
    config_type: str,
    ref_type: str,
    key: str,
) -> dict | None:
    try:
        record = config_store.get_config_by_ref(
            session,
            config_type,
            ref_type,
            _ref_id(config_type, key),
        )
    except ConfigError:
        return None
    return record.payload


def list_json(session: Session, *, config_type: str) -> list[dict]:
    records = config_store.list_configs_by_type(session, config_type)
    return [r.payload for r in records]


def delete_json(
    session: Session,
    *,
    config_type: str,
    ref_type: str,
    key: str,
) -> None:
    config_store.delete_config_by_ref(
        session,
        config_type,
        ref_type,
        _ref_id(config_type, key),
    )


def clear_type(session: Session, config_type: str) -> None:
    records = config_store.list_configs_by_type(session, config_type)
    for rec in records:
        session.delete(rec)
    session.commit()
