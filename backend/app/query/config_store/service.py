from __future__ import annotations

import json
import uuid

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.query.config_store.models import QueryConfigRecord
from app.query.config_store.schemas import (
    ALLOWED_CONFIG_TYPES,
    ALLOWED_SCHEMA_VERSIONS,
    MAX_CONFIG_PAYLOAD_BYTES,
    ConfigError,
    ConfigUpsert,
    DatasetQueryConfigPayload,
    DEFAULT_REF_TYPE,
)


def _payload_byte_size(payload: object) -> int:
    return len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def _validate_dataset_query_payload(payload: dict) -> None:
    from pydantic import ValidationError

    try:
        DatasetQueryConfigPayload.model_validate(payload)
    except ValidationError as exc:
        fields = [
            {"field": ".".join(str(x) for x in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        raise ConfigError(
            "CONFIG_INVALID_DATASET_QUERY",
            "Invalid dataset_query payload",
            422,
            fields=fields,
        ) from exc


def _validate_upsert(payload: ConfigUpsert) -> None:
    if payload.config_type not in ALLOWED_CONFIG_TYPES:
        raise ConfigError("CONFIG_UNKNOWN_TYPE", f"Unknown config type: {payload.config_type}", 422)
    if payload.schema_version not in ALLOWED_SCHEMA_VERSIONS:
        raise ConfigError("CONFIG_UNKNOWN_SCHEMA_VERSION", "Unknown schema version", 422)
    if not isinstance(payload.payload, dict):
        raise ConfigError("CONFIG_INVALID_PAYLOAD", "Payload must be a JSON object", 422)
    size = _payload_byte_size(payload.payload)
    if size > MAX_CONFIG_PAYLOAD_BYTES:
        raise ConfigError(
            "CONFIG_PAYLOAD_TOO_LARGE",
            f"Payload exceeds {MAX_CONFIG_PAYLOAD_BYTES} bytes",
            413,
            fields=[{"field": "payload", "message": f"size {size} exceeds limit"}],
        )
    if payload.config_type == "dataset_query":
        _validate_dataset_query_payload(payload.payload)


def _resolve_ref_id(payload: ConfigUpsert, ref_type: str, owner_id: uuid.UUID | None) -> uuid.UUID:
    if payload.ref_id is not None:
        return payload.ref_id
    stable = json.dumps(payload.payload, sort_keys=True, separators=(",", ":"))
    seed = f"{payload.config_type}:{ref_type}:{owner_id or ''}:{stable}"
    return uuid.uuid5(uuid.NAMESPACE_URL, seed)


def upsert_config(
    session: Session,
    payload: ConfigUpsert,
    owner_id: uuid.UUID | None = None,
    *,
    auto_commit: bool = True,
) -> QueryConfigRecord:
    _validate_upsert(payload)
    ref_type = payload.ref_type or DEFAULT_REF_TYPE
    ref_id = _resolve_ref_id(payload, ref_type, owner_id)
    stmt = select(QueryConfigRecord).where(
        and_(
            QueryConfigRecord.config_type == payload.config_type,
            QueryConfigRecord.ref_type == ref_type,
            QueryConfigRecord.ref_id == ref_id,
            QueryConfigRecord.schema_version == payload.schema_version,
        )
    )
    existing = session.scalar(stmt)
    if existing is not None:
        if payload.expected_revision is not None and payload.expected_revision != existing.revision:
            raise ConfigError(
                "CONFIG_VERSION_CONFLICT",
                "Config revision conflict",
                409,
                fields=[
                    {
                        "field": "expectedRevision",
                        "message": (
                            f"expected {payload.expected_revision} "
                            f"but current is {existing.revision}"
                        ),
                    }
                ],
            )
        existing.payload = payload.payload
        existing.revision += 1
        if owner_id is not None:
            existing.owner_id = owner_id
        if auto_commit:
            session.commit()
            session.refresh(existing)
        else:
            session.flush()
        return existing
    if payload.expected_revision is not None and payload.expected_revision != 0:
        raise ConfigError(
            "CONFIG_VERSION_CONFLICT",
            "Config revision conflict",
            409,
            fields=[{"field": "expectedRevision", "message": "expected 0 for new config"}],
        )
    record = QueryConfigRecord(
        config_type=payload.config_type,
        schema_version=payload.schema_version,
        ref_type=ref_type,
        ref_id=ref_id,
        owner_id=owner_id,
        payload=payload.payload,
        revision=1,
    )
    session.add(record)
    if auto_commit:
        session.commit()
        session.refresh(record)
    else:
        session.flush()
    return record


def get_config_by_id(session: Session, config_id: uuid.UUID) -> QueryConfigRecord:
    record = session.get(QueryConfigRecord, config_id)
    if record is None:
        raise ConfigError("CONFIG_NOT_FOUND", "Config record not found", 404)
    return record


def list_configs(
    session: Session,
    config_type: str | None = None,
    ref_type: str | None = None,
    ref_id: uuid.UUID | None = None,
    limit: int = 100,
    offset: int = 0,
    actor_id: uuid.UUID | None = None,
    is_admin: bool = True,
) -> tuple[list[QueryConfigRecord], int]:
    capped = min(max(limit, 1), 500)
    base = select(QueryConfigRecord).order_by(QueryConfigRecord.updated_at.desc())
    count_stmt = select(func.count()).select_from(QueryConfigRecord)
    if config_type is not None:
        base = base.where(QueryConfigRecord.config_type == config_type)
        count_stmt = count_stmt.where(QueryConfigRecord.config_type == config_type)
    if ref_type is not None:
        base = base.where(QueryConfigRecord.ref_type == ref_type)
        count_stmt = count_stmt.where(QueryConfigRecord.ref_type == ref_type)
    if ref_id is not None:
        base = base.where(QueryConfigRecord.ref_id == ref_id)
        count_stmt = count_stmt.where(QueryConfigRecord.ref_id == ref_id)
    if not is_admin and actor_id is not None:
        owner_filter = (
            QueryConfigRecord.owner_id.is_(None)
            | (QueryConfigRecord.owner_id == actor_id)
        )
        base = base.where(owner_filter)
        count_stmt = count_stmt.where(owner_filter)
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def list_configs_by_type(session: Session, config_type: str) -> list[QueryConfigRecord]:
    stmt = select(QueryConfigRecord).where(QueryConfigRecord.config_type == config_type)
    return list(session.scalars(stmt))


def delete_config_by_ref(
    session: Session,
    config_type: str,
    ref_type: str,
    ref_id: uuid.UUID,
    schema_version: str = "1.0",
) -> None:
    record = get_config_by_ref(session, config_type, ref_type, ref_id, schema_version)
    session.delete(record)
    session.commit()


def get_config_by_ref(
    session: Session,
    config_type: str,
    ref_type: str,
    ref_id: uuid.UUID,
    schema_version: str = "1.0",
) -> QueryConfigRecord:
    stmt = select(QueryConfigRecord).where(
        and_(
            QueryConfigRecord.config_type == config_type,
            QueryConfigRecord.ref_type == ref_type,
            QueryConfigRecord.ref_id == ref_id,
            QueryConfigRecord.schema_version == schema_version,
        )
    )
    record = session.scalar(stmt)
    if record is None:
        raise ConfigError("CONFIG_NOT_FOUND", "Config record not found", 404)
    return record
