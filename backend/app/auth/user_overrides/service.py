from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import AuthUserDimensionOverride, AuthUserResourceGrant
from app.auth.org_scope import assert_user_manageable
from app.auth.resources.service import VALID_RESOURCE_TYPES
from app.auth.user_overrides.merge import (
    effective_dimension_values,
    effective_resource_ids,
    user_has_resource_access,
)
from app.auth.user_overrides.store import (
    list_user_dimension_overrides,
    list_user_resource_grants,
)

OverrideEffect = str  # "add" | "deny"


class OverrideError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def upsert_user_resource_grant(
    session: Session,
    *,
    user_id: uuid.UUID,
    resource_type: str,
    resource_id: uuid.UUID,
    effect: OverrideEffect,
    actor_id: str,
    actor_username: str | None,
    actor_permissions: set[str],
    actor_is_root: bool,
    trace_id: str,
) -> AuthUserResourceGrant:
    if resource_type not in VALID_RESOURCE_TYPES:
        raise OverrideError("INVALID_RESOURCE_TYPE", "Unsupported resource type", 422)
    if effect not in {"add", "deny"}:
        raise OverrideError("INVALID_EFFECT", "effect must be add or deny", 422)
    assert_user_manageable(
        session,
        permissions=actor_permissions,
        is_root=actor_is_root,
        actor_user_id=actor_id,
        target_user_id=user_id,
    )
    existing = session.scalar(
        select(AuthUserResourceGrant).where(
            AuthUserResourceGrant.user_id == user_id,
            AuthUserResourceGrant.resource_type == resource_type,
            AuthUserResourceGrant.resource_id == resource_id,
        )
    )
    if existing is None:
        row = AuthUserResourceGrant(
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            effect=effect,
        )
        session.add(row)
    else:
        row = existing
        row.effect = effect
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise OverrideError("OVERRIDE_CONFLICT", "Could not save user resource grant", 409) from exc
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="user",
        target_id=user_id,
        action="user.override.resource.upsert",
        detail={"resource_type": resource_type, "resource_id": str(resource_id), "effect": effect},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(row)
    return row


def delete_user_resource_grant(
    session: Session,
    grant_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_permissions: set[str],
    actor_is_root: bool,
    trace_id: str,
) -> None:
    row = session.get(AuthUserResourceGrant, grant_id)
    if row is None:
        raise OverrideError("OVERRIDE_NOT_FOUND", "User resource grant not found", 404)
    assert_user_manageable(
        session,
        permissions=actor_permissions,
        is_root=actor_is_root,
        actor_user_id=actor_id,
        target_user_id=row.user_id,
    )
    user_id = row.user_id
    session.delete(row)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="user",
        target_id=user_id,
        action="user.override.resource.delete",
        detail={"grant_id": str(grant_id)},
        trace_id=trace_id,
    )
    session.commit()


def upsert_user_dimension_override(
    session: Session,
    *,
    user_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
    value: str,
    effect: OverrideEffect,
    actor_id: str,
    actor_username: str | None,
    actor_permissions: set[str],
    actor_is_root: bool,
    trace_id: str,
) -> AuthUserDimensionOverride:
    if effect not in {"add", "deny"}:
        raise OverrideError("INVALID_EFFECT", "effect must be add or deny", 422)
    assert_user_manageable(
        session,
        permissions=actor_permissions,
        is_root=actor_is_root,
        actor_user_id=actor_id,
        target_user_id=user_id,
    )
    row = session.get(
        AuthUserDimensionOverride,
        {"user_id": user_id, "dimension_type_id": dimension_type_id, "value": value},
    )
    if row is None:
        row = AuthUserDimensionOverride(
            user_id=user_id,
            dimension_type_id=dimension_type_id,
            value=value,
            effect=effect,
        )
        session.add(row)
    else:
        row.effect = effect
    session.flush()
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="user",
        target_id=user_id,
        action="user.override.dimension.upsert",
        detail={"dimension_type_id": str(dimension_type_id), "value": value, "effect": effect},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(row)
    return row


def delete_user_dimension_override(
    session: Session,
    *,
    user_id: uuid.UUID,
    dimension_type_id: uuid.UUID,
    value: str,
    actor_id: str,
    actor_username: str | None,
    actor_permissions: set[str],
    actor_is_root: bool,
    trace_id: str,
) -> None:
    assert_user_manageable(
        session,
        permissions=actor_permissions,
        is_root=actor_is_root,
        actor_user_id=actor_id,
        target_user_id=user_id,
    )
    row = session.get(
        AuthUserDimensionOverride,
        {"user_id": user_id, "dimension_type_id": dimension_type_id, "value": value},
    )
    if row is None:
        raise OverrideError("OVERRIDE_NOT_FOUND", "User dimension override not found", 404)
    session.delete(row)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="user",
        target_id=user_id,
        action="user.override.dimension.delete",
        detail={"dimension_type_id": str(dimension_type_id), "value": value},
        trace_id=trace_id,
    )
    session.commit()


__all__ = [
    "OverrideError",
    "delete_user_dimension_override",
    "delete_user_resource_grant",
    "effective_dimension_values",
    "effective_resource_ids",
    "list_user_dimension_overrides",
    "list_user_resource_grants",
    "upsert_user_dimension_override",
    "upsert_user_resource_grant",
    "user_has_resource_access",
]
