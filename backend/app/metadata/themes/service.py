from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.metadata._acl import _assert_meta_write
from app.metadata.glossary import service as glossary_service
from app.metadata.glossary.schemas import GlossaryError
from app.metadata.themes.models import ThemeNode
from app.metadata.themes.schemas import (
    MAX_THEME_DEPTH,
    META_THEME_FORBIDDEN,
    ThemeCreate,
    ThemeError,
    ThemeUpdate,
)

probe_list_themes_budget_ms_limit = 50


@dataclass(frozen=True)
class ThemeProbeResult:
    elapsed_ms: float
    ok: bool


def _forbidden() -> ThemeError:
    return ThemeError(META_THEME_FORBIDDEN, "insufficient role to modify theme nodes", 403)


def _node_depth(session: Session, node_id: uuid.UUID | None) -> int:
    if node_id is None:
        return 0
    depth = 0
    current: uuid.UUID | None = node_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current in seen:
            break
        seen.add(current)
        depth += 1
        if depth > MAX_THEME_DEPTH:
            break
        node = session.get(ThemeNode, current)
        if node is None:
            break
        current = node.parent_id
    return depth


def _subtree_height(session: Session, node_id: uuid.UUID) -> int:
    max_h = 0
    level = [node_id]
    while level:
        max_h += 1
        if max_h > MAX_THEME_DEPTH:
            break
        next_level: list[uuid.UUID] = []
        for nid in level:
            next_level.extend(
                session.scalars(select(ThemeNode.id).where(ThemeNode.parent_id == nid))
            )
        level = list(next_level)
    return max_h


def _assert_depth_allowed(
    session: Session,
    parent_id: uuid.UUID | None,
    subtree_root: uuid.UUID | None = None,
) -> None:
    parent_depth = _node_depth(session, parent_id)
    extra = _subtree_height(session, subtree_root) if subtree_root else 1
    if parent_depth + extra > MAX_THEME_DEPTH:
        raise ThemeError(
            "META_THEME_MAX_DEPTH",
            f"Theme tree depth cannot exceed {MAX_THEME_DEPTH}",
            422,
            fields=[{"field": "parentId", "message": f"max depth is {MAX_THEME_DEPTH}"}],
        )


def _collect_descendant_ids(session: Session, node_id: uuid.UUID) -> set[uuid.UUID]:
    descendants: set[uuid.UUID] = set()
    frontier = [node_id]
    while frontier:
        current = frontier.pop()
        children = session.scalars(select(ThemeNode.id).where(ThemeNode.parent_id == current))
        for child_id in children:
            if child_id not in descendants:
                descendants.add(child_id)
                frontier.append(child_id)
    return descendants


def _resolve_parent_id(parent_id: uuid.UUID | None | str) -> uuid.UUID | None | str:
    if parent_id == "null" or parent_id is None:
        return parent_id
    if isinstance(parent_id, str):
        try:
            return uuid.UUID(parent_id)
        except ValueError as exc:
            raise ThemeError("META_THEME_INVALID_PARENT", "Invalid parent id", 422) from exc
    return parent_id


def list_theme_nodes(
    session: Session,
    parent_id: uuid.UUID | None | str = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[ThemeNode], int]:
    parent_id = _resolve_parent_id(parent_id)
    capped = min(max(limit, 1), 500)
    base = select(ThemeNode).order_by(ThemeNode.sort_order, ThemeNode.name)
    count_stmt = select(func.count()).select_from(ThemeNode)
    if parent_id == "null":
        base = base.where(ThemeNode.parent_id.is_(None))
        count_stmt = count_stmt.where(ThemeNode.parent_id.is_(None))
    elif parent_id is not None:
        base = base.where(ThemeNode.parent_id == parent_id)
        count_stmt = count_stmt.where(ThemeNode.parent_id == parent_id)
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def create_theme_node(session: Session, payload: ThemeCreate, user: UserContext) -> ThemeNode:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    if payload.parent_id is not None and session.get(ThemeNode, payload.parent_id) is None:
        raise ThemeError("META_THEME_PARENT_NOT_FOUND", "Parent node not found", 404)
    if payload.term_id is not None:
        try:
            glossary_service.get_term(session, payload.term_id)
        except GlossaryError as exc:
            raise ThemeError(exc.code, exc.message, exc.status) from exc
    _assert_depth_allowed(session, payload.parent_id)
    node = ThemeNode(
        name=payload.name,
        code=payload.code,
        parent_id=payload.parent_id,
        term_id=payload.term_id,
        sort_order=payload.sort_order,
    )
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def get_theme_node(session: Session, node_id: uuid.UUID) -> ThemeNode:
    node = session.get(ThemeNode, node_id)
    if node is None:
        raise ThemeError("META_THEME_NOT_FOUND", "Theme node not found", 404)
    return node


def update_theme_node(
    session: Session, node_id: uuid.UUID, payload: ThemeUpdate, user: UserContext,
) -> ThemeNode:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    node = get_theme_node(session, node_id)
    if payload.term_id is not None:
        try:
            glossary_service.get_term(session, payload.term_id)
        except GlossaryError as exc:
            raise ThemeError(exc.code, exc.message, exc.status) from exc
    node.name = payload.name
    node.code = payload.code
    node.term_id = payload.term_id
    if payload.sort_order is not None:
        node.sort_order = payload.sort_order
    session.commit()
    session.refresh(node)
    return node


def delete_theme_node(session: Session, node_id: uuid.UUID, user: UserContext) -> None:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    node = get_theme_node(session, node_id)
    child_count = session.scalar(
        select(func.count()).select_from(ThemeNode).where(ThemeNode.parent_id == node_id)
    )
    if child_count:
        raise ThemeError("META_THEME_HAS_CHILDREN", "Cannot delete node with children", 409)
    session.delete(node)
    session.commit()


def move_theme_node(
    session: Session,
    node_id: uuid.UUID,
    parent_id: uuid.UUID | None,
    sort_order: int | None,
    user: UserContext,
) -> ThemeNode:
    _assert_meta_write(user, raise_forbidden=_forbidden)
    node = get_theme_node(session, node_id)
    if parent_id == node_id:
        raise ThemeError("META_THEME_CYCLE", "Cannot move node under itself", 422)
    if parent_id is not None:
        if parent_id in _collect_descendant_ids(session, node_id):
            raise ThemeError("META_THEME_CYCLE", "Cannot move node under its descendant", 422)
        if session.get(ThemeNode, parent_id) is None:
            raise ThemeError("META_THEME_PARENT_NOT_FOUND", "Parent node not found", 404)
    _assert_depth_allowed(session, parent_id, node_id)
    node.parent_id = parent_id
    if sort_order is not None:
        node.sort_order = sort_order
    session.commit()
    session.refresh(node)
    return node


def probe_list_themes_budget_ms(session: Session) -> ThemeProbeResult:
    started = time.perf_counter()
    list_theme_nodes(session, parent_id="null", limit=50)
    elapsed = (time.perf_counter() - started) * 1000
    return ThemeProbeResult(elapsed_ms=elapsed, ok=elapsed <= probe_list_themes_budget_ms_limit)
