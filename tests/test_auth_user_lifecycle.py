import threading
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.auth.login import service as login_service
from app.auth.models import (
    AuthAuditEvent,
    AuthRole,
    AuthUser,
    AuthUserRole,
    Base,
    get_meta_engine,
    get_meta_session,
)
from app.auth.roles import service as role_service
from app.auth.schemas import RoleUpdate, UserCreate
from app.auth.users import service as user_service

_CTX = {
    "actor_id": "dev",
    "actor_username": "dev",
    "actor_roles": ["admin"],
    "trace_id": "test-lifecycle",
}
_AUDIT_CTX = {"actor_id": "dev", "actor_username": "dev", "trace_id": "test-lifecycle"}


@pytest.fixture(autouse=True)
def _restore_admin_binding_after_lifecycle_test():
    """生命周期用例会 _reset_root_state 清空 root 绑定；跑在 dev Postgres 上时必须复原 admin。"""
    yield
    from app.auth.bootstrap_root import ensure_admin_username_root_binding
    from app.auth.models import get_meta_session

    session = get_meta_session()
    try:
        ensure_admin_username_root_binding(session, username="admin")
    finally:
        session.close()


def _new_session():
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    return get_meta_session()


def _reset_root_state(session):
    """归零 root 状态：唯一 admin root 角色、无任何 root 绑定。"""
    from app.auth.bootstrap_root import ensure_root_role

    role = ensure_root_role(session)
    session.query(AuthUserRole).filter(AuthUserRole.role_id == role.id).delete()
    session.commit()
    session.refresh(role)
    return role


def _make_user(session, *, is_active=True, role_ids=()):
    user = AuthUser(username=f"u_{uuid_mod.uuid4().hex[:12]}", is_active=is_active)
    session.add(user)
    session.commit()
    session.refresh(user)
    for rid in role_ids:
        session.add(AuthUserRole(user_id=user.id, role_id=rid))
    session.commit()
    return user


def _make_role(session, *, code=None):
    code = code or f"r_{uuid_mod.uuid4().hex[:10]}"
    role = AuthRole(code=code, name=code, is_active=True)
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


# --------------------------------------------------------------------------- #
# root 角色不可删 / 禁用 / 改 code
# --------------------------------------------------------------------------- #


def test_root_role_cannot_be_deleted():
    """T-LIFE-01: 删除 root 角色 → AUTH_ROOT_ROLE_IMMUTABLE(409)。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        with pytest.raises(role_service.RoleError) as exc:
            role_service.delete_role(session, root.id, **_AUDIT_CTX)
        assert exc.value.code == "AUTH_ROOT_ROLE_IMMUTABLE"
        assert exc.value.status == 409
    finally:
        session.close()


def test_root_role_cannot_be_disabled():
    """T-LIFE-02: 禁用 root 角色 → AUTH_ROOT_ROLE_IMMUTABLE(409)。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        with pytest.raises(role_service.RoleError) as exc:
            role_service.update_role(
                session,
                root.id,
                RoleUpdate(name="管理员", description=None, is_active=False),
                **_AUDIT_CTX,
            )
        assert exc.value.code == "AUTH_ROOT_ROLE_IMMUTABLE"
    finally:
        session.close()


def test_root_role_code_is_not_mutated_on_update():
    """T-LIFE-03: 更新 root 角色名不改动 code（无 code 变更通道）。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        updated = role_service.update_role(
            session,
            root.id,
            RoleUpdate(name="Root Admin Renamed", description="x", is_active=None),
            **_AUDIT_CTX,
        )
        assert updated.code == "admin"
        assert updated.is_root is True
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 不能禁用 / 移除最后一个 root 用户
# --------------------------------------------------------------------------- #


def test_cannot_unbind_last_root_user_binding():
    """T-LIFE-04: 解绑最后 root 用户 → AUTH_ROOT_ADMIN_REQUIRED(409)。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        user = _make_user(session, role_ids=[root.id])
        with pytest.raises(user_service.UserError) as exc:
            user_service.unbind_role(session, user.id, root.id, **_CTX)
        assert exc.value.code == "AUTH_ROOT_ADMIN_REQUIRED"
        assert exc.value.status == 409
        # 回滚后绑定仍在
        assert (
            session.get(AuthUserRole, {"user_id": user.id, "role_id": root.id})
            is not None
        )
    finally:
        session.close()


