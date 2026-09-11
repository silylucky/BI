from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.auth.bypass import bypasses_resource_acl
from app.auth.deps import UserContext
from app.auth.resources.service import (
    VisibilityError,
    ensure_resource_visible,
    list_visible_resource_ids,
)

RESOURCE_TYPE = "dashboard"


def list_granted_ids(session: Session, actor: UserContext) -> list[uuid.UUID] | None:
    if bypasses_resource_acl(actor):
        return None
    return list_visible_resource_ids(session, actor.roles, RESOURCE_TYPE, user_id=actor.id)


def can_access(
    session: Session,
    actor: UserContext,
    dashboard_id: uuid.UUID,
    created_by: uuid.UUID | None,
    *,
    official_slugs: set[str],
    slug: str | None = None,
) -> bool:
    if bypasses_resource_acl(actor):
        return True
    if slug and slug in official_slugs:
        return True
    try:
        actor_uuid = uuid.UUID(actor.id)
        if created_by is not None and created_by == actor_uuid:
            return True
    except ValueError:
        return False
    try:
        ensure_resource_visible(
            session, actor.roles, RESOURCE_TYPE, dashboard_id, user_id=actor.id
        )
        return True
    except VisibilityError:
        return False


__all__ = [
    "RESOURCE_TYPE",
    "VisibilityError",
    "can_access",
    "list_granted_ids",
]
