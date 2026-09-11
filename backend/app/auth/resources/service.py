from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import AuthResourceGrant, AuthRole
from app.auth.schemas import ResourceGrantCreate


class GrantError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def list_grants(
    session: Session,
    role_id: uuid.UUID | None = None,
    resource_type: str | None = None,
) -> list[AuthResourceGrant]:
    stmt = select(AuthResourceGrant).order_by(AuthResourceGrant.created_at)
    if role_id is not None:
        stmt = stmt.where(AuthResourceGrant.role_id == role_id)
    if resource_type is not None:
        stmt = stmt.where(AuthResourceGrant.resource_type == resource_type)
    return list(session.scalars(stmt))


def create_grant(
    session: Session,
    payload: ResourceGrantCreate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
    actor_permissions: set[str] | None = None,
    actor_is_root: bool = False,
) -> AuthResourceGrant:
    from app.auth.org_scope import OrgScopeError, assert_role_in_org_scope, is_org_scoped_only

    perms = actor_permissions or set()
    if is_org_scoped_only(permissions=perms, is_root=actor_is_root):
        try:
            assert_role_in_org_scope(
                session,
                permissions=perms,
                is_root=actor_is_root,
                actor_user_id=actor_id,
                role_id=payload.role_id,
            )
        except OrgScopeError as exc:
            raise GrantError(exc.code, exc.message, exc.status) from exc
    role = session.get(AuthRole, payload.role_id)
    if role is None:
        raise GrantError("ROLE_NOT_FOUND", "Role not found", 404)
    if payload.resource_type not in VALID_RESOURCE_TYPES:
        raise GrantError(
            "INVALID_RESOURCE_TYPE",
            f"resource_type must be one of {sorted(VALID_RESOURCE_TYPES)}",
            422,
        )
    grant = AuthResourceGrant(
        role_id=payload.role_id,
        resource_type=payload.resource_type,
        resource_id=payload.resource_id,
    )
    session.add(grant)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise GrantError("GRANT_ALREADY_EXISTS", "Resource grant already exists", 409) from exc
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="grant",
        target_id=grant.id,
        action="grant.create",
        detail={
            "role_id": str(payload.role_id),
            "role_code": role.code,
            "resource_type": payload.resource_type,
            "resource_id": str(payload.resource_id),
        },
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(grant)
    return grant


def delete_grant(
    session: Session,
    grant_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
    actor_permissions: set[str] | None = None,
    actor_is_root: bool = False,
) -> None:
    from app.auth.org_scope import OrgScopeError, assert_role_in_org_scope, is_org_scoped_only

    grant = session.get(AuthResourceGrant, grant_id)
    if grant is None:
        raise GrantError("GRANT_NOT_FOUND", "Resource grant not found", 404)
    perms = actor_permissions or set()
    if is_org_scoped_only(permissions=perms, is_root=actor_is_root):
        try:
            assert_role_in_org_scope(
                session,
                permissions=perms,
                is_root=actor_is_root,
                actor_user_id=actor_id,
                role_id=grant.role_id,
            )
        except OrgScopeError as exc:
            raise GrantError(exc.code, exc.message, exc.status) from exc
    role = session.get(AuthRole, grant.role_id)
    detail = {
        "role_id": str(grant.role_id),
        "role_code": role.code if role else None,
        "resource_type": grant.resource_type,
        "resource_id": str(grant.resource_id),
    }
    target_id = grant.id
    session.delete(grant)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="grant",
        target_id=target_id,
        action="grant.delete",
        detail=detail,
        trace_id=trace_id,
    )
    session.commit()


def delete_grants_batch(session: Session, grant_ids: list[uuid.UUID]) -> int:
    deleted = 0
    for grant_id in grant_ids:
        grant = session.get(AuthResourceGrant, grant_id)
        if grant is not None:
            session.delete(grant)
            deleted += 1
    if deleted:
        session.commit()
    return deleted


def _user_uuid(user_id: str | uuid.UUID | None) -> uuid.UUID | None:
    if user_id is None:
        return None
    try:
        return user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    except ValueError:
        return None


def check_resource_access(
    session: Session,
    role_codes: list[str],
    resource_type: str,
    resource_id: uuid.UUID,
    *,
    user_id: str | uuid.UUID | None = None,
) -> bool:
    uid = _user_uuid(user_id)
    if uid is not None:
        from app.auth.user_overrides.merge import user_has_resource_access

        return user_has_resource_access(
            session,
            user_id=uid,
            role_codes=role_codes,
            resource_type=resource_type,
            resource_id=resource_id,
        )
    if not role_codes:
        return False
    stmt = (
        select(AuthResourceGrant.id)
        .join(AuthRole, AuthRole.id == AuthResourceGrant.role_id)
        .where(
            AuthRole.code.in_(role_codes),
            AuthResourceGrant.resource_type == resource_type,
            AuthResourceGrant.resource_id == resource_id,
        )
        .limit(1)
    )
    return session.scalar(stmt) is not None


VALID_RESOURCE_TYPES = frozenset({"datasource", "dashboard", "report", "gov_catalog_entry"})


class VisibilityError(Exception):
    def __init__(self, code: str, message: str, status: int = 403) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _validate_resource_type(resource_type: str) -> None:
    if resource_type not in VALID_RESOURCE_TYPES:
        raise VisibilityError(
            "INVALID_RESOURCE_TYPE",
            f"resource_type must be one of {sorted(VALID_RESOURCE_TYPES)}",
            422,
        )


def list_visible_resource_ids(
    session: Session,
    role_codes: list[str],
    resource_type: str,
    *,
    user_id: str | uuid.UUID | None = None,
) -> list[uuid.UUID]:
    _validate_resource_type(resource_type)
    uid = _user_uuid(user_id)
    if uid is not None:
        from app.auth.user_overrides.merge import effective_resource_ids

        return sorted(
            effective_resource_ids(
                session,
                user_id=uid,
                role_codes=role_codes,
                resource_type=resource_type,
            )
        )
    if not role_codes:
        return []
    stmt = (
        select(AuthResourceGrant.resource_id)
        .join(AuthRole, AuthRole.id == AuthResourceGrant.role_id)
        .where(
            AuthRole.code.in_(role_codes),
            AuthResourceGrant.resource_type == resource_type,
        )
        .order_by(AuthResourceGrant.created_at)
    )
    rows = session.scalars(stmt).all()
    seen: set[uuid.UUID] = set()
    result: list[uuid.UUID] = []
    for rid in rows:
        if rid not in seen:
            seen.add(rid)
            result.append(rid)
    return result


def ensure_resource_visible(
    session: Session,
    role_codes: list[str],
    resource_type: str,
    resource_id: uuid.UUID,
    *,
    user_id: str | uuid.UUID | None = None,
) -> None:
    _validate_resource_type(resource_type)
    if not check_resource_access(
        session,
        role_codes,
        resource_type,
        resource_id,
        user_id=user_id,
    ):
        raise VisibilityError("RESOURCE_FORBIDDEN", "Resource not visible for current roles", 403)


def filter_visible_resources(
    session: Session,
    role_codes: list[str],
    resource_type: str,
    candidate_ids: list[uuid.UUID],
    *,
    user_id: str | uuid.UUID | None = None,
) -> list[uuid.UUID]:
    if not candidate_ids:
        return []
    visible = set(
        list_visible_resource_ids(session, role_codes, resource_type, user_id=user_id)
    )
    return [cid for cid in candidate_ids if cid in visible]