def test_cannot_disable_last_root_user():
    """T-LIFE-05: 禁用最后 root 用户 → AUTH_ROOT_ADMIN_REQUIRED(409)。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        user = _make_user(session, role_ids=[root.id])
        with pytest.raises(user_service.UserError) as exc:
            user_service.set_user_active(session, user.id, False, **_CTX)
        assert exc.value.code == "AUTH_ROOT_ADMIN_REQUIRED"
        session.expire_all()
        assert session.get(AuthUser, user.id).is_active is True
    finally:
        session.close()


def test_replace_roles_removing_root_from_last_user_blocked():
    """T-LIFE-06: 替换角色移除最后 root 用户的 root → AUTH_ROOT_ADMIN_REQUIRED。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        other = _make_role(session)
        user = _make_user(session, role_ids=[root.id])
        with pytest.raises(user_service.UserError) as exc:
            user_service.replace_user_roles(session, user.id, [other.id], **_CTX)
        assert exc.value.code == "AUTH_ROOT_ADMIN_REQUIRED"
    finally:
        session.close()


def test_can_disable_first_root_when_second_enabled_root_exists():
    """T-LIFE-07: 存在第二个启用 root 用户时，可停用第一个。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        first = _make_user(session, role_ids=[root.id])
        _make_user(session, role_ids=[root.id])
        result = user_service.set_user_active(session, first.id, False, **_CTX)
        assert result.is_active is False
    finally:
        session.close()


def test_cannot_delete_last_root_user():
    """T-LIFE-07b: 删除最后 root 用户 → AUTH_ROOT_ADMIN_REQUIRED(409)。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        user = _make_user(session, role_ids=[root.id])
        with pytest.raises(user_service.UserError) as exc:
            user_service.delete_user(session, user.id, **_CTX)
        assert exc.value.code == "AUTH_ROOT_ADMIN_REQUIRED"
        assert session.get(AuthUser, user.id) is not None
    finally:
        session.close()


def test_delete_user_removes_record_and_bindings():
    """T-LIFE-07c: 删除普通用户后记录与角色绑定均移除。"""
    session = _new_session()
    try:
        role = _make_role(session)
        user = _make_user(session, role_ids=[role.id])
        user_id = user.id
        user_service.delete_user(session, user_id, **_CTX)
        assert session.get(AuthUser, user_id) is None
        assert session.get(AuthUserRole, {"user_id": user_id, "role_id": role.id}) is None
        event = session.scalar(
            select(AuthAuditEvent).where(
                AuthAuditEvent.action == "user.delete",
                AuthAuditEvent.target_id == user_id,
            )
        )
        assert event is not None
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# 并发移除最后 root 绑定：至少一个 409
# --------------------------------------------------------------------------- #


