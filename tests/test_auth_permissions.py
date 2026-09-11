import json
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends
from sqlalchemy import select

from app.auth.models import (
    AuthAuditEvent,
    AuthPermission,
    AuthRole,
    AuthRolePermission,
    AuthUser,
    AuthUserRole,
    Base,
    get_meta_engine,
    get_meta_session,
)

# --------------------------------------------------------------------------- #
# Task 4: 在共享 app 上注册最小受保护路由，驱动统一权限依赖的 HTTP 级鉴权矩阵。
# --------------------------------------------------------------------------- #
_REQUIRE_READ_PATH = "/api/v1/_test/require-user-read"
_REQUIRE_ANY_PATH = "/api/v1/_test/require-any"


def _register_test_routes() -> None:
    from app.auth.deps import require_any_permission, require_permission
    from app.main import app

    if any(getattr(route, "path", None) == _REQUIRE_READ_PATH for route in app.routes):
        return

    @app.get(_REQUIRE_READ_PATH)
    async def _require_user_read(_user=Depends(require_permission("system:user.read"))):
        return {"ok": True}

    @app.get(_REQUIRE_ANY_PATH)
    async def _require_any(
        _user=Depends(require_any_permission("system:user.read", "system:role.read")),
    ):
        return {"ok": True}


_register_test_routes()


def test_permission_models_have_required_constraints():
    """T-PERM-01: 权限表 code 唯一，角色权限绑定复合主键。"""
    assert AuthPermission.__table__.c.code.unique
    assert AuthRole.__table__.c.code.unique
    assert set(AuthRolePermission.__table__.primary_key.columns.keys()) == {
        "role_id",
        "permission_id",
    }


def test_role_and_user_security_fields_exist():
    """T-PERM-02: 角色与用户安全字段齐备。"""
    assert {"is_system", "is_root", "permission_version", "rls_version"} <= set(
        AuthRole.__table__.c.keys()
    )
    assert {
        "is_active",
        "failed_login_count",
        "locked_until",
        "password_changed_at",
        "updated_at",
        "token_version",
    } <= set(AuthUser.__table__.c.keys())


def test_auth_roles_root_code_check_constraint():
    """T-PERM-03: auth_roles 存在 root code CHECK 约束。"""
    check_names = {
        c.name for c in AuthRole.__table__.constraints if c.__class__.__name__ == "CheckConstraint"
    }
    assert "ck_auth_roles_root_code" in check_names


# --------------------------------------------------------------------------- #
# Task 2: 权限匹配、目录与角色权限服务
# --------------------------------------------------------------------------- #


def _new_session():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    return get_meta_session()


def _make_role(session, *, code=None, is_root=False, is_active=True, permission_version=0):
    if is_root:
        # root code CHECK 约束强制 code='admin'，且全局唯一 → 复用或提升现有 admin 角色。
        role = session.scalar(select(AuthRole).where(AuthRole.code == "admin"))
        if role is None:
            role = AuthRole(code="admin", name="admin")
            session.add(role)
        role.is_root = True
        role.is_system = True
        role.is_active = is_active
        session.commit()
        session.refresh(role)
        return role
    if code is None:
        code = f"r_{uuid_mod.uuid4().hex[:10]}"
    role = AuthRole(
        code=code,
        name=code,
        is_root=is_root,
        is_system=is_root,
        is_active=is_active,
        permission_version=permission_version,
    )
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def _make_user(session, *, is_active=True, role_ids=()):
    user = AuthUser(username=f"u_{uuid_mod.uuid4().hex[:10]}", is_active=is_active)
    session.add(user)
    session.commit()
    session.refresh(user)
    for rid in role_ids:
        session.add(AuthUserRole(user_id=user.id, role_id=rid))
    session.commit()
    return user


def _audit_ctx():
    from app.auth.permissions import AuditWriteContext

    return AuditWriteContext(actor_id="dev", actor_username="dev", trace_id="t-perm")


