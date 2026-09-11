"""Legacy report catalog cleanup (retired template kinds)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.datasources.models import get_meta_engine
from app.reports.models import ReportSchedule, ReportScheduleExecution
from app.reports.persistence import catalog_repo, extension_repo
from app.reports.persistence.models import (
    ReportCatalogNode,
    ReportCatalogOwner,
    ReportExtensionConfig,
    ReportExtensionRevision,
)
from app.reports.scheduler.store import get_schedule_store

LEGACY_WORD_TEMPLATE_KIND = "word"


def _word_node_ids() -> list[uuid.UUID]:
    return [
        node_id
        for node_id, raw in catalog_repo.all_nodes().items()
        if raw.get("template_kind") == LEGACY_WORD_TEMPLATE_KIND
    ]


def _purge_memory_schedules_for_nodes(node_ids: set[uuid.UUID]) -> None:
    store = get_schedule_store()
    for row in store.list_all():
        catalog_id = row.get("catalog_node_id")
        source_id = row.get("source_id")
        if catalog_id in node_ids or source_id in node_ids:
            store.delete(row["id"])


def _purge_memory_nodes(node_ids: list[uuid.UUID]) -> int:
    for node_id in node_ids:
        extension_repo.delete_config(node_id)
        catalog_repo.delete_node(node_id)
    return len(node_ids)


def _purge_db_nodes(node_ids: list[uuid.UUID]) -> int:
    if not node_ids:
        return 0
    with Session(bind=get_meta_engine()) as db:
        db.execute(
            delete(ReportExtensionRevision).where(
                ReportExtensionRevision.catalog_node_id.in_(node_ids),
            ),
        )
        db.execute(
            delete(ReportExtensionConfig).where(
                ReportExtensionConfig.catalog_node_id.in_(node_ids),
            ),
        )
        schedule_ids = list(
            db.scalars(
                select(ReportSchedule.id).where(
                    or_(
                        ReportSchedule.catalog_node_id.in_(node_ids),
                        ReportSchedule.source_id.in_(node_ids),
                    ),
                ),
            ).all(),
        )
        if schedule_ids:
            db.execute(
                delete(ReportScheduleExecution).where(
                    ReportScheduleExecution.schedule_id.in_(schedule_ids),
                ),
            )
            db.execute(delete(ReportSchedule).where(ReportSchedule.id.in_(schedule_ids)))
        db.execute(delete(ReportCatalogOwner).where(ReportCatalogOwner.node_id.in_(node_ids)))
        db.execute(delete(ReportCatalogNode).where(ReportCatalogNode.id.in_(node_ids)))
        db.commit()
    return len(node_ids)


def purge_legacy_word_template_nodes() -> int:
    """Delete catalog nodes with template_kind=word and related metadata."""
    node_ids = _word_node_ids()
    if not node_ids:
        return 0
    id_set = set(node_ids)
    if get_settings().rpt_metadata_store == "db":
        return _purge_db_nodes(node_ids)
    _purge_memory_schedules_for_nodes(id_set)
    return _purge_memory_nodes(node_ids)
