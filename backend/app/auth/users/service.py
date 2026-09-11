from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db.sql_compat import ilike
from app.auth.audit import service as audit_service
from app.auth.bootstrap_root import (
    RootAdminRequiredError,
    assert_root_admin_survives,
)
from app.auth.models import AuthOrgNode, AuthRole, AuthUser, AuthUserRole
from app.auth.org_scope import OrgScopeError, assert_org_assignable, assert_user_manageable
from app.auth.password.service import (
    generate_temporary_password,
    hash_password,
    validate_password_policy,
)
from app.auth.schemas import UserCreate, UserUpdate

class UserError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _scope_from_actor(
    *,
    actor_id: str,
    actor_permissions: set[str] | None,
    actor_is_root: bool,
) -> tuple[set[str], bool, str]:
    return actor_permissions or set(), actor_is_root, actor_id


def _guard_scope(exc: OrgScopeError) -> None:
    raise UserError(exc.code, exc.message, exc.status) from exc


def _user_has_enabled_root_binding(session: Session, user_id: uuid.UUID) -> bool:
    count = session.scalar(
        select(func.count())
        .select_from(AuthUserRole)
        .join(AuthRole, AuthRole.id == AuthUserRole.role_id)
        .where(
            AuthUserRole.user_id == user_id,
            AuthRole.is_root.is_(True),
            AuthRole.is_active.is_(True),
        )
    )
    return bool(count)


def _guard_root_admin(session: Session) -> None:
    """在 commit 前校验根管理员不变量，违反时回滚并转为 UserError(409)。"""
    session.flush()
    try:
        assert_root_admin_survives(session)
    except RootAdminRequiredError as exc:
        session.rollback()
        raise UserError(exc.code, exc.message, exc.status) from exc


def _audit_user_event(
    session: Session,
    *,
    actor_id: str,
    actor_username: str | None,
    target_id: uuid.UUID,
    action: str,
    detail: dict | None,
    trace_id: str,
) -> None:
    audit_service.record_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_type="user",
        target_id=target_id,
        action=action,
        detail=detail,
        trace_id=trace_id,
    )


def _resolve_active_roles(session: Session, role_ids: list[uuid.UUID]) -> list[AuthRole]:
    from app.auth.roles.service import assert_role_active

    roles: list[AuthRole] = []
    for role_id in role_ids:
        role = session.get(AuthRole, role_id)
        if role is None:
            raise UserError("ROLE_NOT_FOUND", "Role not found", 404)
        assert_role_active(role)
        roles.append(role)
    return roles


def create_user(
    session: Session,
    payload: UserCreate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
    actor_permissions: set[str] | None = None,
    actor_is_root: bool = False,
) -> AuthUser:
    """创建用户：保存初始密码 hash、可选组织与角色绑定，同事务写审计。"""
    perms, is_root, actor = _scope_from_actor(
        actor_id=actor_id, actor_permissions=actor_permissions, actor_is_root=actor_is_root
    )
    try:
        assert_org_assignable(
            session,
            permissions=perms,
            is_root=is_root,
            actor_user_id=actor,
            target_org_id=payload.org_id,
        )
    except OrgScopeError as exc:
        _guard_scope(exc)
    validate_password_policy(payload.initial_password)
    if payload.org_id is not None and session.get(AuthOrgNode, payload.org_id) is None:
        raise UserError("ORG_NOT_FOUND", "Org node not found", 404)
    roles = _resolve_active_roles(session, payload.role_ids)

    user = AuthUser(
        username=payload.username,
        display_name=payload.display_name,
        email=payload.email,
        org_node_id=payload.org_id,
        password_hash=hash_password(payload.initial_password),
    )
    session.add(user)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise UserError("USERNAME_CONFLICT", "Username already exists", 409) from exc
    for role in roles:
        session.add(AuthUserRole(user_id=user.id, role_id=role.id))
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user.id,
        action="user.create",
        detail={"username": user.username, "role_ids": [str(r.id) for r in roles]},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return user


