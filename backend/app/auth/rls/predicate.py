from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import AuthDimensionType, AuthOrgNode, AuthRole


IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,63}$")


class RlsDenied(Exception):
    def __init__(self, message: str = "RLS denied") -> None:
        self.message = message
        super().__init__(message)


class RlsConfigError(Exception):
    def __init__(self, message: str = "Invalid RLS configuration") -> None:
        self.message = message
        super().__init__(message)


def validate_column_name(name: str) -> None:
    if not IDENTIFIER_RE.match(name):
        raise RlsConfigError(f"Invalid column identifier: {name}")


def _expand_org_subtree(session: Session, root_ids: set[uuid.UUID]) -> set[uuid.UUID]:
    if not root_ids:
        return set()
    nodes = list(session.scalars(select(AuthOrgNode)))
    allowed: set[uuid.UUID] = set()
    for node in nodes:
        for root in root_ids:
            root_node = session.get(AuthOrgNode, root)
            if root_node is None:
                continue
            if node.id == root or node.path.startswith(f"{root_node.path}/"):
                allowed.add(node.id)
    return allowed


def resolve_user_org_node_ids(session: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    from app.auth.deps import resolve_user_roles
    from app.auth.user_overrides.merge import effective_dimension_values

    role_codes = resolve_user_roles(str(user_id))
    roles = list(session.scalars(select(AuthRole).where(AuthRole.code.in_(role_codes))))
    org_types = list(
        session.scalars(select(AuthDimensionType).where(AuthDimensionType.org_dimension.is_(True)))
    )
    raw: set[str] = set()
    for org_type in org_types:
        raw.update(
            effective_dimension_values(
                session,
                user_id=user_id,
                role_ids=[role.id for role in roles],
                dimension_type_id=org_type.id,
            )
        )
    root_ids = {uuid.UUID(v) for v in raw}
    return _expand_org_subtree(session, root_ids)


def build_org_rls_fragment(
    org_ids: set[uuid.UUID],
    *,
    column: str = "org_node_id",
    alias: str = "t",
) -> str:
    validate_column_name(column)
    validate_column_name(alias)
    if not org_ids:
        return "1=0"
    literals = ", ".join(f"'{oid}'" for oid in sorted(org_ids))
    return f"{alias}.{column} IN ({literals})"


def _quote_literal(value: str) -> str:
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def build_dimension_value_fragment(
    values: list[str],
    *,
    column: str,
    alias: str,
) -> str:
    validate_column_name(column)
    validate_column_name(alias)
    if not values:
        return "1=0"
    literals = ", ".join(_quote_literal(v) for v in sorted(values))
    return f"{alias}.{column} IN ({literals})"


def build_multi_dimension_rls_fragment(
    session: Session,
    user_id: uuid.UUID,
    *,
    column_by_dimension_id: dict[uuid.UUID, str],
    table_alias: str = "t",
) -> str:
    from app.auth.deps import resolve_user_roles
    from app.auth.user_overrides.merge import effective_dimension_values

    validate_column_name(table_alias)
    role_codes = resolve_user_roles(str(user_id))
    roles = list(session.scalars(select(AuthRole).where(AuthRole.code.in_(role_codes))))
    role_ids = [role.id for role in roles]
    if not roles:
        return "1=0"

    fragments: list[str] = []
    org_types = {
        dt.id: dt
        for dt in session.scalars(
            select(AuthDimensionType).where(AuthDimensionType.org_dimension.is_(True))
        )
    }

    for dim_id, column in column_by_dimension_id.items():
        validate_column_name(column)
        dim = session.get(AuthDimensionType, dim_id)
        if dim is None:
            raise RlsConfigError(f"Unknown dimension type: {dim_id}")
        if dim.org_dimension or dim_id in org_types:
            org_ids = resolve_user_org_node_ids(session, user_id)
            fragments.append(
                build_org_rls_fragment(org_ids, column=column, alias=table_alias)
            )
        else:
            merged = effective_dimension_values(
                session,
                user_id=user_id,
                role_ids=role_ids,
                dimension_type_id=dim_id,
            )
            fragments.append(
                build_dimension_value_fragment(
                    sorted(merged), column=column, alias=table_alias
                )
            )

    if not fragments:
        return "1=0"
    if len(fragments) == 1:
        return fragments[0]
    return " AND ".join(f"({f})" for f in fragments)
