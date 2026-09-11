from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.dashboard.surface_kind import read_surface_kind_from_layout
from app.main import app as fastapi_app
from jwt_auth import AUTH

_SQLITE_URL = "sqlite+pysqlite:///file:dash_surface_kind?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def dash_surface_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.dataset.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _create_dashboard(client: TestClient, *, slug: str, surface_kind: str | None = None) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": slug, "slug": slug},
    )
    assert resp.status_code == 201, resp.text
    dash_id = resp.json()["id"]
    layout = {
        "version": 2,
        "canvas": {"width": 1440, "height": 900},
        "widgets": [],
        "globalFilters": [],
    }
    if surface_kind == "data-screen":
        layout["canvas"] = {"width": 1920, "height": 1080}
        layout["styleConfig"] = {
            "surfaceKind": "data-screen",
            "colorScheme": "dark",
            "canvasBackground": "#0b1220",
            "canvasBackgroundCustom": True,
            "scaleMode": "canvas",
            "gapPreset": "none",
            "widgetGap": 0,
            "pixelGutter": 0,
            "themeAccent": "#3b82f6",
        }
    put = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text
    return dash_id


def test_list_dashboards_surface_kind_filter(client: TestClient) -> None:
    _create_dashboard(client, slug=f"dash-{uuid.uuid4().hex[:8]}")
    _create_dashboard(client, slug=f"screen-{uuid.uuid4().hex[:8]}", surface_kind="data-screen")

    all_resp = client.get("/api/v1/dashboards", headers=AUTH)
    assert all_resp.status_code == 200
    assert all_resp.json()["total"] >= 2

    dash_resp = client.get("/api/v1/dashboards?surfaceKind=dashboard", headers=AUTH)
    assert dash_resp.status_code == 200
    dash_items = dash_resp.json()["items"]
    assert all(item.get("surfaceKind") != "data-screen" for item in dash_items)

    screen_resp = client.get("/api/v1/dashboards?surfaceKind=data-screen", headers=AUTH)
    assert screen_resp.status_code == 200
    screen_items = screen_resp.json()["items"]
    assert len(screen_items) >= 1
    assert all(item.get("surfaceKind") == "data-screen" for item in screen_items)
    assert all("previewSummary" in item for item in screen_items)
    assert all("layoutJson" not in item for item in screen_items)


def test_data_screen_default_layout_accepts_1920_canvas(client: TestClient) -> None:
    dash_id = _create_dashboard(
        client,
        slug=f"screen-1920-{uuid.uuid4().hex[:8]}",
        surface_kind="data-screen",
    )
    get_resp = client.get(f"/api/v1/dashboards/{dash_id}", headers=AUTH)
    assert get_resp.status_code == 200
    layout = get_resp.json()["layoutJson"]
    assert layout["canvas"] == {"width": 1920, "height": 1080}
    assert layout["styleConfig"]["surfaceKind"] == "data-screen"
