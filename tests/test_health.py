import time

import pytest


def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_cors_preflight(client):
    """T-HLT-02: OPTIONS /health CORS 预检含 Access-Control-Allow-Origin。"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_openapi_json_public(client):
    """T-HLT-03: GET /openapi.json 公开可访问。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()
    assert "openapi" in body


def test_docs_public(client):
    """T-HLT-04: GET /docs 公开可访问。"""
    response = client.get("/docs")
    assert response.status_code == 200


def test_unknown_route_returns_404(client, auth_headers):
    """T-HLT-05: GET /nonexistent-route-xyz → 404（经鉴权后由路由层返回）。"""
    response = client.get("/nonexistent-route-xyz", headers=auth_headers)
    assert response.status_code == 404


def test_openapi_paths_include_health_and_me(client):
    """T-HLT-06/07: OpenAPI paths 含 /health 与 /api/v1/me。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/health" in paths
    assert "/api/v1/me" in paths


def test_health_cors_preflight_regression(client):
    """T-HLT-08: CORS 预检回归（中间件链未破坏公开路径）。"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_health_cors_preflight_illegal_origin_no_acao(client):
    """T-HLT-09: OPTIONS /health 非法 Origin 无 Access-Control-Allow-Origin。"""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin is None or allow_origin != "http://evil.example"


def test_redoc_public(client):
    """T-HLT-10: GET /redoc 公开可访问。"""
    response = client.get("/redoc")
    assert response.status_code == 200


def test_health_get_allowed_origin_returns_acao(client):
    """T-HLT-11: GET /health 带允许 Origin 返回 ACAO。"""
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_openapi_json_has_version_key(client):
    """T-HLT-12: OpenAPI 文档含 openapi 3.x 版本键。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()
    assert "openapi" in body
    assert str(body["openapi"]).startswith("3.")


def test_openapi_info_metadata(client):
    """T-HLT-13: OpenAPI info.title/version 元数据。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    info = response.json()["info"]
    assert info["title"] == "VitalSpan"
    assert info["version"] == "0.1.0"


def test_health_consecutive_requests_stable(client):
    """T-HLT-14: 连续 GET /health 稳定（lifespan/scheduler）。"""
    for _ in range(3):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.headers.get("X-Trace-Id")


def test_openapi_paths_include_ingestion_sync_jobs(client):
    """T-HLT-15: OpenAPI paths 含 ingestion sync-jobs。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/ingestion/sync-jobs" in paths


def test_health_first_request_startup_smoke(client):
    """T-HLT-16: 首请求 GET /health 耗时 smoke < 2.0s。"""
    start = time.perf_counter()
    response = client.get("/health")
    elapsed = time.perf_counter() - start
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert elapsed < 2.0


def test_openapi_public_me_protected_boundary(client):
    """T-HLT-17: /openapi.json 公开；/api/v1/me 无 Token → 401。"""
    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    assert "openapi" in openapi.json()

    me = client.get("/api/v1/me")
    assert me.status_code == 401
    assert me.json()["code"] == "UNAUTHORIZED"


def test_health_get_illegal_origin_no_acao(client):
    """T-HLT-18: GET /health 非法 Origin 无 access-control-allow-origin。"""
    response = client.get(
        "/health",
        headers={"Origin": "http://evil.example"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin is None or allow_origin != "http://evil.example"


@pytest.mark.parametrize(
    "origin,expected_status,expected_acao",
    [
        ("http://localhost:5173", 200, "http://localhost:5173"),
        ("http://evil.example", 400, None),
    ],
)
def test_health_cors_preflight_multi_origin_matrix(
    client, origin, expected_status, expected_acao
):
    """T-HLT-19: CORS 预检多 Origin 矩阵 — 允许 Origin 200+ACAO；非法 Origin 400 无 evil ACAO。"""
    response = client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == expected_status
    acao = response.headers.get("access-control-allow-origin")
    if expected_acao is None:
        assert acao is None or acao != origin
    else:
        assert acao == expected_acao


def test_health_trace_method_not_allowed(client):
    """T-HLT-20: TRACE /health → 405 或 404（稳定非 500）。"""
    response = client.request("TRACE", "/health")
    assert response.status_code in (404, 405)
    assert response.status_code != 500


def test_openapi_schema_key_paths_snapshot(client):
    """T-HLT-21: OpenAPI schema 关键路径快照 — paths 子集 + info.title + /me GET 401 契约。"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    body = response.json()

    assert body["info"]["title"] == "VitalSpan"
    paths = body["paths"]
    for required_path in (
        "/health",
        "/api/v1/me",
        "/api/v1/ingestion/sync-jobs",
    ):
        assert required_path in paths

    me_get = paths["/api/v1/me"]["get"]
    assert me_get is not None
    assert "auth" in me_get.get("tags", [])

    me_unauth = client.get("/api/v1/me")
    assert me_unauth.status_code == 401
    assert me_unauth.json()["code"] == "UNAUTHORIZED"


def test_health_consecutive_p95_smoke(client):
    """T-HLT-22: 连续 5× GET /health max elapsed < 0.5s（宽松 P95 smoke）。"""
    elapsed_list: list[float] = []
    for _ in range(5):
        start = time.perf_counter()
        response = client.get("/health")
        elapsed_list.append(time.perf_counter() - start)
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    assert max(elapsed_list) < 0.5


@pytest.mark.parametrize("path", ["/docs", "/openapi.json"])
def test_public_path_cors_preflight_illegal_origin(client, path):
    """T-HLT-23/24: OPTIONS /docs 与 /openapi.json 非法 Origin → 400 无 evil ACAO。"""
    response = client.options(
        path,
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    acao = response.headers.get("access-control-allow-origin")
    assert acao is None or acao != "http://evil.example"


def test_docs_and_openapi_public_without_auth(client):
    """T-HLT-25: GET /docs 与 /openapi.json 无 Authorization → 200；OpenAPI 含 openapi 键。"""
    docs = client.get("/docs")
    assert docs.status_code == 200

    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    assert "openapi" in openapi.json()
