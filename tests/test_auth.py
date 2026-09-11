import pytest

from jwt_auth import jwt_auth_headers

UNAUTHORIZED_BODY = {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid bearer token",
    "detail": None,
}


def test_me_invalid_bearer_returns_401(client, unauthorized_headers):
    """T-AUTH-02: Authorization: Bearer invalid → 401。"""
    response = client.get("/api/v1/me", headers=unauthorized_headers)
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_empty_bearer_token_returns_401(client):
    """T-AUTH-03: Authorization: Bearer（空 token）→ 401。"""
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer "})
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


def test_me_bearer_jwt_returns_200(client, admin_auth_headers):
    """T-AUTH-04: JWT admin_auth_headers → 200。"""
    response = client.get("/api/v1/me", headers=admin_auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin"
    assert response.json()["id"] != "dev"


@pytest.mark.parametrize(
    "path",
    ["/health", "/openapi.json", "/docs"],
)
def test_public_paths_accessible_without_token(client, path):
    """T-AUTH-05~07: 公开路径无 Token → 200。"""
    response = client.get(path)
    assert response.status_code == 200


def test_options_preflight_not_blocked_by_auth(client):
    """T-AUTH-08: OPTIONS 预检不被鉴权中间件 401 拦截。"""
    response = client.options(
        "/api/v1/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code != 401


def test_healthz_returns_401(client):
    """T-AUTH-09: /healthz 无 Token → 401。"""
    response = client.get("/healthz")
    assert response.status_code == 401
    assert response.json() == UNAUTHORIZED_BODY


@pytest.mark.parametrize(
    "headers,expected_status",
    [
        ({}, 401),
        ({"Authorization": "Bearer "}, 401),
        ({"Authorization": "Bearer invalid"}, 401),
        (jwt_auth_headers(user_id="00000000-0000-0000-0000-000000000001", username="admin"), 200),
        ({"Authorization": "Basic dev"}, 401),
    ],
)
def test_me_auth_matrix(client, headers, expected_status):
    """T-AUTH-10: /api/v1/me 鉴权矩阵快照。"""
    response = client.get("/api/v1/me", headers=headers)
    assert response.status_code == expected_status
    if expected_status == 401:
        assert response.json() == UNAUTHORIZED_BODY
    else:
        assert response.json()["username"] == "admin"
        assert response.json()["id"] != "dev"


def test_redoc_public_path_returns_200(client):
    """T-AUTH-11: /redoc 公开路径无 Token → 200。"""
    response = client.get("/redoc")
    assert response.status_code == 200