def test_concurrent_remove_last_root_binding_yields_conflict():
    """T-LIFE-08: 并发解绑两个仅有的 root 用户，至少一个 409，且至少保留一个 root。"""
    engine = get_meta_engine()
    if engine.dialect.name == "sqlite":
        pytest.skip("行级 FOR UPDATE 串行化需要 postgres")

    setup = _new_session()
    try:
        root = _reset_root_state(setup)
        u1 = _make_user(setup, role_ids=[root.id])
        u2 = _make_user(setup, role_ids=[root.id])
        root_id = root.id
        u1_id, u2_id = u1.id, u2.id
    finally:
        setup.close()

    barrier = threading.Barrier(2)
    results: dict[uuid_mod.UUID, str] = {}

    def _worker(user_id: uuid_mod.UUID) -> None:
        session = get_meta_session()
        try:
            barrier.wait(timeout=10)
            user_service.unbind_role(session, user_id, root_id, **_CTX)
            results[user_id] = "ok"
        except user_service.UserError as exc:
            results[user_id] = exc.code
        except Exception as exc:  # noqa: BLE001
            results[user_id] = f"error:{type(exc).__name__}"
        finally:
            session.close()

    threads = [threading.Thread(target=_worker, args=(uid,)) for uid in (u1_id, u2_id)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15)

    codes = list(results.values())
    assert "AUTH_ROOT_ADMIN_REQUIRED" in codes, results

    verify = get_meta_session()
    try:
        surviving = verify.scalar(
            select(AuthUserRole).where(AuthUserRole.role_id == root_id).limit(1)
        )
        assert surviving is not None, "至少保留一个 root 绑定"
    finally:
        verify.close()


# --------------------------------------------------------------------------- #
# bootstrap_root CLI
# --------------------------------------------------------------------------- #


def test_bootstrap_root_fails_closed_without_password():
    """T-LIFE-09: 无启用 root 且未提供密码 → BootstrapError（fail closed）。"""
    from app.auth.bootstrap_root import BootstrapError, bootstrap_root

    session = _new_session()
    try:
        # 归零 root 状态，确保命中「不存在启用 root → 读密码」分支而非幂等短路。
        _reset_root_state(session)
        with pytest.raises(BootstrapError) as exc:
            bootstrap_root(session, username="root_x", password=None, allow_existing=False)
        assert exc.value.code == "AUTH_BOOTSTRAP_PASSWORD_REQUIRED"
    finally:
        session.close()


def test_bootstrap_root_creates_root_admin_and_binds():
    """T-LIFE-10: 引导创建 root 用户并绑定 root 角色。"""
    from app.auth.bootstrap_root import bootstrap_root

    session = _new_session()
    try:
        _reset_root_state(session)
        username = f"root_{uuid_mod.uuid4().hex[:8]}"
        user = bootstrap_root(
            session, username=username, password="s3cret-pass", allow_existing=False
        )
        assert user.is_active is True
        root = session.scalar(select(AuthRole).where(AuthRole.code == "admin"))
        assert root.is_root is True
        binding = session.get(
            AuthUserRole, {"user_id": user.id, "role_id": root.id}
        )
        assert binding is not None
    finally:
        session.close()


def test_bootstrap_root_rejects_existing_unless_allowed():
    """T-LIFE-11: 同名用户存在且 allow_existing=False → BootstrapError；True 则收敛。"""
    from app.auth.bootstrap_root import BootstrapError, bootstrap_root

    session = _new_session()
    try:
        _reset_root_state(session)
        username = f"root_{uuid_mod.uuid4().hex[:8]}"
        user_service.create_user(
            session,
            UserCreate(username=username, initialPassword="init-pass-123", roleIds=[]),
            actor_id="dev",
            actor_username="dev",
            trace_id="test-lifecycle",
        )

        with pytest.raises(BootstrapError) as exc:
            bootstrap_root(
                session, username=username, password="pw12345", allow_existing=False
            )
        assert exc.value.code == "AUTH_BOOTSTRAP_USER_EXISTS"

        user = bootstrap_root(
            session, username=username, password="pw12345", allow_existing=True
        )
        root = session.scalar(select(AuthRole).where(AuthRole.code == "admin"))
        assert session.get(AuthUserRole, {"user_id": user.id, "role_id": root.id}) is not None
    finally:
        session.close()


