"""T-CFT-01~03: 显式固化 conftest fixture 契约（BOOT-006）。"""

from app.core.config import get_settings


def test_client_fixture_health_ok(client):
    """T-CFT-01: client fixture GET /health。"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_client_fixture_me_unauthorized(client):
    """T-CFT-02: client GET /api/v1/me 无 Token → 401。"""
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_client_fixture_me_with_auth_headers(client, admin_auth_headers):
    """T-CFT-03: client + admin_auth_headers GET /api/v1/me → 200 admin。"""
    response = client.get("/api/v1/me", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_unauthorized_headers_fixture_returns_401(client, unauthorized_headers):
    """T-CFT-04: unauthorized_headers + client → GET /api/v1/me 401 UNAUTHORIZED。"""
    response = client.get("/api/v1/me", headers=unauthorized_headers)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_trace_id_headers_fixture_echoes_trace(client, trace_id_headers):
    """T-CFT-05: trace_id_headers + client → 响应头 X-Trace-Id 回显。"""
    incoming = trace_id_headers["X-Trace-Id"]
    response = client.get("/health", headers=trace_id_headers)
    assert response.status_code == 200
    assert response.headers.get("X-Trace-Id") == incoming


def test_combined_auth_trace_headers_fixture(client, combined_auth_trace_headers, admin_auth_headers):
    """T-CFT-06: combined_auth_trace_headers 同时满足 me 200 + trace 回显。"""
    me = client.get("/api/v1/me", headers=combined_auth_trace_headers)
    assert me.status_code == 200
    assert me.json()["username"] == "admin"

    incoming = combined_auth_trace_headers["X-Trace-Id"]
    health = client.get("/health", headers=combined_auth_trace_headers)
    assert health.status_code == 200
    assert health.headers.get("X-Trace-Id") == incoming


def test_consecutive_client_requests_trace_isolation(client):
    """T-CFT-07: 连续 GET /health 各自生成或可透传 X-Trace-Id。"""
    first = client.get("/health")
    second = client.get("/health")
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.headers.get("X-Trace-Id")
    assert second.headers.get("X-Trace-Id")


def test_development_env_allows_jwt_token(client, admin_auth_headers):
    """T-CFT-08: development 环境 admin_auth_headers JWT 可达 /api/v1/me。"""
    assert get_settings().vitalspan_env == "development"
    assert admin_auth_headers["Authorization"].startswith("Bearer ")
    assert "dev" not in admin_auth_headers["Authorization"]
    response = client.get("/api/v1/me", headers=admin_auth_headers)
    assert response.status_code == 200


def test_lowercase_bearer_headers_fixture_returns_401(client, lowercase_bearer_headers):
    """T-CFT-09: lowercase_bearer_headers fixture + client → GET /api/v1/me 401。"""
    response = client.get("/api/v1/me", headers=lowercase_bearer_headers)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_malformed_auth_headers_fixture_returns_401(client, malformed_auth_headers):
    """T-CFT-10: malformed_auth_headers fixture + client → GET /api/v1/me 401。"""
    response = client.get("/api/v1/me", headers=malformed_auth_headers)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
