"""Account self-service profile and password change (isolated SQLite)."""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from pathlib import Path
from typing import Any, TypedDict

from app.core.crypto.password import hash_password
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import AuthAuditEvent, AuthRole, AuthUser, AuthUserRole, Base, get_meta_engine
from app.main import app

_SHARED_ADMIN_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _clear_meta_engine_caches() -> None:
    from app.auth.models import get_meta_engine as auth_engine
    from app.core.config import get_settings
    from app.datasources.models import get_meta_engine as ds_engine
    from app.ingestion.models import get_meta_engine as ing_engine
    from app.query.models import get_meta_engine as query_engine

    get_settings.cache_clear()
    for engine_fn in (auth_engine, ds_engine, ing_engine, query_engine):
        engine_fn.cache_clear()


class ProfileCtx(TypedDict):
    client: TestClient
    user_id: uuid.UUID
    username: str
    password: str
    headers: dict[str, str]
    db_file: Path
    sqlite_url: str


def _seed_profile_user(
    *,
    user_id: uuid.UUID,
    username: str,
    password: str,
) -> None:
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    hashed = hash_password(password)
    with Session(engine) as session:
        # Task 4 起 AuthMiddleware 依赖 has_enabled_root_user（要求 is_root 角色）作为
        # 部署门禁；隔离 DB 的 admin 角色须标记为真实 root，否则所有受保护请求 503。
        admin_role = AuthRole(
            code="admin", name="管理员", is_active=True, is_system=True, is_root=True
        )
        session.add(admin_role)
        session.flush()
        session.add(
            AuthUser(
                id=user_id,
                username=username,
                display_name="Profile User",
                email=f"{username}@example.com",
                password_hash=hashed,
            )
        )
        session.add(AuthUserRole(user_id=user_id, role_id=admin_role.id))
        session.commit()