def test_bootstrap_root_idempotent_when_enabled_root_exists():
    """T-LIFE-12: 已存在启用 root 时，重复引导幂等成功且不读密码 / 不改状态。"""
    from app.auth.bootstrap_root import bootstrap_root

    session = _new_session()
    try:
        _reset_root_state(session)
        username = f"root_{uuid_mod.uuid4().hex[:8]}"
        created = bootstrap_root(
            session, username=username, password="s3cret-pass", allow_existing=False
        )
        original_hash = created.password_hash

        # 前置短路：即便 password=None 也幂等成功返回既有 root，不抛错、不改密码。
        again = bootstrap_root(
            session, username="someone_else", password=None, allow_existing=False
        )
        assert again.is_active is True
        session.refresh(created)
        assert created.password_hash == original_hash
        # 未创建 someone_else 用户。
        assert session.scalar(
            select(AuthUser).where(AuthUser.username == "someone_else")
        ) is None
    finally:
        session.close()


def test_ensure_admin_username_root_binding_repairs_orphan_admin():
    """T-LIFE-14: 其他 root 用户存在时 bootstrap 短路，仍须补绑 username=admin。"""
    from app.auth.bootstrap_root import ensure_admin_username_root_binding
    from app.auth.permissions import resolve_user_permissions

    session = _new_session()
    try:
        _reset_root_state(session)
        root = session.scalar(select(AuthRole).where(AuthRole.code == "admin"))
        assert root is not None
        root.is_root = True
        root.is_active = True
        session.flush()

        decoy = _make_user(session, role_ids=[root.id])
        admin_user = session.scalar(select(AuthUser).where(AuthUser.username == "admin"))
        if admin_user is None:
            admin_user = AuthUser(username="admin", is_active=True)
            session.add(admin_user)
            session.commit()
            session.refresh(admin_user)

        _, decoy_is_root = resolve_user_permissions(session, decoy.id)
        assert decoy_is_root is True
        _, admin_is_root_before = resolve_user_permissions(session, admin_user.id)
        assert admin_is_root_before is False

        assert ensure_admin_username_root_binding(session, username="admin") is True
        assert ensure_admin_username_root_binding(session, username="admin") is False

        _, admin_is_root_after = resolve_user_permissions(session, admin_user.id)
        assert admin_is_root_after is True
    finally:
        session.close()


def test_bootstrap_root_converges_when_concurrent_bootstrap_won(monkeypatch):
    """T-LIFE-13: flush 冲突后若已出现启用 root，视为已初始化幂等成功（含 allow_existing=False）。"""
    from sqlalchemy.exc import IntegrityError

    from app.auth import bootstrap_root as boot_mod
    from app.auth.bootstrap_root import bootstrap_root

    session = _new_session()
    try:
        _reset_root_state(session)
        root = session.scalar(select(AuthRole).where(AuthRole.code == "admin"))
        winner = _make_user(session, role_ids=[root.id])

        # 入口短路时尚无 root（本进程视角），写冲突回滚后另一进程的 root 才可见。
        calls = {"n": 0}

        def _find_stub(sess):
            calls["n"] += 1
            return None if calls["n"] == 1 else winner

        def _ensure_boom(sess):
            raise IntegrityError("concurrent insert", None, Exception("dup"))

        monkeypatch.setattr(boot_mod, "_find_enabled_root_user", _find_stub)
        monkeypatch.setattr(boot_mod, "ensure_root_role", _ensure_boom)

        result = bootstrap_root(
            session,
            username=f"root_{uuid_mod.uuid4().hex[:8]}",
            password="pw12345",
            allow_existing=False,
        )
        assert result.id == winner.id
        assert calls["n"] == 2
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# Task 6: 密码服务
# --------------------------------------------------------------------------- #


def test_password_policy_rejects_out_of_range_lengths():
    """T-PW-01: 密码策略校验长度 8-128；越界抛 PasswordPolicyError。"""
    from app.auth.password.service import PasswordPolicyError, validate_password_policy

    validate_password_policy("a" * 8)
    validate_password_policy("a" * 128)
    with pytest.raises(PasswordPolicyError):
        validate_password_policy("a" * 7)
    with pytest.raises(PasswordPolicyError):
        validate_password_policy("a" * 129)