def test_permission_matches_semantics():
    """T-PERM-10: permission_matches 精确/通配/root/缺权限。"""
    from app.auth.permissions import permission_matches

    assert permission_matches({"system:user.read"}, "system:user.read", False)
    assert permission_matches({"system:*"}, "system:user.manage", False)
    assert permission_matches(set(), "system:user.manage", True)
    assert not permission_matches({"system:user.read"}, "system:user.manage", False)


def test_permission_catalog_contains_full_set():
    """T-PERM-11: 目录含 §5.1 全集 + theme/ingestion。"""
    from app.auth.permissions import PERMISSION_CATALOG

    codes = {definition.code for definition in PERMISSION_CATALOG}
    required = {
        "system:role.read",
        "system:role.manage",
        "system:user.read",
        "system:user.manage",
        "system:user.password.reset",
        "system:grant.read",
        "system:grant.manage",
        "system:rls.read",
        "system:rls.manage",
        "system:org.read",
        "system:org.manage",
        "system:audit.read",
        "datasource:read",
        "datasource:manage",
        "dashboard:read",
        "dashboard:edit",
        "report:read",
        "report:manage",
        "dataset:read",
        "dataset:manage",
        "metadata:read",
        "metadata:manage",
        "governance:read",
        "governance:manage",
        "theme:read",
        "theme:manage",
        "ingestion:read",
        "ingestion:manage",
    }
    assert required <= codes
    # 目录不得包含通配编码
    assert not any(":" in c and c.endswith(":*") for c in codes)


def test_replace_role_permissions_rejects_unknown_code():
    """T-PERM-12: 未登记编码 → PERMISSION_CODE_INVALID。"""
    from app.auth.permissions import (
        PermissionServiceError,
        replace_role_permissions,
    )

    session = _new_session()
    try:
        role = _make_role(session)
        with pytest.raises(PermissionServiceError) as exc:
            replace_role_permissions(
                session,
                role.id,
                ["system:not.a.real.code"],
                expected_version=0,
                audit=_audit_ctx(),
            )
        assert exc.value.code == "PERMISSION_CODE_INVALID"
        assert exc.value.status == 422
    finally:
        session.close()


def test_replace_role_permissions_rejects_wildcard_persist():
    """T-PERM-13: domain:* 通配入库 → PERMISSION_CODE_INVALID。"""
    from app.auth.permissions import (
        PermissionServiceError,
        replace_role_permissions,
    )

    session = _new_session()
    try:
        role = _make_role(session)
        with pytest.raises(PermissionServiceError) as exc:
            replace_role_permissions(
                session,
                role.id,
                ["system:*"],
                expected_version=0,
                audit=_audit_ctx(),
            )
        assert exc.value.code == "PERMISSION_CODE_INVALID"
    finally:
        session.close()


def test_replace_role_permissions_rejects_root_role():
    """T-PERM-14: root 角色权限不可替换。"""
    from app.auth.permissions import (
        PermissionServiceError,
        replace_role_permissions,
    )

    session = _new_session()
    try:
        role = _make_role(session, is_root=True)
        with pytest.raises(PermissionServiceError) as exc:
            replace_role_permissions(
                session,
                role.id,
                ["system:user.read"],
                expected_version=0,
                audit=_audit_ctx(),
            )
        assert exc.value.code == "AUTH_ROOT_ROLE_IMMUTABLE"
        assert exc.value.status == 409
    finally:
        session.close()


def test_replace_role_permissions_version_conflict():
    """T-PERM-15: expected_version 不一致 → 409 ROLE_PERMISSION_VERSION_CONFLICT。"""
    from app.auth.permissions import (
        PermissionServiceError,
        replace_role_permissions,
    )

    session = _new_session()
    try:
        role = _make_role(session, permission_version=3)
        with pytest.raises(PermissionServiceError) as exc:
            replace_role_permissions(
                session,
                role.id,
                ["system:user.read"],
                expected_version=0,
                audit=_audit_ctx(),
            )
        assert exc.value.code == "ROLE_PERMISSION_VERSION_CONFLICT"
        assert exc.value.status == 409
    finally:
        session.close()


