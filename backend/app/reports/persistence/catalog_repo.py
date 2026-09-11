"""Catalog node persistence (memory | db)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.datasources.models import get_meta_engine
from app.reports.persistence import memory_stores
from app.reports.persistence.models import ReportCatalogNode, ReportCatalogOwner


def _use_db(settings: Settings | None = None) -> bool:
    return (settings or get_settings()).rpt_metadata_store == "db"


def _row_to_dict(model: ReportCatalogNode) -> dict:
    return {
        "id": model.id,
        "name": model.name,
        "parent_id": model.parent_id,
        "node_type": model.node_type,
        "template_kind": model.template_kind,
        "template_key": model.template_key,
        "sort_order": model.sort_order,
    }


def all_nodes() -> dict[uuid.UUID, dict]:
    if not _use_db():
        return memory_stores.catalog_nodes
    with Session(bind=get_meta_engine()) as db:
        models = db.scalars(select(ReportCatalogNode)).all()
        return {m.id: _row_to_dict(m) for m in models}


def get_node(node_id: uuid.UUID) -> dict | None:
    if not _use_db():
        return memory_stores.catalog_nodes.get(node_id)
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportCatalogNode, node_id)
        return _row_to_dict(model) if model else None


def save_node(row: dict) -> None:
    if not _use_db():
        memory_stores.catalog_nodes[row["id"]] = dict(row)
        return
    with Session(bind=get_meta_engine()) as db:
        model = db.get(ReportCatalogNode, row["id"])
        if model is None:
            model = ReportCatalogNode(id=row["id"])
            db.add(model)
        model.name = row["name"]
        model.parent_id = row.get("parent_id")
        model.node_type = row["node_type"]
        model.template_kind = row.get("template_kind")
        model.template_key = row.get("template_key")
        model.sort_order = row.get("sort_order", 0)
        db.commit()


def delete_node(node_id: uuid.UUID) -> None:
    if not _use_db():
        memory_stores.catalog_nodes.pop(node_id, None)
        memory_stores.catalog_owners.pop(node_id, None)
        return
    with Session(bind=get_meta_engine()) as db:
        from app.auth.cleanup import purge_grants_for_resource

        purge_grants_for_resource(db, resource_type="report", resource_id=node_id)
        model = db.get(ReportCatalogNode, node_id)
        if model is not None:
            db.delete(model)
        owner = db.get(ReportCatalogOwner, node_id)
        if owner is not None:
            db.delete(owner)
        db.commit()


def register_owner(node_id: uuid.UUID, owner_id: str) -> None:
    if not _use_db():
        memory_stores.catalog_owners[node_id] = owner_id
        return
    with Session(bind=get_meta_engine()) as db:
        row = db.get(ReportCatalogOwner, node_id)
        if row is None:
            db.add(ReportCatalogOwner(node_id=node_id, owner_id=owner_id))
        else:
            row.owner_id = owner_id
        db.commit()


def get_owner(node_id: uuid.UUID) -> str | None:
    if not _use_db():
        return memory_stores.catalog_owners.get(node_id)
    with Session(bind=get_meta_engine()) as db:
        row = db.get(ReportCatalogOwner, node_id)
        return row.owner_id if row else None


def count_by_template_key(template_key: str) -> int:
    nodes = all_nodes()
    return sum(1 for raw in nodes.values() if raw.get("template_key") == template_key)