def _login_headers(client: TestClient, *, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _password_change_audit_total() -> int:
    with Session(get_meta_engine()) as session:
        return (
            session.scalar(
                select(func.count())
                .select_from(AuthAuditEvent)
                .where(AuthAuditEvent.action == "password.change")
            )
            or 0
        )


def _latest_password_change_event() -> AuthAuditEvent | None:
    with Session(get_meta_engine()) as session:
        return session.scalar(
            select(AuthAuditEvent)
            .where(AuthAuditEvent.action == "password.change")
            .order_by(AuthAuditEvent.created_at.desc())
            .limit(1)
        )


@pytest.fixture
def profile_ctx(tmp_path: Path) -> Generator[ProfileCtx, None, None]:
    db_file = tmp_path / f"profile-{uuid.uuid4().hex}.db"
    sqlite_url = f"sqlite+pysqlite:///{db_file.as_posix()}"

    previous_db_url = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = sqlite_url
    _clear_meta_engine_caches()

    user_id = uuid.uuid4()
    username = f"profile-user-{user_id.hex[:10]}"
    password = f"Known-Pass-{user_id.hex[:12]}!"

    _seed_profile_user(user_id=user_id, username=username, password=password)

    client = TestClient(app)
    headers = _login_headers(client, username=username, password=password)

    ctx: ProfileCtx = {
        "client": client,
        "user_id": user_id,
        "username": username,
        "password": password,
        "headers": headers,
        "db_file": db_file,
        "sqlite_url": sqlite_url,
    }

    try:
        yield ctx
    finally:
        client.close()
        try:
            get_meta_engine().dispose()
        except Exception:
            pass
        if previous_db_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_db_url
        _clear_meta_engine_caches()


def test_fixture_uses_isolated_sqlite_not_shared_admin(profile_ctx: ProfileCtx) -> None:
    assert os.environ["DATABASE_URL"] == profile_ctx["sqlite_url"]
    assert profile_ctx["db_file"].is_file()
    assert profile_ctx["db_file"].as_posix() in os.environ["DATABASE_URL"]

    with Session(get_meta_engine()) as session:
        assert session.get(AuthUser, _SHARED_ADMIN_USER_ID) is None
        assert session.query(AuthUser).filter(AuthUser.username == "admin").first() is None

    bad_login = profile_ctx["client"].post(
        "/api/v1/auth/login",
        json={"username": profile_ctx["username"], "password": "definitely-wrong"},
    )
    assert bad_login.status_code == 401


def test_me_includes_profile_fields(profile_ctx: ProfileCtx) -> None:
    response = profile_ctx["client"].get("/api/v1/me", headers=profile_ctx["headers"])
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == profile_ctx["username"]
    assert "displayName" in body
    assert "email" in body
    assert "@" in body["email"]


def test_patch_me_updates_profile(profile_ctx: ProfileCtx) -> None:
    client = profile_ctx["client"]
    headers = profile_ctx["headers"]
    original = client.get("/api/v1/me", headers=headers).json()
    restore_payload = {
        "displayName": original.get("displayName") or original["username"],
        "email": original.get("email"),
    }
    suffix = uuid.uuid4().hex[:8]
    email = f"{profile_ctx['username']}-{suffix}@example.com"
    try:
        response = client.patch(
            "/api/v1/me",
            headers=headers,
            json={"displayName": f"Profile {suffix}", "email": email},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["displayName"] == f"Profile {suffix}"
        assert body["email"] == email

        me = client.get("/api/v1/me", headers=headers)
        assert me.json()["email"] == email
    finally:
        client.patch("/api/v1/me", headers=headers, json=restore_payload)


def test_patch_me_invalid_email_returns_422(profile_ctx: ProfileCtx) -> None:
    response = profile_ctx["client"].patch(
        "/api/v1/me",
        headers=profile_ctx["headers"],
        json={"email": "not-an-email"},
    )
    assert response.status_code == 422


def test_change_password_success_audit_and_relogin(profile_ctx: ProfileCtx) -> None:
    client = profile_ctx["client"]
    headers = profile_ctx["headers"]
    before = _password_change_audit_total()
    new_password = f"Rotated-{uuid.uuid4().hex[:12]}!"

    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"currentPassword": profile_ctx["password"], "newPassword": new_password},
    )
    assert response.status_code == 204

    assert _password_change_audit_total() == before + 1
    event = _latest_password_change_event()
    assert event is not None
    assert event.action == "password.change"
    assert event.actor_id == str(profile_ctx["user_id"])
    assert event.actor_username == profile_ctx["username"]
    assert event.target_id == profile_ctx["user_id"]
    assert event.detail is None

    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username": profile_ctx["username"], "password": profile_ctx["password"]},
    )
    assert bad_login.status_code == 401

    good_login = client.post(
        "/api/v1/auth/login",
        json={"username": profile_ctx["username"], "password": new_password},
    )
    assert good_login.status_code == 200


def test_change_password_bumps_token_version_and_revokes_old_jwt(
    profile_ctx: ProfileCtx,
) -> None:
    """Task 6: 主动改密递增 token_version，旧 JWT 因版本不匹配返回 401 TOKEN_REVOKED。"""
    client = profile_ctx["client"]
    headers = profile_ctx["headers"]
    new_password = f"Rotated-{uuid.uuid4().hex[:12]}!"

    assert client.get("/api/v1/me", headers=headers).status_code == 200

    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"currentPassword": profile_ctx["password"], "newPassword": new_password},
    )
    assert response.status_code == 204

    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 401
    assert me.json()["code"] == "TOKEN_REVOKED"


def test_change_password_wrong_current_keeps_session_and_skips_audit(
    profile_ctx: ProfileCtx,
) -> None:
    client = profile_ctx["client"]
    headers = profile_ctx["headers"]
    before = _password_change_audit_total()

    response = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"currentPassword": "definitely-wrong", "newPassword": "newpassword123"},
    )
    assert response.status_code == 401
    body = response.json()
    assert body["code"] == "AUTH_INVALID_CURRENT_PASSWORD"

    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200

    still_valid = client.post(
        "/api/v1/auth/login",
        json={"username": profile_ctx["username"], "password": profile_ctx["password"]},
    )
    assert still_valid.status_code == 200
    assert _password_change_audit_total() == before