def test_hash_and_verify_password_roundtrip():
    """T-PW-02: hash/verify 往返；错误密码不通过。"""
    from app.auth.password.service import hash_password, verify_password

    hashed = hash_password("s3cret-pass")
    assert hashed and hashed != "s3cret-pass"
    assert verify_password("s3cret-pass", hashed)
    assert not verify_password("wrong-pass", hashed)
    assert not verify_password("anything", "")


def test_generate_temporary_password_meets_policy_and_length():
    """T-PW-03: 临时密码长度取配置值，且满足策略。"""
    from app.auth.password.service import (
        generate_temporary_password,
        validate_password_policy,
    )
    from app.core.config import get_settings

    expected_length = get_settings().auth_temporary_password_length
    generated = {generate_temporary_password() for _ in range(5)}
    assert len(generated) == 5  # 随机、不重复
    for pw in generated:
        assert len(pw) == expected_length
        validate_password_policy(pw)


# --------------------------------------------------------------------------- #
# Task 6: 用户创建 / 解锁 / 重置密码
# --------------------------------------------------------------------------- #


def test_create_user_requires_initial_password_and_saves_hash():
    """T-USER-01: 创建用户保存 bcrypt hash，不落明文。"""
    from app.auth.password.service import verify_password

    session = _new_session()
    try:
        payload = UserCreate(
            username=f"u_{uuid_mod.uuid4().hex[:10]}",
            initialPassword="init-pass-123",
            roleIds=[],
        )
        user = user_service.create_user(
            session,
            payload,
            actor_id="dev",
            actor_username="dev",
            trace_id="t",
        )
        session.refresh(user)
        assert user.password_hash
        assert user.password_hash != "init-pass-123"
        assert verify_password("init-pass-123", user.password_hash)

        event = session.scalar(
            select(AuthAuditEvent)
            .where(
                AuthAuditEvent.action == "user.create",
                AuthAuditEvent.target_id == user.id,
            )
        )
        assert event is not None
        assert "init-pass-123" not in (event.detail or "")
    finally:
        session.close()


def test_unlock_user_clears_lock_and_failed_count():
    """T-USER-02: 解锁清零 failed_login_count 与 locked_until，并写审计。"""
    session = _new_session()
    try:
        user = _make_user(session)
        user.failed_login_count = 5
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        session.commit()
        result = user_service.unlock_user(
            session, user.id, actor_id="dev", actor_username="dev", trace_id="t"
        )
        assert result.failed_login_count == 0
        assert result.locked_until is None
        event = session.scalar(
            select(AuthAuditEvent).where(
                AuthAuditEvent.action == "user.unlock",
                AuthAuditEvent.target_id == user.id,
            )
        )
        assert event is not None
    finally:
        session.close()


def test_reset_password_rotates_hash_bumps_version_and_hides_plaintext():
    """T-USER-03: 重置生成临时密码、旧密码失效、token_version+1、审计无明文。"""
    from app.auth.password.service import hash_password, verify_password

    session = _new_session()
    try:
        user = _make_user(session)
        user.password_hash = hash_password("old-pass-1234")
        session.commit()
        old_version = user.token_version

        temporary, changed_at = user_service.reset_password(
            session, user.id, actor_id="dev", actor_username="dev", trace_id="t"
        )
        session.refresh(user)

        assert not verify_password("old-pass-1234", user.password_hash)
        assert verify_password(temporary, user.password_hash)
        assert user.token_version == old_version + 1
        assert user.password_changed_at is not None
        assert changed_at is not None

        event = session.scalar(
            select(AuthAuditEvent)
            .where(
                AuthAuditEvent.action == "user.password.reset",
                AuthAuditEvent.target_id == user.id,
            )
            .order_by(AuthAuditEvent.created_at.desc())
        )
        assert event is not None
        detail = event.detail or ""
        assert temporary not in detail
        assert user.password_hash not in detail
    finally:
        session.close()