def update_user(
    session: Session,
    user_id: uuid.UUID,
    payload: UserUpdate,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
    actor_permissions: set[str] | None = None,
    actor_is_root: bool = False,
) -> AuthUser:
    """更新用户资料/组织/角色；替换角色时保护根管理员不变量。"""
    perms, is_root, actor = _scope_from_actor(
        actor_id=actor_id, actor_permissions=actor_permissions, actor_is_root=actor_is_root
    )
    try:
        assert_user_manageable(
            session,
            permissions=perms,
            is_root=is_root,
            actor_user_id=actor,
            target_user_id=user_id,
        )
    except OrgScopeError as exc:
        _guard_scope(exc)
    user = get_user(session, user_id)
    changes: dict[str, object] = {}
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
        changes["displayName"] = user.display_name
    if payload.email is not None:
        user.email = payload.email
        changes["email"] = user.email
    if payload.org_id is not None:
        try:
            assert_org_assignable(
                session,
                permissions=perms,
                is_root=is_root,
                actor_user_id=actor,
                target_org_id=payload.org_id,
            )
        except OrgScopeError as exc:
            _guard_scope(exc)
        if session.get(AuthOrgNode, payload.org_id) is None:
            raise UserError("ORG_NOT_FOUND", "Org node not found", 404)
        user.org_node_id = payload.org_id
        changes["orgId"] = str(payload.org_id)

    if payload.role_ids is not None:
        roles = _resolve_active_roles(session, payload.role_ids)
        had_root = _user_has_enabled_root_binding(session, user_id)
        session.query(AuthUserRole).filter(AuthUserRole.user_id == user_id).delete()
        for role in roles:
            session.add(AuthUserRole(user_id=user_id, role_id=role.id))
        if had_root:
            _guard_root_admin(session)
        changes["roleIds"] = [str(r.id) for r in roles]

    if not changes:
        raise UserError("USER_NO_CHANGES", "No user fields to update", 422)
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.update",
        detail=changes,
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return user


