"""Artifact owner persistence (memory | db)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.persistence import memory_stores
from app.reports.persistence.models import ReportArtifactOwner


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_metadata_store == "db"


def register_owner(artifact_ref: str, owner_id: str) -> None:
    memory_stores.artifact_owners[artifact_ref] = owner_id
    if not _use_db():
        return
    with Session(bind=get_meta_engine()) as db:
        row = db.get(ReportArtifactOwner, artifact_ref)
        if row is None:
            db.add(ReportArtifactOwner(artifact_ref=artifact_ref, owner_id=owner_id))
        else:
            row.owner_id = owner_id
        db.commit()


def get_owner(artifact_ref: str) -> str | None:
    cached = memory_stores.artifact_owners.get(artifact_ref)
    if cached is not None:
        return cached
    if not _use_db():
        return None
    with Session(bind=get_meta_engine()) as db:
        row = db.get(ReportArtifactOwner, artifact_ref)
        if row is None:
            return None
        memory_stores.artifact_owners[artifact_ref] = row.owner_id
        return row.owner_id
