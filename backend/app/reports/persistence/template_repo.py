"""Template definition persistence."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.persistence import memory_stores
from app.reports.persistence.models import ReportTemplateDefinition


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_metadata_store == "db"


def all_templates() -> dict[str, dict]:
    if not _use_db():
        return memory_stores.template_definitions
    with Session(bind=get_meta_engine()) as db:
        models = db.scalars(select(ReportTemplateDefinition)).all()
        return {m.template_key: dict(m.payload) for m in models}


def get_template(key: str) -> dict | None:
    if not _use_db():
        return memory_stores.template_definitions.get(key)
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportTemplateDefinition, key)
        return dict(model.payload) if model else None


def save_template(key: str, payload: dict) -> None:
    if not _use_db():
        memory_stores.template_definitions[key] = dict(payload)
        return
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportTemplateDefinition, key)
        if model is None:
            db.add(ReportTemplateDefinition(template_key=key, payload=payload))
        else:
            model.payload = payload
        db.commit()


def delete_template(key: str) -> None:
    if not _use_db():
        memory_stores.template_definitions.pop(key, None)
        return
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportTemplateDefinition, key)
        if model is not None:
            db.delete(model)
        db.commit()
