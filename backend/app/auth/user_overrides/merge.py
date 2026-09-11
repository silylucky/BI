from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import (
    AuthResourceGrant,
    AuthUserDimensionOverride,
    AuthUserResourceGrant,
)
from app.auth.user_overrides import store


def effective_resource_ids(
    session: Session,
    *,
    user_id: uuid.UUID,
    role_codes: list[str],
    resource_type: str,
) -> set[uuid.UUID]:
    from app.auth.models import AuthRole

    base: set[uuid.UUID] = set()
    if role_codes:
        role_uuids = list(
            session.scalars(select(AuthRole.id).where(AuthRole.code.in_(role_codes))).all()
        )
        if role_uuids:
            base = set(
                session.scalars(
                    select(AuthResourceGrant.resource_id).where(
                        AuthResourceGrant.role_id.in_(role_uuids),
                        AuthResourceGrant.resource_type == resource_type,
                    )
                ).all()
            )
    adds: set[uuid.UUID] = set()
    denies: set[uuid.UUID] = set()
    for row in store.list_user_resource_grants(session, user_id):
        if row.resource_type != resource_type:
            continue
        if row.effect == "add":
            adds.add(row.resource_id)
        else:
            denies.add(row.resource_id)
    return (base | adds) - denies


def effective_dimension_values(
    session: Session,
    *,
    user_id: uuid.UUID,
    role_ids: list[uuid.UUID],
    dimension_type_id: uuid.UUID,
) -> set[str]:
    from app.auth.rls.bindings.service import resolve_effective_values

    base: set[str] = set()
    for role_id in role_ids:
        base.update(resolve_effective_values(session, role_id, dimension_type_id))
    adds: set[str] = set()
    denies: set[str] = set()
    for row in store.list_user_dimension_overrides(session, user_id):
        if row.dimension_type_id != dimension_type_id:
            continue
        if row.effect == "add":
            adds.add(row.value)
        else:
            denies.add(row.value)
    return (base | adds) - denies


def user_has_resource_access(
    session: Session,
    *,
    user_id: uuid.UUID,
    role_codes: list[str],
    resource_type: str,
    resource_id: uuid.UUID,
) -> bool:
    return resource_id in effective_resource_ids(
        session, user_id=user_id, role_codes=role_codes, resource_type=resource_type
    )
