from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import AuthOrgNode, AuthUser
from app.auth.schemas import OrgCreate, OrgUpdate

MAX_ORG_DEPTH = 32


class OrgError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _would_create_cycle(session: Session, node_id: uuid.UUID, new_parent_id: uuid.UUID) -> bool:
    parent = session.get(AuthOrgNode, new_parent_id)
    if parent is None:
        return False
    return parent.id == node_id or parent.path.startswith(f"/{node_id}/")


def _max_subtree_level(session: Session, node: AuthOrgNode) -> int:
    max_level = node.level
    children = session.scalars(select(AuthOrgNode).where(AuthOrgNode.parent_id == node.id))
    for child in children:
        max_level = max(max_level, _max_subtree_level(session, child))
    return max_level


def _repath_subtree(session: Session, node: AuthOrgNode) -> None:
    children = session.scalars(select(AuthOrgNode).where(AuthOrgNode.parent_id == node.id))
    for child in children:
        child.level = node.level + 1
        child.path = f"{node.path}/{child.id}"
        _repath_subtree(session, child)


def _init_path_level(node: AuthOrgNode, parent: AuthOrgNode | None) -> None:
    if parent is None:
        node.level = 0
        node.path = f"/{node.id}"
    else:
        node.level = parent.level + 1
        node.path = f"{parent.path}/{node.id}"


def list_org_nodes(
    session: Session,
    *,
    name_query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuthOrgNode], int]:
    base = select(AuthOrgNode)
    if name_query:
        base = base.where(AuthOrgNode.name.ilike(f"%{name_query}%"))
    count_stmt = select(func.count()).select_from(base.subquery())
    total = int(session.scalar(count_stmt) or 0)
    rows = session.scalars(
        base.order_by(AuthOrgNode.path).limit(limit).offset(offset),
    ).all()
    return list(rows), total


def create_org_node(
    session: Session,
    payload: OrgCreate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthOrgNode:
    parent = None
    if payload.parent_id is not None:
        parent = session.get(AuthOrgNode, payload.parent_id)
        if parent is None:
            raise OrgError("ORG_PARENT_NOT_FOUND", "Parent org node not found", 404)
    node = AuthOrgNode(
        id=uuid.uuid4(),
        name=payload.name,
        parent_id=payload.parent_id,
    )
    _init_path_level(node, parent)
    if node.level >= MAX_ORG_DEPTH:
        raise OrgError("ORG_DEPTH_EXCEEDED", f"Org tree depth cannot exceed {MAX_ORG_DEPTH}", 422)
    session.add(node)
    session.flush()
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="org",
        target_id=node.id,
        action="org.create",
        detail={"name": node.name},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(node)
    return node


def get_org_node(session: Session, node_id: uuid.UUID) -> AuthOrgNode:
    node = session.get(AuthOrgNode, node_id)
    if node is None:
        raise OrgError("ORG_NOT_FOUND", "Org node not found", 404)
    return node


def update_org_node(
    session: Session,
    node_id: uuid.UUID,
    payload: OrgUpdate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthOrgNode:
    node = get_org_node(session, node_id)
    if payload.name is not None:
        node.name = payload.name
    if payload.parent_id is not None:
        if payload.parent_id == node_id:
            raise OrgError("ORG_CYCLE", "Cannot move node under itself", 409)
        parent = session.get(AuthOrgNode, payload.parent_id)
        if parent is None:
            raise OrgError("ORG_PARENT_NOT_FOUND", "Parent org node not found", 404)
        if _would_create_cycle(session, node_id, payload.parent_id):
            raise OrgError("ORG_CYCLE", "Move would create cycle", 409)
        node.parent_id = payload.parent_id
        _init_path_level(node, parent)
        _repath_subtree(session, node)
    if _max_subtree_level(session, node) >= MAX_ORG_DEPTH:
        raise OrgError("ORG_DEPTH_EXCEEDED", f"Org tree depth cannot exceed {MAX_ORG_DEPTH}", 422)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="org",
        target_id=node.id,
        action="org.update",
        detail={"name": node.name},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(node)
    return node


def delete_org_node(
    session: Session,
    node_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> None:
    node = get_org_node(session, node_id)
    child_count = session.scalar(
        select(func.count()).select_from(AuthOrgNode).where(AuthOrgNode.parent_id == node_id)
    )
    if child_count and child_count > 0:
        raise OrgError("ORG_HAS_CHILDREN", "Cannot delete org node with children", 409)
    user_count = session.scalar(
        select(func.count()).select_from(AuthUser).where(AuthUser.org_node_id == node_id)
    )
    if user_count and user_count > 0:
        raise OrgError("ORG_HAS_USERS", "Cannot delete org node with assigned users", 409)
    node_uuid = node.id
    node_name = node.name
    from app.auth.cleanup import purge_org_dimension_references

    purge_org_dimension_references(session, node_uuid)
    session.delete(node)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="org",
        target_id=node_uuid,
        action="org.delete",
        detail={"name": node_name},
        trace_id=trace_id,
    )
    session.commit()
