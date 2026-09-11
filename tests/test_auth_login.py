import pytest

from app.auth.jwt import create_access_token


def test_login_success_returns_access_token(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "changeme"},
    )
    if response.status_code == 401:
        pytest.skip("admin user not seeded; run migration 0017 in test DB")
    assert response.status_code == 200
    body = response.json()
    assert body["accessToken"]
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] > 0


def test_login_invalid_credentials_401(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "AUTH_INVALID_CREDENTIALS"


def test_me_with_jwt_returns_user(client, admin_auth_headers):
    response = client.get("/api/v1/me", headers=admin_auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    assert "admin" in body["roles"]
    assert body["id"] != "dev"


def test_bearer_dev_rejected(client):
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer dev"})
    assert response.status_code == 401


def test_dev_switch_not_found_in_production(client, monkeypatch):
    monkeypatch.setenv("VITALSPAN_ENV", "production")
    monkeypatch.setenv("CREDENTIAL_SM4_KEY", "fedcba9876543210fedcba9876543210")
    monkeypatch.setenv(
        "JWT_SM2_PRIVATE_KEY",
        "7AF248DE02B19AA0AC4A0B0D553198984B1EF67C24E2255F8AB13BB44D7EB5AC",
    )
    monkeypatch.setenv(
        "JWT_SM2_PUBLIC_KEY",
        "EAECFB11DAC50283B90A47C6BF1A433D041C7160B12666759F3671AB68D6637F"
        "114C18CC7A4ECE8EC9BBED49AA0D060032177F80F53697A7D72383C1428AA711",
    )
    from app.core.config import get_settings

    get_settings.cache_clear()
    login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "changeme"},
    )
    if login.status_code != 200:
        pytest.skip("admin user not seeded")
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    response = client.post(
        "/api/v1/auth/dev-switch",
        json={"username": "admin"},
        headers=headers,
    )
    get_settings.cache_clear()
    assert response.status_code == 404


def test_dev_switch_success_in_development(client, admin_auth_headers):
    response = client.post(
        "/api/v1/auth/dev-switch",
        json={"username": "admin"},
        headers=admin_auth_headers,
    )
    if response.status_code == 404:
        pytest.skip("not in development env")
    assert response.status_code == 200
    body = response.json()
    assert body["accessToken"]
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "admin"


def test_dev_switch_user_not_found(client, admin_auth_headers):
    response = client.post(
        "/api/v1/auth/dev-switch",
        json={"username": "__no_such_user__"},
        headers=admin_auth_headers,
    )
    if response.status_code == 404 and response.json().get("code") == "NOT_FOUND":
        pytest.skip("not in development env")
    assert response.status_code == 404
    assert response.json()["code"] == "USER_NOT_FOUND"


def test_login_public_without_auth(client):
    response = client.post("/api/v1/auth/login", json={"username": "x", "password": "y"})
    assert response.status_code == 401


def test_login_legacy_bcrypt_hash_rejected(client):
    """bcrypt 遗留哈希不可登录（须 SM3 或管理员重置）。"""
    import uuid

    from app.auth.models import AuthUser, Base, get_meta_engine, get_meta_session
    from app.core.config import get_settings

    get_settings.cache_clear()

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    username = f"bcrypt_reject_{uuid.uuid4().hex[:8]}"
    legacy_hash = "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012"
    session = get_meta_session()
    try:
        session.add(
            AuthUser(
                username=username,
                password_hash=legacy_hash,
                is_active=True,
            )
        )
        session.commit()
    finally:
        session.close()

    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "upgrade-me-1"},
    )
    assert response.status_code == 401
    get_settings.cache_clear()


def test_login_jwt_carries_user_token_version(client):
    """Task 6: 登录发放的 JWT 必须携带用户当前 tokenVersion。"""
    import uuid

    from app.auth.jwt import decode_access_token
    from app.auth.models import AuthUser, Base, get_meta_engine, get_meta_session
    from app.auth.password.service import hash_password

    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    username = f"lv_{uuid.uuid4().hex[:8]}"
    session = get_meta_session()
    try:
        session.add(
            AuthUser(
                username=username,
                password_hash=hash_password("pw-known-1234"),
                is_active=True,
                token_version=4,
            )
        )
        session.commit()
    finally:
        session.close()

    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "pw-known-1234"},
    )
    assert response.status_code == 200
    claims = decode_access_token(response.json()["accessToken"])
    assert claims["tokenVersion"] == 4