def test_replace_role_permissions_success_bumps_version_and_audits():
    """T-PERM-16: 替换成功 version+1；审计 before/after codes。"""
    from app.auth.permissions import replace_role_permissions

    session = _new_session()
    try:
        role = _make_role(session)
        role_id = role.id
        first = replace_role_permissions(
            session,
            role_id,
            ["system:user.read", "system:user.manage"],
            expected_version=0,
            audit=_audit_ctx(),
        )
        assert first.version == 1
        assert first.all_permissions is False
        assert set(first.permission_codes) == {"system:user.read", "system:user.manage"}

        # 绑定行入库
        bound = session.scalars(
            select(AuthPermission.code)
            .join(AuthRolePermission, AuthRolePermission.permission_id == AuthPermission.id)
            .where(AuthRolePermission.role_id == role_id)
        ).all()
        assert set(bound) == {"system:user.read", "system:user.manage"}

        second = replace_role_permissions(
            session,
            role_id,
            ["system:user.read"],
            expected_version=1,
            audit=_audit_ctx(),
        )
        assert second.version == 2
        assert set(second.permission_codes) == {"system:user.read"}

        events = session.scalars(
            select(AuthAuditEvent).where(
                AuthAuditEvent.target_id == role_id,
                AuthAuditEvent.action == "role.permissions.replace",
            )
        ).all()
        assert len(events) == 2
        transitions = set()
        for event in events:
            detail = json.loads(event.detail)
            assert set(detail.keys()) == {"before", "after"}
            transitions.add((tuple(detail["before"]), tuple(detail["after"])))
        assert (tuple(), ("system:user.manage", "system:user.read")) in transitions
        assert (
            ("system:user.manage", "system:user.read"),
            ("system:user.read",),
        ) in transitions
    finally:
        session.close()


def test_resolve_user_permissions_aggregates_active_only():
    """T-PERM-17: 仅聚合启用用户+启用角色的精确 code。"""
    from app.auth.permissions import replace_role_permissions, resolve_user_permissions

    session = _new_session()
    try:
        active_role = _make_role(session)
        disabled_role = _make_role(session, is_active=False)
        replace_role_permissions(
            session,
            active_role.id,
            ["dashboard:read", "report:read"],
            expected_version=0,
            audit=_audit_ctx(),
        )
        # 停用角色的权限不应出现在聚合结果里；直接插入绑定
        pid = session.scalar(
            select(AuthPermission.id).where(AuthPermission.code == "dashboard:read")
        )
        session.add(AuthRolePermission(role_id=disabled_role.id, permission_id=pid))
        session.commit()

        user = _make_user(session, role_ids=[active_role.id, disabled_role.id])
        perms, is_root = resolve_user_permissions(session, user.id)
        assert is_root is False
        assert perms == {"dashboard:read", "report:read"}
    finally:
        session.close()


def test_resolve_user_permissions_root_short_circuits():
    """T-PERM-18: is_root=true 不查 role_permissions，返回空集 + True。"""
    from app.auth.permissions import resolve_user_permissions

    session = _new_session()
    try:
        root_role = _make_role(session, is_root=True)
        user = _make_user(session, role_ids=[root_role.id])
        perms, is_root = resolve_user_permissions(session, user.id)
        assert is_root is True
        assert perms == set()
    finally:
        session.close()


def test_resolve_user_permissions_disabled_user_empty():
    """T-PERM-19: 停用用户返回空集且非 root。"""
    from app.auth.permissions import resolve_user_permissions

    session = _new_session()
    try:
        root_role = _make_role(session, is_root=True)
        user = _make_user(session, is_active=False, role_ids=[root_role.id])
        perms, is_root = resolve_user_permissions(session, user.id)
        assert perms == set()
        assert is_root is False
    finally:
        session.close()


def test_permission_id_for_code_is_deterministic():
    """T-PERM-20: permission_id_for_code UUIDv5 稳定且命名空间固定。"""
    from app.auth.permissions.constants import (
        PERMISSION_NAMESPACE_UUID,
        permission_id_for_code,
    )

    assert PERMISSION_NAMESPACE_UUID == uuid_mod.UUID("6f3e2a1b-8c4d-5e6f-9a0b-1c2d3e4f5a6b")
    once = permission_id_for_code("system:user.read")
    twice = permission_id_for_code("system:user.read")
    assert once == twice
    assert once == uuid_mod.uuid5(PERMISSION_NAMESPACE_UUID, "system:user.read")


