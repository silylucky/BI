from __future__ import annotations

import time
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.config import get_settings
from app.datasources.models import get_meta_engine
from app.reports.catalog.errors import ReportCatalogError
from app.reports.models import ReportSchedule, ReportScheduleExecution
from app.reports.persistence import artifact_repo, catalog_repo, memory_stores

_NODE_OWNERS = memory_stores.catalog_owners  # test compat
_ARTIFACT_OWNERS = memory_stores.artifact_owners
_ACL_BUDGET_MS = 10


def register_node_owner(node_id: uuid.UUID, actor_id: str) -> None:
    catalog_repo.register_owner(node_id, actor_id)


def _get_artifact_owner(artifact_ref: str) -> str | None:
    owner = artifact_repo.get_owner(artifact_ref)
    if owner is not None:
        return owner
    if get_settings().rpt_schedule_store != "db":
        return None
    with Session(bind=get_meta_engine()) as db:
        execution = db.scalar(
            select(ReportScheduleExecution)
            .where(ReportScheduleExecution.artifact_ref == artifact_ref)
            .limit(1),
        )
        if execution is None:
            return None
        schedule = db.get(ReportSchedule, execution.schedule_id)
        return schedule.owner_id if schedule else None


def assert_catalog_action(actor: UserContext, action: str, node_id: uuid.UUID | None = None) -> None:
    roles = set(actor.roles)
    if actor.is_root:
        return
    if action == "read":
        return
    if action == "create":
        if "editor" not in roles:
            raise ReportCatalogError("RPT_CATALOG_FORBIDDEN", "create requires editor or admin", 403)
        return
    if node_id is None:
        raise ReportCatalogError("RPT_CATALOG_FORBIDDEN", "node required for write action", 403)
    owner = catalog_repo.get_owner(node_id)
    if action == "delete":
        if "owner" in roles and owner == actor.id:
            return
        raise ReportCatalogError("RPT_CATALOG_FORBIDDEN", "delete requires owner or admin", 403)
    if action in {"update", "move"}:
        if "editor" in roles and (owner is None or owner == actor.id):
            return
        if "owner" in roles and owner == actor.id:
            return
        raise ReportCatalogError("RPT_CATALOG_FORBIDDEN", "write requires owner/editor or admin", 403)
    raise ReportCatalogError("RPT_CATALOG_FORBIDDEN", f"action {action} denied", 403)


def probe_acl_budget_ms(actor: UserContext, action: str, node_id: uuid.UUID) -> float:
    start = time.perf_counter()
    assert_catalog_action(actor, action, node_id)
    return (time.perf_counter() - start) * 1000.0


def register_artifact_owner(artifact_ref: str, actor_id: str) -> None:
    artifact_repo.register_owner(artifact_ref, actor_id)


def assert_artifact_access(actor: UserContext, artifact_ref: str) -> None:
    if actor.is_root:
        return
    owner = _get_artifact_owner(artifact_ref)
    if owner is not None and owner == actor.id:
        return
    raise ReportCatalogError("RPT_ARTIFACT_FORBIDDEN", "artifact access denied", 403)
