from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.models import AuthOrgNode, AuthUser

SYSTEM_VARIABLES: dict[str, str] = {
    "current_user.id": "Authenticated user UUID",
    "current_user.org_id": "User's primary org node UUID (nullable)",
    "current_user.org_subtree": "Expanded org node UUID set under user's org bindings",
}


def resolve_current_user_id(user: UserContext) -> str:
    return user.id


def resolve_current_user_org_id(session: Session, user_id: uuid.UUID) -> uuid.UUID | None:
    user = session.get(AuthUser, user_id)
    if user is None:
        return None
    return user.org_node_id


def expand_org_subtree_ids(session: Session, root_ids: set[uuid.UUID]) -> set[uuid.UUID]:
    if not root_ids:
        return set()
    nodes = list(session.scalars(select(AuthOrgNode)))
    allowed: set[uuid.UUID] = set()
    roots = {session.get(AuthOrgNode, rid) for rid in root_ids}
    roots_map = {n.id: n for n in roots if n is not None}
    for node in nodes:
        for root in roots_map.values():
            if node.id == root.id or node.path.startswith(f"{root.path}/"):
                allowed.add(node.id)
    return allowed
