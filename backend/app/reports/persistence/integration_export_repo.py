"""Integration report export persistence (memory | db)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.artifact_store import artifact_storage_key, get_artifact_store
from app.reports.persistence import memory_stores
from app.reports.persistence.models import ReportIntegrationExport


@dataclass
class IntegrationExportRecord:
    export_id: uuid.UUID
    template_id: uuid.UUID
    fmt: str
    status: str
    bytes_data: bytes | None
    content_type: str | None
    expires_at: datetime
    requested_at: datetime
    trace_id: str


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_metadata_store == "db"


def _ext(fmt: str) -> str:
    if fmt == "excel":
        return "xlsx"
    return fmt


def save_export(record: IntegrationExportRecord) -> None:
    if not _use_db():
        memory_stores.integration_exports[record.export_id] = {
            "export_id": record.export_id,
            "template_id": record.template_id,
            "fmt": record.fmt,
            "status": record.status,
            "bytes_data": record.bytes_data,
            "content_type": record.content_type,
            "expires_at": record.expires_at,
            "requested_at": record.requested_at,
            "trace_id": record.trace_id,
        }
        return
    storage_key: str | None = None
    if record.bytes_data is not None:
        storage_key = artifact_storage_key("integration-export", record.export_id, _ext(record.fmt))
        get_artifact_store().put(storage_key, record.bytes_data, record.content_type or "application/octet-stream")
    with Session(bind=get_meta_engine()) as db:
        db.add(ReportIntegrationExport(
            export_id=record.export_id,
            template_id=record.template_id,
            fmt=record.fmt,
            status=record.status,
            storage_key=storage_key,
            content_type=record.content_type,
            expires_at=record.expires_at,
            requested_at=record.requested_at,
            trace_id=record.trace_id,
        ))
        db.commit()


def get_export(export_id: uuid.UUID) -> IntegrationExportRecord | None:
    if not _use_db():
        raw = memory_stores.integration_exports.get(export_id)
        if raw is None:
            return None
        return IntegrationExportRecord(**raw)
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportIntegrationExport, export_id)
        if model is None:
            return None
        bytes_data = None
        if model.storage_key:
            bytes_data = get_artifact_store().get(model.storage_key)
        return IntegrationExportRecord(
            export_id=model.export_id,
            template_id=model.template_id,
            fmt=model.fmt,
            status=model.status,
            bytes_data=bytes_data,
            content_type=model.content_type,
            expires_at=_ensure_utc(model.expires_at),
            requested_at=_ensure_utc(model.requested_at),
            trace_id=model.trace_id,
        )


def read_export_bytes(export_id: uuid.UUID) -> bytes | None:
    record = get_export(export_id)
    if record is None or record.status != "ready":
        return None
    return record.bytes_data
