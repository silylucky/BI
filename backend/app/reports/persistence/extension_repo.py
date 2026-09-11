"""Extension config persistence."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.persistence import memory_stores
from app.reports.persistence.models import ReportExtensionConfig, ReportExtensionRevision


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_metadata_store == "db"


def get_config(node_id: uuid.UUID) -> dict | None:
    if not _use_db():
        return memory_stores.extension_configs.get(node_id)
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportExtensionConfig, node_id)
        if model is None:
            return None
        return {
            "catalog_node_id": model.catalog_node_id,
            "metrics": model.metrics or [],
            "filters": model.filters or [],
            "change_note": model.change_note,
            "default_data_source_id": model.default_data_source_id,
            "revision": model.revision,
        }


def save_config(node_id: uuid.UUID, record: dict) -> None:
    if not _use_db():
        memory_stores.extension_configs[node_id] = dict(record)
        return
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportExtensionConfig, node_id)
        if model is None:
            model = ReportExtensionConfig(catalog_node_id=node_id)
            db.add(model)
        model.metrics = record.get("metrics") or []
        model.filters = record.get("filters") or []
        model.change_note = record.get("change_note")
        model.default_data_source_id = record.get("default_data_source_id")
        model.revision = record.get("revision", 1)
        db.commit()


def delete_config(node_id: uuid.UUID) -> None:
    if not _use_db():
        memory_stores.extension_configs.pop(node_id, None)
        return
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportExtensionConfig, node_id)
        if model is not None:
            db.delete(model)
        db.commit()


def append_audit(node_id: uuid.UUID, change_note: str, revision: int) -> None:
    entry = {
        "nodeId": str(node_id),
        "changeNote": change_note,
        "updatedAt": datetime.now(UTC).isoformat(),
    }
    if not _use_db():
        memory_stores.extension_audit.append(entry)
        return
    with Session(bind=get_meta_engine()) as db:
        db.add(ReportExtensionRevision(
            catalog_node_id=node_id,
            revision=revision,
            change_note=change_note,
        ))
        db.commit()


def list_audit(node_id: uuid.UUID) -> list[dict]:
    if not _use_db():
        return [e for e in memory_stores.extension_audit if e.get("nodeId") == str(node_id)]
    with Session(bind=get_meta_engine()) as db:
        models = db.scalars(
            select(ReportExtensionRevision)
            .where(ReportExtensionRevision.catalog_node_id == node_id)
            .order_by(ReportExtensionRevision.updated_at.desc()),
        ).all()
        return [{
            "revision": m.revision,
            "changeNote": m.change_note,
            "updatedAt": m.updated_at.isoformat() if m.updated_at else "",
        } for m in models]
