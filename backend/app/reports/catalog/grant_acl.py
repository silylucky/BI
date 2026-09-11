"""Report catalog node visibility via resource grants (resource_type=report)."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.resources.service import (
    VisibilityError,
    ensure_resource_visible,
    list_visible_resource_ids,
)
from app.reports.catalog.errors import ReportCatalogError
from app.reports.persistence import catalog_repo

RESOURCE_TYPE = "report"


def list_readable_node_ids(session: Session, actor: UserContext) -> set[uuid.UUID] | None:
    """None means all nodes visible (root)."""
    if actor.is_root:
        return None
    visible = set(
        list_visible_resource_ids(session, actor.roles, RESOURCE_TYPE, user_id=actor.id)
    )
    for node_id in catalog_repo.all_nodes():
        if catalog_repo.get_owner(node_id) == actor.id:
            visible.add(node_id)
    return visible


def assert_node_readable(session: Session, actor: UserContext, node_id: uuid.UUID) -> None:
    if actor.is_root:
        return
    owner = catalog_repo.get_owner(node_id)
    if owner is not None and owner == actor.id:
        return
    try:
        ensure_resource_visible(
            session, actor.roles, RESOURCE_TYPE, node_id, user_id=actor.id
        )
    except VisibilityError as exc:
        raise ReportCatalogError("RPT_CATALOG_FORBIDDEN", "Catalog node access denied", 403) from exc


def filter_readable_nodes(
    session: Session,
    actor: UserContext,
    node_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    visible = list_readable_node_ids(session, actor)
    if visible is None:
        return node_ids
    return [nid for nid in node_ids if nid in visible]


__all__ = [
    "RESOURCE_TYPE",
    "assert_node_readable",
    "filter_readable_nodes",
    "list_readable_node_ids",
]