# --------------------------------------------------------------------------- #
# Task 3: 根管理员不变量（assert_root_admin_survives）
# --------------------------------------------------------------------------- #


def _reset_root_state(session):
    """将 root 状态归零：确保唯一 admin root 角色存在且无任何 root 绑定。"""
    from app.auth.bootstrap_root import ensure_root_role

    role = ensure_root_role(session)
    session.query(AuthUserRole).filter(AuthUserRole.role_id == role.id).delete()
    session.commit()
    return role


def test_assert_root_admin_survives_passes_with_enabled_root():
    """T-PERM-21: 存在启用 root 用户时不变量通过。"""
    from app.auth.bootstrap_root import assert_root_admin_survives

    session = _new_session()
    try:
        root = _reset_root_state(session)
        _make_user(session, role_ids=[root.id])
        assert_root_admin_survives(session)
    finally:
        session.close()


def test_assert_root_admin_survives_raises_when_none():
    """T-PERM-22: 无任何启用 root 绑定 → RootAdminRequiredError(409)。"""
    from app.auth.bootstrap_root import (
        RootAdminRequiredError,
        assert_root_admin_survives,
    )

    session = _new_session()
    try:
        _reset_root_state(session)
        with pytest.raises(RootAdminRequiredError) as exc:
            assert_root_admin_survives(session)
        assert exc.value.code == "AUTH_ROOT_ADMIN_REQUIRED"
        assert exc.value.status == 409
    finally:
        session.close()


def test_count_enabled_root_users_excludes_disabled_and_excluded():
    """T-PERM-23: 统计仅计启用用户；excluding_user_id 排除指定用户。"""
    from app.auth.bootstrap_root import count_enabled_root_users

    session = _new_session()
    try:
        root = _reset_root_state(session)
        u1 = _make_user(session, role_ids=[root.id])
        u2 = _make_user(session, role_ids=[root.id])
        _make_user(session, is_active=False, role_ids=[root.id])
        assert count_enabled_root_users(session) == 2
        assert count_enabled_root_users(session, excluding_user_id=u1.id) == 1
        assert count_enabled_root_users(
            session, excluding_role_id=root.id
        ) == 0
        assert u2.id is not None
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# Task 4: UserContext、Middleware 与统一权限依赖的鉴权矩阵
# --------------------------------------------------------------------------- #

def _admin_info() -> dict:
    from jwt_auth import resolve_admin_user_id

    return {
        "id": resolve_admin_user_id(),
        "username": "admin",
        "token_version": 1,
    }


def _make_user_with_permissions(session, codes, *, is_active=True, locked=False):
    from app.auth.permissions import replace_role_permissions

    role = _make_role(session)
    if codes:
        replace_role_permissions(
            session, role.id, list(codes), expected_version=0, audit=_audit_ctx()
        )
    user = _make_user(session, is_active=is_active, role_ids=[role.id])
    if locked:
        user.locked_until = datetime.now(timezone.utc) + timedelta(hours=1)
        session.commit()
        session.refresh(user)
    return {"id": str(user.id), "username": user.username, "token_version": user.token_version}


def _bearer(user_info, *, token_version=None):
    from app.auth.jwt import create_access_token

    version = user_info["token_version"] if token_version is None else token_version
    token = create_access_token(user_info["id"], user_info["username"], token_version=version)
    return {"Authorization": f"Bearer {token}"}


