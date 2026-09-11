from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.models import AuthOrgNode, AuthUser, AuthUserRole

PERM_ORG_SCOPED_MANAGE = "system:org_scoped.manage"
PERM_USER_MANAGE = "system:user.manage"


class OrgScopeError(Exception):
    def __init__(self, code: str, message: str, status: int = 403) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def is_full_user_admin(*, permissions: set[str], is_root: bool) -> bool:
    return is_root or PERM_USER_MANAGE in permissions


def is_org_scoped_only(*, permissions: set[str], is_root: bool) -> bool:
    return not is_full_user_admin(permissions=permissions, is_root=is_root) and (
        PERM_ORG_SCOPED_MANAGE in permissions
    )


def get_subtree_org_ids(session: Session, org_node_id: uuid.UUID) -> set[uuid.UUID]:
    node = session.get(AuthOrgNode, org_node_id)
    if node is None:
        return set()
    prefix = f"{node.path}/"
    rows = session.scalars(
        select(AuthOrgNode.id).where(
            or_(AuthOrgNode.id == org_node_id, AuthOrgNode.path.like(f"{prefix}%"))
        )
    ).all()
    return set(rows)


def resolve_actor_org_id(session: Session, actor_user_id: str) -> uuid.UUID | None:
    try:
        user_uuid = uuid.UUID(actor_user_id)
    except ValueError:
        return None
    user = session.get(AuthUser, user_uuid)
    return user.org_node_id if user is not None else None


def list_filter_org_ids(
    session: Session,
    *,
    permissions: set[str],
    is_root: bool,
    actor_user_id: str,
) -> list[uuid.UUID] | None:
    """None = unrestricted; otherwise restrict to manageable org subtree."""
    if is_full_user_admin(permissions=permissions, is_root=is_root):
        return None
    if not is_org_scoped_only(permissions=permissions, is_root=is_root):
        return None
    actor_org = resolve_actor_org_id(session, actor_user_id)
    if actor_org is None:
        return []
    return sorted(get_subtree_org_ids(session, actor_org))


def assert_org_assignable(
    session: Session,
    *,
    permissions: set[str],
    is_root: bool,
    actor_user_id: str,
    target_org_id: uuid.UUID | None,
) -> None:
    if is_full_user_admin(permissions=permissions, is_root=is_root):
        return
    if not is_org_scoped_only(permissions=permissions, is_root=is_root):
        return
    if target_org_id is None:
        raise OrgScopeError("ORG_SCOPE_REQUIRED", "Org assignment required for scoped admin", 403)
    actor_org = resolve_actor_org_id(session, actor_user_id)
    if actor_org is None:
        raise OrgScopeError("ORG_SCOPE_FORBIDDEN", "Actor has no org scope", 403)
    allowed = get_subtree_org_ids(session, actor_org)
    if target_org_id not in allowed:
        raise OrgScopeError("ORG_SCOPE_FORBIDDEN", "Target org outside manageable subtree", 403)


def assert_user_manageable(
    session: Session,
    *,
    permissions: set[str],
    is_root: bool,
    actor_user_id: str,
    target_user_id: uuid.UUID,
) -> None:
    if is_full_user_admin(permissions=permissions, is_root=is_root):
        return
    if not is_org_scoped_only(permissions=permissions, is_root=is_root):
        return
    user = session.get(AuthUser, target_user_id)
    if user is None or user.org_node_id is None:
        raise OrgScopeError("ORG_SCOPE_FORBIDDEN", "User outside manageable org subtree", 403)
    actor_org = resolve_actor_org_id(session, actor_user_id)
    if actor_org is None:
        raise OrgScopeError("ORG_SCOPE_FORBIDDEN", "Actor has no org scope", 403)
    allowed = get_subtree_org_ids(session, actor_org)
    if user.org_node_id not in allowed:
        raise OrgScopeError("ORG_SCOPE_FORBIDDEN", "User outside manageable org subtree", 403)


def assert_role_in_org_scope(
    session: Session,
    *,
    permissions: set[str],
    is_root: bool,
    actor_user_id: str,
    role_id: uuid.UUID,
) -> None:
    if is_full_user_admin(permissions=permissions, is_root=is_root):
        return
    if not is_org_scoped_only(permissions=permissions, is_root=is_root):
        return
    actor_org = resolve_actor_org_id(session, actor_user_id)
    if actor_org is None:
        raise OrgScopeError("ORG_SCOPE_FORBIDDEN", "Actor has no org scope", 403)
    allowed_orgs = get_subtree_org_ids(session, actor_org)
    count = session.scalar(
        select(AuthUserRole.user_id)
        .join(AuthUser, AuthUser.id == AuthUserRole.user_id)
        .where(
            AuthUserRole.role_id == role_id,
            AuthUser.org_node_id.in_(allowed_orgs),
        )
        .limit(1)
    )
    if count is None:
        raise OrgScopeError(
            "ORG_SCOPE_FORBIDDEN",
            "Role is not assigned within manageable org subtree",
            403,
        )
