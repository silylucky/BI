"""T-RTR-01~02: api_v1_router 路由表模块级断言。"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1.router import api_v1_router


def _route_paths() -> list[str]:
    paths: list[str] = []

    def collect(router, prefix: str = "") -> None:
        for route in router.routes:
            if hasattr(route, "original_router"):
                sub_prefix = getattr(route.include_context, "prefix", "") or ""
                collect(route.original_router, prefix + sub_prefix)
            else:
                segment = getattr(route, "path", "") or ""
                paths.append(prefix + segment)

    collect(api_v1_router)
    return paths


def test_api_v1_router_includes_me_route():
    """T-RTR-01: api_v1_router 含 /me 路由。"""
    paths = _route_paths()
    assert any("/me" in path or path.endswith("/me") for path in paths), paths


def test_api_v1_router_includes_ingestion_prefix():
    """T-RTR-02: api_v1_router 含 ingestion 前缀或 sync-jobs 段。"""
    paths = _route_paths()
    assert any(
        path.startswith("/ingestion") or "sync-jobs" in path for path in paths
    ), paths


def test_empty_api_v1_router_not_500():
    """T-RTR-03: 空 APIRouter 挂载 /api/v1 → 404/405，非 500。"""
    from fastapi import APIRouter

    app = FastAPI()
    empty = APIRouter(prefix="/api/v1")
    app.include_router(empty)
    isolated = TestClient(app)

    for path in ("/api/v1", "/api/v1/"):
        response = isolated.get(path)
        assert response.status_code in (404, 405)
        assert response.status_code != 500


def test_api_v1_router_has_at_least_two_routes():
    """T-RTR-04: 生产 api_v1_router 路由数 ≥2（/me + ingestion 段）。"""
    paths = _route_paths()
    assert len(paths) >= 2, paths