def unlock_user(
    session: Session,
    user_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> AuthUser:
    """解锁用户：清零连续失败计数与锁定时间。"""
    user = get_user(session, user_id)
    user.failed_login_count = 0
    user.locked_until = None
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.unlock",
        detail=None,
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return user


def reset_password(
    session: Session,
    user_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    trace_id: str,
) -> tuple[str, datetime]:
    """管理员重置密码：生成临时密码、递增 token_version、审计不含明文。

    返回一次性明文临时密码与 ``password_changed_at``；明文只在返回值中出现。
    """
    user = get_user(session, user_id)
    temporary = generate_temporary_password()
    user.password_hash = hash_password(temporary)
    user.password_changed_at = datetime.now(timezone.utc)
    user.token_version = user.token_version + 1
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.password.reset",
        detail={"tokenVersion": user.token_version},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return temporary, user.password_changed_at


def get_user(session: Session, user_id: uuid.UUID) -> AuthUser:
    user = session.get(AuthUser, user_id)
    if user is None:
        raise UserError("USER_NOT_FOUND", "User not found", 404)
    return user


def get_user_by_username(session: Session, username: str) -> AuthUser | None:
    return session.scalar(select(AuthUser).where(AuthUser.username == username))


def get_user_by_id_or_matching_username(
    session: Session, user_id: uuid.UUID, username: str
) -> AuthUser | None:
    user = session.get(AuthUser, user_id)
    if user is not None:
        return user
    candidate = get_user_by_username(session, username)
    return candidate if candidate is not None and candidate.id == user_id else None


def list_users(
    session: Session,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    org_node_ids: list[uuid.UUID] | None = None,
) -> tuple[list[AuthUser], int]:
    capped = min(max(limit, 1), 500)
    base = select(AuthUser).order_by(AuthUser.username)
    count_stmt = select(func.count()).select_from(AuthUser)
    if org_node_ids is not None:
        if not org_node_ids:
            return [], 0
        base = base.where(AuthUser.org_node_id.in_(org_node_ids))
        count_stmt = count_stmt.where(AuthUser.org_node_id.in_(org_node_ids))
    if q:
        pattern = f"%{q}%"
        base = base.where(ilike(AuthUser.username, pattern))
        count_stmt = count_stmt.where(ilike(AuthUser.username, pattern))
    total = session.scalar(count_stmt) or 0
    items = list(session.scalars(base.limit(capped).offset(max(offset, 0))))
    return items, total


def list_users_role_map(
    session: Session,
    user_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[AuthRole]]:
    if not user_ids:
        return {}
    rows = session.execute(
        select(AuthUserRole.user_id, AuthRole)
        .join(AuthRole, AuthRole.id == AuthUserRole.role_id)
        .where(AuthUserRole.user_id.in_(user_ids), AuthRole.is_active.is_(True))
        .order_by(AuthRole.code)
    ).all()
    result: dict[uuid.UUID, list[AuthRole]] = {}
    for user_id, role in rows:
        result.setdefault(user_id, []).append(role)
    return result


def list_user_roles(session: Session, user_id: uuid.UUID) -> list[AuthRole]:
    get_user(session, user_id)
    return list(
        session.scalars(
            select(AuthRole)
            .join(AuthUserRole, AuthUserRole.role_id == AuthRole.id)
            .where(AuthUserRole.user_id == user_id, AuthRole.is_active.is_(True))
            .order_by(AuthRole.code)
        )
    )


def bind_role(
    session: Session,
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> None:
    get_user(session, user_id)
    role = session.get(AuthRole, role_id)
    if role is None:
        raise UserError("ROLE_NOT_FOUND", "Role not found", 404)
    from app.auth.roles.service import assert_role_active

    assert_role_active(role)
    existing = session.get(AuthUserRole, {"user_id": user_id, "role_id": role_id})
    if existing is None:
        session.add(AuthUserRole(user_id=user_id, role_id=role_id))
        _audit_user_event(
            session,
            actor_id=actor_id,
            actor_username=actor_username,
            target_id=user_id,
            action="user.role.bind",
            detail={"role_id": str(role_id), "role_code": role.code},
            trace_id=trace_id,
        )
        session.commit()


def unbind_role(
    session: Session,
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> None:
    get_user(session, user_id)
    role = session.get(AuthRole, role_id)
    binding = session.get(AuthUserRole, {"user_id": user_id, "role_id": role_id})
    if binding is None:
        raise UserError("BINDING_NOT_FOUND", "User-role binding not found", 404)
    session.delete(binding)
    if role is not None and role.is_root:
        _guard_root_admin(session)
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.role.unbind",
        detail={"role_id": str(role_id), "role_code": role.code if role else None},
        trace_id=trace_id,
    )
    session.commit()


def replace_user_roles(
    session: Session,
    user_id: uuid.UUID,
    role_ids: list[uuid.UUID],
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> list[AuthRole]:
    get_user(session, user_id)
    for role_id in role_ids:
        if session.get(AuthRole, role_id) is None:
            raise UserError("ROLE_NOT_FOUND", "Role not found", 404)
    from app.auth.roles.service import assert_role_active

    for role_id in role_ids:
        role = session.get(AuthRole, role_id)
        assert role is not None
        assert_role_active(role)
    had_root = _user_has_enabled_root_binding(session, user_id)
    session.query(AuthUserRole).filter(AuthUserRole.user_id == user_id).delete()
    for role_id in role_ids:
        session.add(AuthUserRole(user_id=user_id, role_id=role_id))
    if had_root:
        _guard_root_admin(session)
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.roles.replace",
        detail={"role_ids": [str(r) for r in role_ids]},
        trace_id=trace_id,
    )
    session.commit()
    return list_user_roles(session, user_id)


def bind_roles_batch(
    session: Session,
    user_id: uuid.UUID,
    role_ids: list[uuid.UUID],
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> list[AuthRole]:
    get_user(session, user_id)
    new_role_ids: list[uuid.UUID] = []
    for role_id in role_ids:
        role = session.get(AuthRole, role_id)
        if role is None:
            raise UserError("ROLE_NOT_FOUND", "Role not found", 404)
        from app.auth.roles.service import assert_role_active

        assert_role_active(role)
        existing = session.get(AuthUserRole, {"user_id": user_id, "role_id": role_id})
        if existing is None:
            session.add(AuthUserRole(user_id=user_id, role_id=role_id))
            new_role_ids.append(role_id)
    if new_role_ids:
        _audit_user_event(
            session,
            actor_id=actor_id,
            actor_username=actor_username,
            target_id=user_id,
            action="user.role.bind",
            detail={"role_ids": [str(r) for r in new_role_ids]},
            trace_id=trace_id,
        )
    session.commit()
    return list_user_roles(session, user_id)


def set_user_active(
    session: Session,
    user_id: uuid.UUID,
    is_active: bool,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> AuthUser:
    """启用/禁用用户；禁用最后一个启用 root 用户时抛 AUTH_ROOT_ADMIN_REQUIRED。"""
    user = get_user(session, user_id)
    guard_needed = not is_active and _user_has_enabled_root_binding(session, user_id)
    user.is_active = is_active
    if not is_active:
        user.token_version = user.token_version + 1
    if guard_needed:
        _guard_root_admin(session)
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.activate" if is_active else "user.deactivate",
        detail={"is_active": is_active},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return user


def resolve_role_codes_for_user(session: Session, user_id: uuid.UUID) -> list[str]:
    if session.get(AuthUser, user_id) is None:
        return []
    roles = list_user_roles(session, user_id)
    return [r.code for r in roles]


def resolve_role_codes_for_username(session: Session, username: str) -> list[str]:
    user = get_user_by_username(session, username)
    if user is None:
        return []
    return resolve_role_codes_for_user(session, user.id)


def assign_user_org(
    session: Session,
    user_id: uuid.UUID,
    org_node_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> AuthUser:
    user = get_user(session, user_id)
    if session.get(AuthOrgNode, org_node_id) is None:
        raise UserError("ORG_NOT_FOUND", "Org node not found", 404)
    user.org_node_id = org_node_id
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.org.assign",
        detail={"org_node_id": str(org_node_id)},
        trace_id=trace_id,
    )
    session.commit()
    session.refresh(user)
    return user


def get_user_org(session: Session, user_id: uuid.UUID) -> AuthOrgNode | None:
    user = get_user(session, user_id)
    if user.org_node_id is None:
        return None
    return session.get(AuthOrgNode, user.org_node_id)


def clear_user_org(
    session: Session,
    user_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> None:
    user = get_user(session, user_id)
    if user.org_node_id is None:
        return
    org_id = user.org_node_id
    user.org_node_id = None
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=user_id,
        action="user.org.clear",
        detail={"org_node_id": str(org_id)},
        trace_id=trace_id,
    )
    session.commit()


def delete_user(
    session: Session,
    user_id: uuid.UUID,
    *,
    actor_id: str,
    actor_username: str | None,
    actor_roles: list[str],
    trace_id: str,
) -> None:
    """删除用户及其角色绑定；保护最后一个 root 管理员与当前登录账号。"""
    user = get_user(session, user_id)
    if str(user.id) == actor_id:
        raise UserError("USER_SELF_DELETE_FORBIDDEN", "Cannot delete your own account", 409)
    had_root = _user_has_enabled_root_binding(session, user_id)
    target_id = user.id
    username = user.username
    _audit_user_event(
        session,
        actor_id=actor_id,
        actor_username=actor_username,
        target_id=target_id,
        action="user.delete",
        detail={"username": username},
        trace_id=trace_id,
    )
    session.delete(user)
    if had_root:
        _guard_root_admin(session)
    session.commit()
