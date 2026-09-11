"""Viz component library — DASH-010."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import get_settings
from app.datasources.models import Base, get_meta_engine, get_meta_session

_VIZ_COMP_SQLITE = "sqlite+pysqlite:///file:viz_comp_r01?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def viz_comp_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _VIZ_COMP_SQLITE
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    from app.viz.components.models import VizComponent  # noqa: F401

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM viz_components"))
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()


@pytest.fixture
def db_session():
    session = get_meta_session()
    try:
        yield session
        session.rollback()
        session.execute(text("DELETE FROM viz_components"))
        session.commit()
    finally:
        session.close()


def _chart_payload() -> dict:
    return {
        "chartConfig": {
            "chartId": "placeholder",
            "chartType": "bar",
            "mode": "sql",
            "dataSourceId": str(uuid.uuid4()),
            "sql": "select 1",
            "dimensions": [],
            "metrics": [],
            "filters": [],
        }
    }


def _line_payload() -> dict:
    payload = _chart_payload()
    payload["chartConfig"]["chartType"] = "line"
    return payload


def test_list_filters_by_chart_palette_category(client: TestClient, auth_headers: dict, db_session) -> None:
    bar = client.post(
        "/api/v1/viz-components",
        headers=auth_headers,
        json={
            "name": "柱状组件",
            "widgetType": "chart",
            "payloadJson": _chart_payload(),
            "visibility": "org",
        },
    )
    line = client.post(
        "/api/v1/viz-components",
        headers=auth_headers,
        json={
            "name": "折线组件",
            "widgetType": "chart",
            "payloadJson": _line_payload(),
            "visibility": "org",
        },
    )
    assert bar.status_code == 201
    assert line.status_code == 201
    client.post(f"/api/v1/viz-components/{bar.json()['id']}/publish", headers=auth_headers)
    client.post(f"/api/v1/viz-components/{line.json()['id']}/publish", headers=auth_headers)

    compare = client.get(
        "/api/v1/viz-components?widgetType=chart&chartPaletteCategory=compare",
        headers=auth_headers,
    )
    trend = client.get(
        "/api/v1/viz-components?widgetType=chart&chartPaletteCategory=trend",
        headers=auth_headers,
    )
    assert compare.status_code == 200
    assert trend.status_code == 200
    compare_names = {item["name"] for item in compare.json()["items"]}
    trend_names = {item["name"] for item in trend.json()["items"]}
    assert "柱状组件" in compare_names
    assert "折线组件" not in compare_names
    assert "折线组件" in trend_names
    assert "柱状组件" not in trend_names


def test_create_publish_and_batch_resolve(client: TestClient, auth_headers: dict, db_session) -> None:
    created = client.post(
        "/api/v1/viz-components",
        headers=auth_headers,
        json={
            "name": "测试 KPI",
            "widgetType": "chart",
            "surfaceKinds": ["dashboard", "data-screen"],
            "payloadJson": _chart_payload(),
            "visibility": "org",
        },
    )
    assert created.status_code == 201
    body = created.json()
    component_id = body["id"]
    assert body["status"] == "draft"

    published = client.post(
        f"/api/v1/viz-components/{component_id}/publish",
        headers=auth_headers,
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["contentRevision"] >= 2

    listed = client.get("/api/v1/viz-components?surfaceKind=dashboard", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    resolved = client.post(
        "/api/v1/viz-components/batch-resolve",
        headers=auth_headers,
        json={"ids": [component_id]},
    )
    assert resolved.status_code == 200
    assert len(resolved.json()["items"]) == 1
    assert resolved.json()["items"][0]["payloadJson"]["chartConfig"]["chartType"] == "bar"


def test_update_bumps_revision(client: TestClient, auth_headers: dict, db_session) -> None:
    created = client.post(
        "/api/v1/viz-components",
        headers=auth_headers,
        json={
            "name": "可更新组件",
            "widgetType": "chart",
            "payloadJson": _chart_payload(),
        },
    ).json()
    component_id = created["id"]
    revision = created["contentRevision"]
    payload = _chart_payload()
    payload["chartConfig"]["chartType"] = "line"

    updated = client.put(
        f"/api/v1/viz-components/{component_id}",
        headers=auth_headers,
        json={"payloadJson": payload, "contentRevision": revision},
    )
    assert updated.status_code == 200
    assert updated.json()["contentRevision"] == revision + 1
    assert updated.json()["payloadJson"]["chartConfig"]["chartType"] == "line"


def _custom_viz_payload(artifact_id: str | None = None) -> dict:
    return {
        "customVizConfig": {
            "artifactId": artifact_id or str(uuid.uuid4()),
            "dataBinding": {
                "status": "manual",
                "dimensions": [],
                "metrics": [],
            },
            "style": {"accentColor": "#336699"},
        }
    }


def test_create_publish_and_resolve_custom_viz(client: TestClient, auth_headers: dict, db_session) -> None:
    artifact_id = str(uuid.uuid4())
    created = client.post(
        "/api/v1/viz-components",
        headers=auth_headers,
        json={
            "name": "AI 排名条",
            "widgetType": "customViz",
            "surfaceKinds": ["dashboard", "data-screen"],
            "payloadJson": _custom_viz_payload(artifact_id),
            "visibility": "org",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    component_id = body["id"]
    assert body["widgetType"] == "customViz"

    published = client.post(
        f"/api/v1/viz-components/{component_id}/publish",
        headers=auth_headers,
    )
    assert published.status_code == 200

    resolved = client.post(
        "/api/v1/viz-components/batch-resolve",
        headers=auth_headers,
        json={"ids": [component_id]},
    )
    assert resolved.status_code == 200
    item = resolved.json()["items"][0]
    assert item["payloadJson"]["customVizConfig"]["artifactId"] == artifact_id
    assert item["payloadJson"]["customVizConfig"]["style"]["accentColor"] == "#336699"