def test_matrix_anonymous_returns_401(client):
    """T-AUTHZ-01: 匿名访问受保护路由 → 401 UNAUTHORIZED。"""
    response = client.get(_REQUIRE_READ_PATH)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_matrix_authenticated_without_permission_returns_403(client):
    """T-AUTHZ-02: 已登录但无功能权限 → 403 顶层 PERMISSION_DENIED。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, [])
    finally:
        session.close()
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(info))
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "PERMISSION_DENIED"
    assert body["detail"] is None
    assert "system:user.read" in body["message"]


def test_matrix_exact_permission_success(client):
    """T-AUTHZ-03: 命中精确权限 → 200。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:user.read"])
    finally:
        session.close()
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(info))
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_matrix_root_success(client):
    """T-AUTHZ-04: root 用户直通 → 200。"""
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(_admin_info()))
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_matrix_wildcard_and_root_dependency_unit():
    """T-AUTHZ-05: require_permission/any 对 domain:* 通配与 root 的单元行为。"""
    import asyncio

    from app.auth.deps import (
        PermissionDeniedError,
        UserContext,
        require_any_permission,
        require_permission,
    )

    dep = require_permission("system:user.manage")
    wildcard = UserContext(
        id="1", username="w", roles=[], permissions={"system:*"}, is_root=False
    )
    assert asyncio.run(dep(user=wildcard)).id == "1"

    root_ctx = UserContext(id="2", username="r", roles=[], permissions=set(), is_root=True)
    assert asyncio.run(dep(user=root_ctx)).id == "2"

    no_perm = UserContext(id="3", username="n", roles=[], permissions=set(), is_root=False)
    with pytest.raises(PermissionDeniedError):
        asyncio.run(dep(user=no_perm))

    any_dep = require_any_permission("system:user.read", "system:role.read")
    partial = UserContext(
        id="4", username="p", roles=[], permissions={"system:role.read"}, is_root=False
    )
    assert asyncio.run(any_dep(user=partial)).id == "4"
    with pytest.raises(PermissionDeniedError):
        asyncio.run(any_dep(user=no_perm))


def test_matrix_disabled_user_returns_403(client):
    """T-AUTHZ-06: 禁用用户即便角色带权限，也因即时失效 → 403。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:user.read"], is_active=False)
    finally:
        session.close()
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(info))
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_USER_DISABLED"


def test_matrix_locked_user_returns_403(client):
    """T-AUTHZ-07: 锁定未到期用户 → 权限清空 → 403。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:user.read"], locked=True)
    finally:
        session.close()
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(info))
    assert response.status_code == 403
    assert response.json()["code"] == "AUTH_USER_LOCKED"


def test_matrix_token_version_mismatch_returns_401(client):
    """T-AUTHZ-08: JWT tokenVersion 与 DB 不一致 → 401 TOKEN_REVOKED。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:user.read"])
    finally:
        session.close()

    ok = client.get(_REQUIRE_READ_PATH, headers=_bearer(info, token_version=1))
    assert ok.status_code == 200

    bump = _new_session()
    try:
        user = bump.get(AuthUser, uuid_mod.UUID(info["id"]))
        user.token_version = 2
        bump.commit()
    finally:
        bump.close()

    revoked = client.get(_REQUIRE_READ_PATH, headers=_bearer(info, token_version=1))
    assert revoked.status_code == 401
    assert revoked.json()["code"] == "TOKEN_REVOKED"


def test_matrix_db_error_returns_503(client, monkeypatch):
    """T-AUTHZ-09: 权限解析抛 DB 异常 → fail-closed 503 AUTH_CONTEXT_UNAVAILABLE。"""
    from sqlalchemy.exc import OperationalError

    def _boom(*_args, **_kwargs):
        raise OperationalError("stmt", {}, Exception("db down"))

    monkeypatch.setattr("app.auth.middleware.resolve_user_permissions", _boom)
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(_admin_info()))
    assert response.status_code == 503
    assert response.json()["code"] == "AUTH_CONTEXT_UNAVAILABLE"


def test_matrix_no_root_initialized_returns_503(client, monkeypatch):
    """T-AUTHZ-10: 无启用 root（bootstrap 未完成）→ 受保护 503；公开路径不受影响。"""
    monkeypatch.setattr("app.auth.middleware.has_enabled_root_user", lambda _session: False)
    response = client.get(_REQUIRE_READ_PATH, headers=_bearer(_admin_info()))
    assert response.status_code == 503
    assert response.json()["code"] == "AUTH_ROOT_NOT_INITIALIZED"

    assert client.get("/health").status_code == 200


# --------------------------------------------------------------------------- #
# Task 5: 权限目录与角色权限 API（HTTP 契约与鉴权矩阵）
# --------------------------------------------------------------------------- #
_PERMISSIONS_PATH = "/api/v1/permissions"


def _make_target_role(session, *, permission_version=0):
    """构造一个受操作的普通目标角色，返回其 UUID 字符串。"""
    role = _make_role(session, permission_version=permission_version)
    return str(role.id)


def test_api_permissions_catalog_requires_role_read(client):
    """T-PERM-API-01: 无 system:role.read 读取权限目录 → 403 PERMISSION_DENIED。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, [])
    finally:
        session.close()
    resp = client.get(_PERMISSIONS_PATH, headers=_bearer(info))
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"


