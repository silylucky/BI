"""Resource ACL / RLS bypass helpers — only platform root may bypass."""

from __future__ import annotations

from app.auth.deps import UserContext


def bypasses_resource_acl(actor: UserContext) -> bool:
    """Root users see all resources; custom roles never bypass via role code."""
    return actor.is_root


def bypasses_rls(user: UserContext) -> bool:
    return user.is_root
