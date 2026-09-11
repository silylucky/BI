from __future__ import annotations

from app.auth.deps import UserContext
from app.auth.rls.predicate import validate_column_name
from app.governance.catalog.cat03 import service as cat03_service


def resolve_region_scope_prefix(user: UserContext) -> str | None:
    roles = set(user.roles)
    if roles.intersection({"admin", "analyst"}):
        return None
    if "enterprise" in roles or "viewer" in roles:
        return cat03_service.get_user_region_scope_prefix(user.id)
    return cat03_service.get_user_region_scope_prefix(user.id)


def build_region_scope_fragment(
    prefix: str | None,
    *,
    column: str,
    alias: str = "t",
) -> str | None:
    if prefix is None:
        return None
    validate_column_name(column)
    validate_column_name(alias)
    escaped = prefix.replace("'", "''")
    return f"{alias}.{column} LIKE '{escaped}%'"