def test_api_permissions_catalog_returns_full_set_camelcase(client):
    """T-PERM-API-02: system:role.read 读取目录 → 200，含全集且仅 camelCase 字段。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.read"])
    finally:
        session.close()
    resp = client.get(_PERMISSIONS_PATH, headers=_bearer(info))
    assert resp.status_code == 200
    body = resp.json()
    codes = {item["code"] for item in body["items"]}
    assert {"system:role.read", "system:role.manage", "dashboard:read"} <= codes
    # 目录不含通配编码
    assert not any(c.endswith(":*") for c in codes)
    sample = body["items"][0]
    assert {"id", "code", "name", "domain", "description"} <= set(sample.keys())


def test_api_role_permissions_get_requires_role_read(client):
    """T-PERM-API-03: 无 system:role.read 读取角色绑定 → 403。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, [])
        target_id = _make_target_role(session)
    finally:
        session.close()
    resp = client.get(f"/api/v1/roles/{target_id}/permissions", headers=_bearer(info))
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"


def test_api_role_permissions_get_returns_codes_and_version(client):
    """T-PERM-API-04: 读取普通角色绑定 → allPermissions=false + version + codes。"""
    from app.auth.permissions import replace_role_permissions

    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.read"])
        target = _make_role(session)
        target_id = str(target.id)
        replace_role_permissions(
            session, target.id, ["dashboard:read"], expected_version=0, audit=_audit_ctx()
        )
    finally:
        session.close()
    resp = client.get(f"/api/v1/roles/{target_id}/permissions", headers=_bearer(info))
    assert resp.status_code == 200
    body = resp.json()
    assert body["roleId"] == target_id
    assert body["allPermissions"] is False
    assert body["version"] == 1
    assert body["permissionCodes"] == ["dashboard:read"]