def test_reset_password_on_last_root_user_is_allowed():
    """T-USER-04: 重置最后一个 root 用户密码不触发根管理员保护（不改绑定/启用）。"""
    session = _new_session()
    try:
        root = _reset_root_state(session)
        user = _make_user(session, role_ids=[root.id])
        temporary, _ = user_service.reset_password(
            session, user.id, actor_id="dev", actor_username="dev", trace_id="t"
        )
        assert temporary
        session.refresh(user)
        assert user.is_active is True
    finally:
        session.close()


# --------------------------------------------------------------------------- #
# Task 6: 登录锁定策略（服务级）
# --------------------------------------------------------------------------- #


def _seed_login_user(session, password: str, **kwargs):
    from app.auth.password.service import hash_password

    user = _make_user(session, **kwargs)
    user.password_hash = hash_password(password)
    session.commit()
    session.refresh(user)
    return user


def test_consecutive_failures_lock_user_and_audit():
    """T-LOCK-01: 连续失败达到阈值 → locked_until 设定并写 user.lock 审计。"""
    from app.core.config import get_settings

    session = _new_session()
    try:
        user = _seed_login_user(session, "correct-pass-1")
        max_failed = get_settings().auth_max_failed_logins
        for _ in range(max_failed):
            with pytest.raises(login_service.LoginError) as exc:
                login_service.authenticate(session, user.username, "wrong-pass")
            assert exc.value.code == "AUTH_INVALID_CREDENTIALS"
        session.refresh(user)
        assert user.failed_login_count == max_failed
        assert user.locked_until is not None

        event = session.scalar(
            select(AuthAuditEvent).where(
                AuthAuditEvent.action == "user.lock",
                AuthAuditEvent.target_id == user.id,
            )
        )
        assert event is not None

        # 锁定期间即便密码正确也拒绝，且不再累加计数
        with pytest.raises(login_service.LoginError) as locked_exc:
            login_service.authenticate(session, user.username, "correct-pass-1")
        assert locked_exc.value.status == 403
        assert locked_exc.value.code == "AUTH_USER_LOCKED"
        session.refresh(user)
        assert user.failed_login_count == max_failed
    finally:
        session.close()


def test_successful_login_resets_failed_count():
    """T-LOCK-02: 成功登录清零连续失败计数。"""
    session = _new_session()
    try:
        user = _seed_login_user(session, "correct-pass-2")
        user.failed_login_count = 3
        session.commit()
        result = login_service.authenticate(session, user.username, "correct-pass-2")
        session.refresh(result)
        assert result.failed_login_count == 0
        assert result.locked_until is None
    finally:
        session.close()


def test_login_rejects_disabled_user_403():
    """T-LOCK-03: 禁用用户登录 → 403 AUTH_USER_DISABLED。"""
    session = _new_session()
    try:
        user = _seed_login_user(session, "correct-pass-3", is_active=False)
        with pytest.raises(login_service.LoginError) as exc:
            login_service.authenticate(session, user.username, "correct-pass-3")
        assert exc.value.status == 403
        assert exc.value.code == "AUTH_USER_DISABLED"
    finally:
        session.close()


def test_login_after_expired_lock_recounts_from_one():
    """T-LOCK-04: 锁定到期后首次失败从 1 重新计数。"""
    session = _new_session()
    try:
        user = _seed_login_user(session, "correct-pass-4")
        user.failed_login_count = 5
        user.locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)
        session.commit()
        with pytest.raises(login_service.LoginError) as exc:
            login_service.authenticate(session, user.username, "wrong-pass")
        assert exc.value.code == "AUTH_INVALID_CREDENTIALS"
        session.refresh(user)
        assert user.failed_login_count == 1
        assert user.locked_until is None
    finally:
        session.close()
