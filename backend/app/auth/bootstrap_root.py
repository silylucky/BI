"""根管理员引导与不变量。

提供两件能力：

1. ``assert_root_admin_survives`` —— 系统不变量：任何变更提交前，至少保留一个
   「启用用户 × 启用 root 角色」的绑定。通过对 root 角色行加 ``FOR UPDATE`` 锁，
   使并发移除最后 root 绑定的事务串行化，从而保证至少一个事务收到 409。
2. ``bootstrap_root`` / CLI —— 幂等、fail-closed 地创建唯一 root 管理员用户并绑定
   root 角色。密码缺失时拒绝执行；``allow_existing`` 控制同名用户是否可复用。
"""

from __future__ import annotations

import sys
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.audit.service import record_event
from app.auth.models import AuthRole, AuthUser, AuthUserRole
from app.auth.password.service import hash_password

ROOT_ROLE_CODE = "admin"
# 确定性 root 角色 ID：仅在全新库首次插入时生效；已存在 admin 角色时按 code upsert 保留原 ID。
ROOT_ADMIN_ROLE_ID = uuid.UUID("00000000-0000-0000-0000-0000000000ad")


class RootAdminRequiredError(Exception):
    """移除/禁用后将不再存在任何启用 root 管理员。"""

    code = "AUTH_ROOT_ADMIN_REQUIRED"
    status = 409

    def __init__(self, message: str = "At least one enabled root admin must remain") -> None:
        self.message = message
        super().__init__(message)


class BootstrapError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _supports_for_update(session: Session) -> bool:
    try:
        return session.get_bind().dialect.name != "sqlite"
    except Exception:
        return False


def _lock_root_roles(session: Session) -> None:
    """锁定所有 root 角色行，串行化并发的 root 不变量校验。"""
    stmt = select(AuthRole.id).where(AuthRole.is_root.is_(True))
    if _supports_for_update(session):
        stmt = stmt.with_for_update()
    session.execute(stmt).all()


def count_enabled_root_users(
    session: Session,
    *,
    excluding_user_id: uuid.UUID | None = None,
    excluding_role_id: uuid.UUID | None = None,
) -> int:
    """统计启用用户 × 启用 root 角色的去重绑定数（可排除某用户 / 某角色）。"""
    stmt = (
        select(func.count(func.distinct(AuthUser.id)))
        .select_from(AuthUser)
        .join(AuthUserRole, AuthUserRole.user_id == AuthUser.id)
        .join(AuthRole, AuthRole.id == AuthUserRole.role_id)
        .where(
            AuthUser.is_active.is_(True),
            AuthRole.is_root.is_(True),
            AuthRole.is_active.is_(True),
        )
    )
    if excluding_user_id is not None:
        stmt = stmt.where(AuthUser.id != excluding_user_id)
    if excluding_role_id is not None:
        stmt = stmt.where(AuthRole.id != excluding_role_id)
    return int(session.scalar(stmt) or 0)


def _find_enabled_root_user(session: Session) -> AuthUser | None:
    """返回任一「启用用户 × 启用 root 角色」绑定对应的用户，不存在则 None。"""
    stmt = (
        select(AuthUser)
        .join(AuthUserRole, AuthUserRole.user_id == AuthUser.id)
        .join(AuthRole, AuthRole.id == AuthUserRole.role_id)
        .where(
            AuthUser.is_active.is_(True),
            AuthRole.is_root.is_(True),
            AuthRole.is_active.is_(True),
        )
        .limit(1)
    )
    return session.scalar(stmt)


def has_enabled_root_user(session: Session) -> bool:
    """是否存在至少一个「启用用户 × 启用 root 角色」绑定（部署门禁判据）。"""
    return _find_enabled_root_user(session) is not None


def assert_root_admin_survives(
    session: Session,
    *,
    excluding_user_id: uuid.UUID | None = None,
    excluding_role_id: uuid.UUID | None = None,
) -> None:
    """校验根管理员不变量；违反时抛 ``RootAdminRequiredError``。

    调用方应在**已对会话施加待提交变更之后、commit 之前**调用本函数，使统计反映
    最新状态。函数内部对 root 角色行加锁，保证并发下的串行化。
    """
    _lock_root_roles(session)
    surviving = count_enabled_root_users(
        session,
        excluding_user_id=excluding_user_id,
        excluding_role_id=excluding_role_id,
    )
    if surviving == 0:
        raise RootAdminRequiredError()


def ensure_root_role(session: Session) -> AuthRole:
    """获取或创建唯一 root 角色（code='admin'），并保证 is_root/is_system/启用。"""
    stmt = select(AuthRole).where(AuthRole.code == ROOT_ROLE_CODE)
    if _supports_for_update(session):
        stmt = stmt.with_for_update()
    role = session.scalar(stmt)
    if role is None:
        role = AuthRole(
            id=ROOT_ADMIN_ROLE_ID,
            code=ROOT_ROLE_CODE,
            name="管理员",
            is_active=True,
            is_system=True,
            is_root=True,
        )
        session.add(role)
        session.flush()
        return role
    role.is_system = True
    role.is_root = True
    role.is_active = True
    session.flush()
    return role