def test_api_role_permissions_get_root_all_permissions(client):
    """T-PERM-API-05: root 角色绑定 → allPermissions=true，codes 为空。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.read"])
        root = _make_role(session, is_root=True)
        root_id = str(root.id)
    finally:
        session.close()
    resp = client.get(f"/api/v1/roles/{root_id}/permissions", headers=_bearer(info))
    assert resp.status_code == 200
    body = resp.json()
    assert body["allPermissions"] is True
    assert body["permissionCodes"] == []


def test_api_role_permissions_put_requires_role_manage(client):
    """T-PERM-API-06: 仅有 role.read 无 role.manage → PUT 403。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.read"])
        target_id = _make_target_role(session)
    finally:
        session.close()
    resp = client.put(
        f"/api/v1/roles/{target_id}/permissions",
        headers=_bearer(info),
        json={"permissionCodes": ["dashboard:read"], "expectedVersion": 0},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "PERMISSION_DENIED"


def test_api_role_permissions_put_replaces_and_bumps_version(client):
    """T-PERM-API-07: system:role.manage 替换成功 → version+1，仅 camelCase。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.manage"])
        target_id = _make_target_role(session)
    finally:
        session.close()
    resp = client.put(
        f"/api/v1/roles/{target_id}/permissions",
        headers=_bearer(info),
        json={"permissionCodes": ["dashboard:read", "report:read"], "expectedVersion": 0},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["version"] == 1
    assert body["allPermissions"] is False
    assert set(body["permissionCodes"]) == {"dashboard:read", "report:read"}
    assert "roleId" in body and "role_id" not in body


def test_api_role_permissions_put_requires_expected_version(client):
    """T-PERM-API-08: 缺少 expectedVersion → 422 校验失败。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.manage"])
        target_id = _make_target_role(session)
    finally:
        session.close()
    resp = client.put(
        f"/api/v1/roles/{target_id}/permissions",
        headers=_bearer(info),
        json={"permissionCodes": ["dashboard:read"]},
    )
    assert resp.status_code == 422


def test_api_role_permissions_put_version_conflict_409(client):
    """T-PERM-API-09: expectedVersion 与实际不符 → 409 ROLE_PERMISSION_VERSION_CONFLICT。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.manage"])
        target_id = _make_target_role(session, permission_version=3)
    finally:
        session.close()
    resp = client.put(
        f"/api/v1/roles/{target_id}/permissions",
        headers=_bearer(info),
        json={"permissionCodes": ["dashboard:read"], "expectedVersion": 0},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "ROLE_PERMISSION_VERSION_CONFLICT"


def test_api_role_permissions_put_root_forbidden(client):
    """T-PERM-API-10: root 角色 PUT → 409 AUTH_ROOT_ROLE_IMMUTABLE。"""
    session = _new_session()
    try:
        info = _make_user_with_permissions(session, ["system:role.manage"])
        root = _make_role(session, is_root=True)
        root_id = str(root.id)
    finally:
        session.close()
    resp = client.put(
        f"/api/v1/roles/{root_id}/permissions",
        headers=_bearer(info),
        json={"permissionCodes": ["dashboard:read"], "expectedVersion": 0},
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "AUTH_ROOT_ROLE_IMMUTABLE"


def test_api_role_permissions_replace_schema_accepts_both_casings():
    """T-PERM-API-11: RolePermissionsReplace 支持 snake_case/camelCase 构造，输出 camelCase。"""
    from app.auth.schemas import RolePermissionsReplace

    by_alias = RolePermissionsReplace(permissionCodes=["dashboard:read"], expectedVersion=2)
    by_name = RolePermissionsReplace(permission_codes=["dashboard:read"], expected_version=2)
    assert by_alias.permission_codes == by_name.permission_codes == ["dashboard:read"]
    assert by_alias.expected_version == by_name.expected_version == 2
    dumped = by_alias.model_dump()
    assert dumped == {"permissionCodes": ["dashboard:read"], "expectedVersion": 2}


def test_api_role_out_exposes_security_fields_camelcase(client):
    """T-PERM-API-12: GET /api/v1/roles 的 RoleOut 输出 isRoot/isSystem/permissionVersion。"""
    resp = client.get("/api/v1/roles", headers=_bearer(_admin_info()))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert items, "expected at least the seeded admin role"
    sample = items[0]
    assert {"isRoot", "isSystem", "permissionVersion"} <= set(sample.keys())
    admin = next((r for r in items if r["code"] == "admin"), None)
    assert admin is not None
    assert admin["isRoot"] is True
    assert admin["isSystem"] is True


# --------------------------------------------------------------------------- #
# Task 7: 敏感系统 API 全面权限收口（参数化越权矩阵）
# --------------------------------------------------------------------------- #
# 已登录但零功能权限的真实用户访问敏感写/读端点时，必须命中 require_permission
# 依赖并返回顶层 PERMISSION_DENIED（403），而非旧的角色硬编码错误码。
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/v1/roles"),
        ("POST", "/api/v1/users"),
        ("POST", "/api/v1/orgs"),
        ("POST", "/api/v1/resource-grants"),
        ("POST", "/api/v1/rls/dimensions"),
        ("POST", "/api/v1/rls/groups"),
        ("GET", "/api/v1/audit/events"),
        ("POST", "/api/v1/datasources"),
        ("POST", "/api/v1/query/bindings"),
        ("PUT", "/api/v1/query/configs"),
        ("POST", "/api/v1/reports/catalog/nodes"),
        ("POST", "/api/v1/datasets"),
    ],
)
def test_sensitive_api_requires_permission(
    client, authenticated_no_permission_headers, method, path
):
    """T-PERM-API-13: 无功能权限访问敏感 API → 403 PERMISSION_DENIED。"""
    response = client.request(
        method, path, headers=authenticated_no_permission_headers, json={}
    )
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "PERMISSION_DENIED"
