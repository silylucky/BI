from concurrent.futures import ThreadPoolExecutor

import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request

from app.auth.deps import get_current_user

UNAUTHORIZED_BODY = {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token",
    "detail": None,
}


def test_me_without_token_returns_401(client):
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_with_jwt_returns_200(client, admin_auth_headers):
    response = client.get("/api/v1/me", headers=admin_auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert "admin" in body["roles"]
    assert body["id"] != "dev"


def test_me_returns_permissions_and_is_root_camelcase(client, admin_auth_headers):
    """T-ME-19: /me 返回 permissions 与 isRoot（camelCase），admin 为 root。"""
    response = client.get("/api/v1/me", headers=admin_auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["isRoot"] is True
    assert isinstance(body["permissions"], list)
    assert "is_root" not in body


def test_me_invalid_bearer_returns_401(client, unauthorized_headers):
    """T-ME-03: Authorization: Bearer invalid → 401 + 标准 error body。"""
    response = client.get("/api/v1/me", headers=unauthorized_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_missing_authorization_header_returns_401(client):
    """T-ME-04: 无 Authorization header → 401。"""
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


@pytest.mark.parametrize(
    "path",
    ["/health", "/docs", "/redoc", "/openapi.json"],
)
def test_public_paths_accessible_without_token(client, path):
    """T-ME-13: PUBLIC_PATHS 矩阵含 /redoc，无 Token → 200。"""
    response = client.get(path)
    assert response.status_code == 200


def test_template_assets_accessible_without_token(client):
    """内置素材为公开静态资源，同源部署时不得被 AuthMiddleware 拦截。"""
    response = client.get(
        "/template-assets/packs/gov-enterprise-v1/title-strips/title-diamond-flank-cyan.svg",
    )
    assert response.status_code == 200
    assert "image/svg+xml" in response.headers.get("content-type", "")
    assert b"<svg" in response.content


def test_template_assets_canvas_light_accessible_without_token(client):
    """图库大屏浅色缩略图须可访问（优先 fe/public，避免 stale dist 404）。"""
    response = client.get(
        "/template-assets/packs/gov-enterprise-v1/thumbs/canvas-light-lime-honeycomb.svg",
    )
    assert response.status_code == 200
    assert "image/svg+xml" in response.headers.get("content-type", "")
    assert b"<svg" in response.content


def test_me_jwt_valid_in_production(client, admin_auth_headers, monkeypatch):
    """T-ME-08: production 环境 JWT 仍有效（SM2 密钥一致）。"""
    from app.auth.middleware import AuthMiddleware
    from app.core.config import get_settings
    from app.main import app

    prod_private = (
        "7AF248DE02B19AA0AC4A0B0D553198984B1EF67C24E2255F8AB13BB44D7EB5AC"
    )
    prod_public = (
        "EAECFB11DAC50283B90A47C6BF1A433D041C7160B12666759F3671AB68D6637F"
        "114C18CC7A4ECE8EC9BBED49AA0D060032177F80F53697A7D72383C1428AA711"
    )
    client.get("/health")
    auth_mw = None
    layer = app.middleware_stack
    while layer is not None:
        if isinstance(layer, AuthMiddleware):
            auth_mw = layer
            break
        layer = getattr(layer, "app", None)

    prev_settings = auth_mw.settings
    try:
        monkeypatch.setenv("VITALSPAN_ENV", "production")
        monkeypatch.setenv("JWT_SM2_PRIVATE_KEY", prod_private)
        monkeypatch.setenv("JWT_SM2_PUBLIC_KEY", prod_public)
        monkeypatch.setenv("CREDENTIAL_SM4_KEY", "fedcba9876543210fedcba9876543210")
        get_settings.cache_clear()
        auth_mw.settings = get_settings()
        from app.auth.jwt import create_access_token
        from jwt_auth import resolve_admin_user_id, resolve_admin_token_version

        user_id = resolve_admin_user_id()
        token = create_access_token(
            user_id,
            "admin",
            token_version=resolve_admin_token_version(user_id),
        )
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["username"] == "admin"
    finally:
        auth_mw.settings = prev_settings
        get_settings.cache_clear()


def test_me_empty_bearer_token_returns_401(client):
    """T-ME-09: Authorization: Bearer（空 token / 仅空格）→ 401 + UNAUTHORIZED body。"""
    for header_value in ("Bearer", "Bearer "):
        response = client.get("/api/v1/me", headers={"Authorization": header_value})
        assert response.status_code == 401
        assert response.json() == UNAUTHORIZED_BODY


def test_me_lowercase_bearer_scheme_returns_401(client, lowercase_bearer_headers):
    """T-ME-10: Authorization: bearer dev（小写 scheme）→ 401。"""
    response = client.get("/api/v1/me", headers=lowercase_bearer_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_malformed_bearer_header_returns_401(client, malformed_auth_headers):
    """T-ME-11: Authorization: Bearerde（无空格分隔）→ 401。"""
    response = client.get("/api/v1/me", headers=malformed_auth_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_concurrent_requests_stable(client, admin_auth_headers, monkeypatch):
    """T-ME-12: 并发 5× GET /api/v1/me + auth_headers 全部 200 且用户上下文一致。"""
    from uuid import UUID

    from app.auth.jwt import decode_access_token, token_version_from_claims
    from app.auth.profile.schemas import MeProfileOut
    from jwt_auth import resolve_admin_user_id

    admin_id = UUID(resolve_admin_user_id())
    token = admin_auth_headers["Authorization"].removeprefix("Bearer ").strip()
    claimed_version = token_version_from_claims(decode_access_token(token))

    def fake_build_me_profile(_db, user_id, roles, *, username=None, permissions=None, is_root=False):
        return MeProfileOut(
            id=str(user_id),
            username="admin",
            display_name="Admin",
            email="admin@vitalspan.local",
            roles=roles,
            permissions=sorted(permissions or []),
            is_root=is_root,
        )

    # 中间件在 Task 4 起于 DB 内解析身份。共享内存 sqlite 并非并发写安全，
    # 5 线程并发直连会触发 OperationalError→503（甚至原生崩溃）。本用例语义是
    # 校验并发下上下文解析一致，故 mock 中间件 DB 访问层，使其确定性地脱离 DB。
    class _FakeSession:
        def close(self) -> None:
            return None

    class _FakeUser:
        id = admin_id
        token_version = claimed_version
        is_active = True
        locked_until = None

    monkeypatch.setattr("app.auth.middleware.get_meta_session", lambda: _FakeSession())
    monkeypatch.setattr("app.auth.middleware._lookup_user", lambda *_a, **_k: _FakeUser())
    monkeypatch.setattr(
        "app.auth.middleware.resolve_user_permissions", lambda *_a, **_k: (set(), True)
    )
    monkeypatch.setattr("app.auth.middleware.has_enabled_root_user", lambda *_a, **_k: True)
    monkeypatch.setattr(
        "app.auth.middleware.user_service.resolve_role_codes_for_user",
        lambda _session, _user_id: ["admin"],
    )
    monkeypatch.setattr("app.api.v1.me.profile_service.resolve_actor_user_id", lambda _db, _uid, _name: admin_id)
    monkeypatch.setattr("app.api.v1.me.profile_service.build_me_profile", fake_build_me_profile)

    def fetch_me():
        from fastapi.testclient import TestClient

        from app.main import app

        thread_client = TestClient(app)
        return thread_client.get("/api/v1/me", headers=admin_auth_headers)

    with ThreadPoolExecutor(max_workers=5) as executor:
        responses = list(executor.map(lambda _: fetch_me(), range(5)))

    for response in responses:
        assert response.status_code == 200
        body = response.json()
        assert body["username"] == "admin"
        assert body["roles"] == ["admin"]


def test_me_options_preflight_not_blocked(client):
    """T-ME-14: OPTIONS /api/v1/me 预检不被鉴权中间件 401 拦截。"""
    response = client.options(
        "/api/v1/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code != 401


def test_health_public_vs_healthz_protected(client):
    """T-ME-15: /health 公开 200；/healthz 受保护 401 + UNAUTHORIZED body。"""
    health = client.get("/health")
    assert health.status_code == 200

    healthz = client.get("/healthz")
    assert healthz.status_code == 401
    assert healthz.json() == UNAUTHORIZED_BODY


def test_me_basic_auth_scheme_returns_401(client, basic_auth_headers):
    """T-ME-16: Authorization: Basic dev → 401。"""
    response = client.get("/api/v1/me", headers=basic_auth_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_expired_placeholder_token_returns_401(client):
    """T-ME-17: Authorization: Bearer expired-placeholder → 401。"""
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer expired-placeholder"},
    )
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_legacy_uuid_storage_user_lookup_uses_matching_username(monkeypatch):
    """SQLite 旧库的连字符 UUID 主键须能以令牌 subject 加载用户。"""
    from app.auth.middleware import _lookup_user

    user_id = uuid4()
    legacy_user = SimpleNamespace(id=user_id, username="admin")

    class LegacySession:
        def get(self, *_args):
            return None

    session = LegacySession()
    monkeypatch.setattr(
        "app.auth.middleware.user_service.get_user_by_username",
        lambda _session, _username: legacy_user,
    )

    assert _lookup_user(session, str(user_id), "admin") is legacy_user


def test_me_profile_rejects_username_when_uuid_subject_is_different(monkeypatch):
    """令牌 subject 与用户名解析出的用户不一致时不得加载他人资料。"""
    from app.auth.profile import service as profile_service

    requested_id = uuid4()
    other_user = SimpleNamespace(id=uuid4(), username="admin")

    class LegacySession:
        def get(self, *_args):
            return None

    monkeypatch.setattr(
        "app.auth.profile.service.user_service.get_user_by_username",
        lambda _session, _username: other_user,
    )

    with pytest.raises(profile_service.ProfileError, match="User not found"):
        profile_service.resolve_actor_user_id(LegacySession(), str(requested_id), "admin")


def test_get_current_user_without_state_user_raises_401():
    """T-ME-18: get_current_user 无 state.user → HTTPException 401 UNAUTHORIZED。"""
    request = Request(
        scope={"type": "http", "method": "GET", "path": "/api/v1/me", "headers": []},
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_current_user(request))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "UNAUTHORIZED"