def ensure_admin_username_root_binding(
    session: Session,
    *,
    username: str = "admin",
) -> bool:
    """幂等修复：用户存在且启用、但未绑定 root admin 角色时补绑。

    0025 迁移只标记 admin 角色 ``is_root``，不写 ``auth_user_roles``。若库中已有
    其他启用 root 用户（常见于测试残留），``bootstrap_root`` 会短路，仍须靠本函数
    把 ``username=admin`` 绑回 root，否则登录 admin 无权限。

    Returns:
        True 若本次新建了绑定；False 若无需修复或用户不存在。
    """
    user = session.scalar(select(AuthUser).where(AuthUser.username == username))
    if user is None or not user.is_active:
        return False
    role = ensure_root_role(session)
    binding = session.get(AuthUserRole, {"user_id": user.id, "role_id": role.id})
    if binding is None:
        session.add(AuthUserRole(user_id=user.id, role_id=role.id))
        session.commit()
        return True
    return False


def bootstrap_root(
    session: Session,
    *,
    username: str,
    password: str | None,
    allow_existing: bool = False,
) -> AuthUser:
    """幂等创建 root 管理员用户并绑定 root 角色。密码缺失即拒绝（fail closed）。

    前置短路：仅在当前不存在启用 root 用户时才读取环境变量并施加变更。已存在启用
    root 用户时（含并发下另一进程已完成引导）幂等成功退出——不创建用户、不改密码。
    """
    # 前置短路：已有启用 root 用户则视为「已初始化」，直接返回，不读密码、不改状态。
    existing_root = _find_enabled_root_user(session)
    if existing_root is not None:
        return existing_root

    if not password:
        raise BootstrapError(
            "AUTH_BOOTSTRAP_PASSWORD_REQUIRED",
            "bootstrap admin password is required (VITALSPAN_BOOTSTRAP_ADMIN_PASSWORD)",
        )

    try:
        role = ensure_root_role(session)
        existing = session.scalar(select(AuthUser).where(AuthUser.username == username))
        if existing is not None and not allow_existing:
            raise BootstrapError(
                "AUTH_BOOTSTRAP_USER_EXISTS",
                f"user {username!r} already exists; set VITALSPAN_BOOTSTRAP_ALLOW_EXISTING=true to reuse",
            )

        if existing is None:
            user = AuthUser(
                username=username,
                display_name="Root Admin",
                password_hash=hash_password(password),
                is_active=True,
            )
            session.add(user)
            session.flush()
        else:
            user = existing
            user.is_active = True
            user.password_hash = hash_password(password)
            session.flush()

        binding = session.get(AuthUserRole, {"user_id": user.id, "role_id": role.id})
        if binding is None:
            session.add(AuthUserRole(user_id=user.id, role_id=role.id))

        record_event(
            session,
            actor_id="bootstrap",
            actor_username="bootstrap",
            target_type="user",
            target_id=user.id,
            action="user.bootstrap_root",
            detail={"username": username, "role_id": str(role.id)},
            trace_id="bootstrap",
        )
        session.commit()
    except IntegrityError as exc:
        # 并发写冲突（flush 或 commit 触发）：另一进程可能已完成引导。回滚后重判：
        # 已出现启用 root 则幂等成功；allow_existing 且同名用户已在则复用；否则收敛为冲突错误。
        session.rollback()
        refreshed_root = _find_enabled_root_user(session)
        if refreshed_root is not None:
            return refreshed_root
        if allow_existing:
            refreshed = session.scalar(select(AuthUser).where(AuthUser.username == username))
            if refreshed is not None:
                return refreshed
        raise BootstrapError(
            "AUTH_BOOTSTRAP_CONFLICT",
            "concurrent bootstrap detected; rerun with VITALSPAN_BOOTSTRAP_ALLOW_EXISTING=true",
        ) from exc
    session.refresh(user)
    return user


def main(argv: list[str] | None = None) -> int:
    from app.auth.models import get_meta_session
    from app.core.config import get_settings

    settings = get_settings()
    session = get_meta_session()
    try:
        repaired = ensure_admin_username_root_binding(
            session, username=settings.vitalspan_bootstrap_admin_username
        )
        if repaired:
            user = session.scalar(
                select(AuthUser).where(
                    AuthUser.username == settings.vitalspan_bootstrap_admin_username
                )
            )
            print(
                f"[bootstrap-root] repaired: {user.username} ({user.id}) "
                "bound to root admin role"
            )
            return 0

        try:
            user = bootstrap_root(
                session,
                username=settings.vitalspan_bootstrap_admin_username,
                password=settings.vitalspan_bootstrap_admin_password,
                allow_existing=settings.vitalspan_bootstrap_allow_existing,
            )
        except BootstrapError as exc:
            print(f"[bootstrap-root] failed: {exc.code}: {exc.message}", file=sys.stderr)
            return 1
        print(f"[bootstrap-root] ok: root admin {user.username} ({user.id})")
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
