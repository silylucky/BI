from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.audit.service import record_event
from app.auth.models import (
    AuthPermission,
    AuthRole,
    AuthRolePermission,
    AuthUser,
    AuthUserRole,
)
from app.auth.permissions.catalog import PERMISSION_BY_CODE, is_catalog_code
from app.auth.permissions.constants import permission_id_for_code
from app.auth.schemas import RolePermissionsOut


class PermissionServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 400) -> None:
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


@dataclass(frozen=True)
class AuditWriteContext:
    actor_id: str
    actor_username: str | None
    trace_id: str


def resolve_user_permissions(session: Session, user_id: uuid.UUID) -> tuple[set[str], bool]:
    """聚合用户有效权限：启用用户 + 启用角色的精确 code；root 短路返回空集 + True。"""
    user = session.get(AuthUser, user_id)
    if user is None or not user.is_active:
        return set(), False

    roles = session.scalars(
        select(AuthRole)
        .join(AuthUserRole, AuthUserRole.role_id == AuthRole.id)
        .where(AuthUserRole.user_id == user_id, AuthRole.is_active.is_(True))
    ).all()

    if any(role.is_root for role in roles):
        return set(), True

    role_ids = [role.id for role in roles]
    if not role_ids:
        return set(), False

    codes = session.scalars(
        select(AuthPermission.code)
        .join(AuthRolePermission, AuthRolePermission.permission_id == AuthPermission.id)
        .where(AuthRolePermission.role_id.in_(role_ids))
    ).all()
    return set(codes), False


def get_role_permissions(session: Session, role_id: uuid.UUID) -> RolePermissionsOut:
    """读取角色权限绑定：root 角色返回 allPermissions=True 且空 codes。"""
    role = session.get(AuthRole, role_id)
    if role is None:
        raise PermissionServiceError("ROLE_NOT_FOUND", "Role not found", 404)
    if role.is_root:
        return RolePermissionsOut(
            role_id=role_id,
            permission_codes=[],
            version=role.permission_version,
            all_permissions=True,
        )
    codes = session.scalars(
        select(AuthPermission.code)
        .join(AuthRolePermission, AuthRolePermission.permission_id == AuthPermission.id)
        .where(AuthRolePermission.role_id == role_id)
    ).all()
    return RolePermissionsOut(
        role_id=role_id,
        permission_codes=sorted(codes),
        version=role.permission_version,
        all_permissions=False,
    )


def _ensure_permission_row(session: Session, code: str) -> uuid.UUID:
    """按目录定义确定性 upsert 权限行，返回 permission_id。"""
    pid = permission_id_for_code(code)
    if session.get(AuthPermission, pid) is None:
        definition = PERMISSION_BY_CODE[code]
        session.add(
            AuthPermission(
                id=pid,
                code=definition.code,
                name=definition.name,
                domain=definition.domain,
                description=definition.description,
            )
        )
        session.flush()
    return pid


def _validate_codes(codes: list[str]) -> list[str]:
    """去重并校验：非目录精确编码（含通配）一律 PERMISSION_CODE_INVALID。"""
    seen: set[str] = set()
    ordered: list[str] = []
    for code in codes:
        if not is_catalog_code(code):
            raise PermissionServiceError(
                "PERMISSION_CODE_INVALID",
                f"Permission code {code!r} is not a registered catalog code",
                422,
            )
        if code not in seen:
            seen.add(code)
            ordered.append(code)
    return ordered


def replace_role_permissions(
    session: Session,
    role_id: uuid.UUID,
    codes: list[str],
    expected_version: int,
    audit: AuditWriteContext,
) -> RolePermissionsOut:
    """全量替换角色权限：锁角色、拒 root、校验 version、拒通配入库、删旧插新、version+1、审计、单次 commit。"""
    role = session.get(AuthRole, role_id, with_for_update=True)
    if role is None:
        raise PermissionServiceError("ROLE_NOT_FOUND", "Role not found", 404)
    if role.is_root:
        raise PermissionServiceError(
            "AUTH_ROOT_ROLE_IMMUTABLE",
            "Root role permissions cannot be replaced",
            409,
        )
    if role.permission_version != expected_version:
        raise PermissionServiceError(
            "ROLE_PERMISSION_VERSION_CONFLICT",
            "Role permission version conflict, reload and retry",
            409,
        )

    new_codes = _validate_codes(codes)

    before_codes = session.scalars(
        select(AuthPermission.code)
        .join(AuthRolePermission, AuthRolePermission.permission_id == AuthPermission.id)
        .where(AuthRolePermission.role_id == role_id)
    ).all()

    session.execute(delete(AuthRolePermission).where(AuthRolePermission.role_id == role_id))
    for code in new_codes:
        pid = _ensure_permission_row(session, code)
        session.add(AuthRolePermission(role_id=role_id, permission_id=pid))

    role.permission_version = role.permission_version + 1
    new_version = role.permission_version

    record_event(
        session,
        actor_id=audit.actor_id,
        actor_username=audit.actor_username,
        target_type="role",
        target_id=role_id,
        action="role.permissions.replace",
        detail={"before": sorted(before_codes), "after": sorted(new_codes)},
        trace_id=audit.trace_id,
    )

    session.commit()

    return RolePermissionsOut(
        role_id=role_id,
        permission_codes=sorted(new_codes),
        version=new_version,
        all_permissions=False,
    )
