from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.write_hooks import record_platform_event
from app.auth.models import AuthResourceGrant, AuthRole, AuthUserRole
from app.auth.schemas import RoleCreate, RoleUpdate


class RoleError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def list_roles(
    session: Session,
    code_prefix: str | None = None,
    is_active: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[AuthRole], int]:
    capped = min(max(limit, 1), 500)
    base = select(AuthRole).order_by(AuthRole.code)
    count_stmt = select(func.count()).select_from(AuthRole)
    if code_prefix:
        base = base.where(AuthRole.code.startswith(code_prefix))
        count_stmt = count_stmt.where(AuthRole.code.startswith(code_prefix))
    if is_active is not None:
        base = base.where(AuthRole.is_active.is_(is_active))
        count_stmt = count_stmt.where(AuthRole.is_active.is_(is_active))
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def create_role(
    session: Session,
    payload: RoleCreate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthRole:
    role = AuthRole(code=payload.code, name=payload.name, description=payload.description)
    session.add(role)
    try:
        session.flush()
        record_platform_event(
            session,
            actor_id=actor_id,
            actor_username=actor_username,
            target_type="role",
            target_id=role.id,
            action="role.create",
            detail={"code": role.code},
            trace_id=trace_id,
        )
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise RoleError("ROLE_CODE_CONFLICT", "角色编码已存在", 409) from exc
    session.refresh(role)
    return role


def get_role(session: Session, role_id: uuid.UUID) -> AuthRole:
    role = session.get(AuthRole, role_id)
    if role is None:
        raise RoleError("ROLE_NOT_FOUND", "角色不存在", 404)
    return role


def assert_role_active(role: AuthRole) -> None:
    if not role.is_active:
        raise RoleError("ROLE_DISABLED", "角色已停用", 409)


def update_role(
    session: Session,
    role_id: uuid.UUID,
    payload: RoleUpdate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthRole:
    role = get_role(session, role_id)
    if role.is_root and payload.is_active is False:
        raise RoleError(
            "AUTH_ROOT_ROLE_IMMUTABLE", "根角色不可停用", 409
        )
    role.name = payload.name
    role.description = payload.description
    if payload.is_active is not None:
        role.is_active = payload.is_active
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="role",
        target_id=role.id,
        action="role.update",
        detail={"code": role.code},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(role)
    return role


def delete_role(
    session: Session,
    role_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> None:
    role = get_role(session, role_id)
    if role.is_root:
        raise RoleError(
            "AUTH_ROOT_ROLE_IMMUTABLE", "根角色不可删除", 409
        )
    user_refs = session.scalar(
        select(AuthUserRole).where(AuthUserRole.role_id == role_id).limit(1)
    )
    grant_refs = session.scalar(
        select(AuthResourceGrant).where(AuthResourceGrant.role_id == role_id).limit(1)
    )
    if user_refs or grant_refs:
        raise RoleError("ROLE_IN_USE", "角色仍被用户绑定或资源授权引用，无法删除", 409)
    role_code = role.code
    role_uuid = role.id
    session.delete(role)
    record_platform_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="role",
        target_id=role_uuid,
        action="role.delete",
        detail={"code": role_code},
        trace_id=trace_id,
    )
    session.commit()