@pytest.mark.parametrize(
    "new_password",
    ["1234567", "a" * 129],
)
def test_change_password_length_boundary_returns_422(
    profile_ctx: ProfileCtx,
    new_password: str,
) -> None:
    response = profile_ctx["client"].post(
        "/api/v1/auth/change-password",
        headers=profile_ctx["headers"],
        json={"currentPassword": profile_ctx["password"], "newPassword": new_password},
    )
    assert response.status_code == 422


def test_change_password_unchanged_returns_422(profile_ctx: ProfileCtx) -> None:
    before = _password_change_audit_total()
    response = profile_ctx["client"].post(
        "/api/v1/auth/change-password",
        headers=profile_ctx["headers"],
        json={
            "currentPassword": profile_ctx["password"],
            "newPassword": profile_ctx["password"],
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "AUTH_PASSWORD_UNCHANGED"
    assert _password_change_audit_total() == before


def test_admin_reset_password_http_no_store_and_revokes_target_jwt(
    profile_ctx: ProfileCtx,
) -> None:
    """Task 6: 管理员重置密码 HTTP —— 响应 Cache-Control no-store，且目标旧 JWT 失效为 TOKEN_REVOKED。"""
    client = profile_ctx["client"]
    admin_headers = profile_ctx["headers"]  # profile 用户为 root，具备 password.reset 权限

    target_username = f"reset-target-{uuid.uuid4().hex[:10]}"
    target_password = f"Init-Pass-{uuid.uuid4().hex[:10]}!"
    created = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"username": target_username, "initialPassword": target_password, "roleIds": []},
    )
    assert created.status_code == 201, created.text
    target_id = created.json()["id"]

    target_login = client.post(
        "/api/v1/auth/login",
        json={"username": target_username, "password": target_password},
    )
    assert target_login.status_code == 200, target_login.text
    target_headers = {"Authorization": f"Bearer {target_login.json()['accessToken']}"}
    assert client.get("/api/v1/me", headers=target_headers).status_code == 200

    reset = client.post(
        f"/api/v1/users/{target_id}/reset-password",
        headers=admin_headers,
    )
    assert reset.status_code == 200, reset.text
    assert reset.headers.get("Cache-Control") == "no-store"
    body = reset.json()
    assert body["temporaryPassword"]
    assert body["temporaryPassword"] != target_password

    revoked = client.get("/api/v1/me", headers=target_headers)
    assert revoked.status_code == 401
    assert revoked.json()["code"] == "TOKEN_REVOKED"


def test_create_user_http_password_policy_returns_422(profile_ctx: ProfileCtx) -> None:
    """Task 6: 初始密码短于策略下限（8）时创建用户 → 422 AUTH_PASSWORD_POLICY。"""
    response = profile_ctx["client"].post(
        "/api/v1/users",
        headers=profile_ctx["headers"],
        json={"username": f"short-pw-{uuid.uuid4().hex[:8]}", "initialPassword": "short", "roleIds": []},
    )
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "AUTH_PASSWORD_POLICY"


def test_change_password_audit_failure_rolls_back_credentials(
    profile_ctx: ProfileCtx,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.auth.audit import service as audit_service
    from app.auth.profile import service as profile_service

    def _boom(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(audit_service, "record_event", _boom)

    new_password = f"Should-Not-Stick-{uuid.uuid4().hex[:12]}!"
    with Session(get_meta_engine()) as session:
        try:
            profile_service.change_password(
                session,
                user_id=profile_ctx["user_id"],
                actor_username=profile_ctx["username"],
                current_password=profile_ctx["password"],
                new_password=new_password,
            )
            pytest.fail("expected audit failure")
        except RuntimeError:
            session.rollback()

    assert _password_change_audit_total() == 0

    client = profile_ctx["client"]
    old_ok = client.post(
        "/api/v1/auth/login",
        json={"username": profile_ctx["username"], "password": profile_ctx["password"]},
    )
    assert old_ok.status_code == 200

    new_bad = client.post(
        "/api/v1/auth/login",
        json={"username": profile_ctx["username"], "password": new_password},
    )
    assert new_bad.status_code == 401
