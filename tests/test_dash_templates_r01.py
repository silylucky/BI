"""Dashboard visualization template center — DASH-009."""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import get_settings
from app.datasources.models import Base, get_meta_engine, get_meta_session

_DASH_TMPL_SQLITE = "sqlite+pysqlite:///file:dash_tmpl_r01?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def dash_tmpl_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DASH_TMPL_SQLITE
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    from app.dashboard.templates.models import DashboardTemplate  # noqa: F401
    from app.dashboard.models import Dashboard  # noqa: F401
    from app.datasources.models import DataSource  # noqa: F401

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM dashboard_templates"))
        conn.execute(text("DELETE FROM dashboards"))
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
        session.execute(text("DELETE FROM dashboard_templates"))
        session.execute(text("DELETE FROM dashboards"))
        session.execute(text("DELETE FROM data_sources"))
        session.commit()
    finally:
        session.close()


def test_list_builtin_templates(client: TestClient, auth_headers: dict, db_session) -> None:
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates

    seed_builtin_dashboard_templates(db_session)
    res = client.get(
        "/api/v1/dashboard-templates?surfaceKind=data-screen",
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 4
    names = {item["name"] for item in body["items"]}
    assert "工业园区数据监控中心" in names


def test_from_template_creates_dashboard(client: TestClient, auth_headers: dict, db_session) -> None:
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates
    from app.datasources.models import DataSource

    db_session.add(
        DataSource(
            id=uuid.uuid4(),
            name="示例数据",
            code="demo",
            type="mysql",
            host="127.0.0.1",
            port=3307,
            database="sample_db",
            username="sample",
            password_encrypted="enc",
        ),
    )
    db_session.commit()
    seed_builtin_dashboard_templates(db_session)
    listed = client.get(
        "/api/v1/dashboard-templates?surfaceKind=dashboard",
        headers=auth_headers,
    ).json()
    template_id = listed["items"][0]["id"]
    res = client.post(
        "/api/v1/dashboards/from-template",
        headers=auth_headers,
        json={"templateId": template_id, "name": "从模板创建"},
    )
    assert res.status_code == 201
    created = res.json()
    assert created["name"] == "从模板创建"
    layout = created["layoutJson"]
    assert layout["styleConfig"]["surfaceKind"] == "dashboard"


def test_import_export_envelope_roundtrip(client: TestClient, auth_headers: dict, db_session) -> None:
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates

    seed_builtin_dashboard_templates(db_session)
    detail = client.get("/api/v1/dashboard-templates", headers=auth_headers).json()
    template_id = detail["items"][0]["id"]
    exported = client.get(
        f"/api/v1/dashboard-templates/{template_id}/export",
        headers=auth_headers,
    )
    assert exported.status_code == 200
    envelope = exported.json()
    assert envelope["kind"] == "viz-layout"
    imported = client.post(
        "/api/v1/dashboard-templates/import",
        headers=auth_headers,
        json=envelope,
    )
    assert imported.status_code == 201
    assert imported.json()["status"] == "draft"


def test_export_envelope_normalizes_datasource_to_demo_ref(
    client: TestClient, auth_headers: dict, db_session
) -> None:
    from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF

    env_uuid = str(uuid.uuid4())
    widget_id = str(uuid.uuid4())
    create = client.post(
        "/api/v1/dashboard-templates",
        headers=auth_headers,
        json={
            "name": "export-demo-ref-test",
            "surfaceKind": "dashboard",
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": widget_id,
                        "type": "chart",
                        "title": "sales",
                        "order": 0,
                        "colSpan": 12,
                        "rowSpan": 4,
                        "chartConfig": {
                            "chartId": widget_id,
                            "chartType": "bar",
                            "mode": "dataset",
                            "datasetId": "demo-sales-wide",
                            "configId": str(uuid.uuid4()),
                            "dataSourceId": env_uuid,
                        },
                    }
                ],
                "globalFilters": [],
                "styleConfig": {"surfaceKind": "dashboard"},
            },
        },
    )
    assert create.status_code == 201
    template_id = create.json()["id"]
    exported = client.get(
        f"/api/v1/dashboard-templates/{template_id}/export",
        headers=auth_headers,
    )
    assert exported.status_code == 200
    chart_cfg = exported.json()["layout"]["widgets"][0]["chartConfig"]
    assert chart_cfg["dataSourceId"] == TEMPLATE_DEMO_DATASOURCE_REF
    assert chart_cfg.get("mode") == "dataset"
    assert chart_cfg.get("datasetId") == "demo-sales-wide"


def test_export_envelope_repairs_deprecated_chart_types(client: TestClient, auth_headers: dict) -> None:
    widget_id = str(uuid.uuid4())
    create = client.post(
        "/api/v1/dashboard-templates",
        headers=auth_headers,
        json={
            "name": "export-migrate-test",
            "surfaceKind": "dashboard",
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": widget_id,
                        "type": "chart",
                        "title": "detail",
                        "order": 0,
                        "colSpan": 12,
                        "rowSpan": 4,
                        "chartConfig": {
                            "chartId": widget_id,
                            "chartType": "table",
                            "mode": "dataset",
                            "datasetId": "demo-orders",
                            "configId": str(uuid.uuid4()),
                        },
                    }
                ],
                "globalFilters": [],
                "styleConfig": {"surfaceKind": "dashboard"},
            },
        },
    )
    assert create.status_code == 201
    template_id = create.json()["id"]
    exported = client.get(
        f"/api/v1/dashboard-templates/{template_id}/export",
        headers=auth_headers,
    )
    assert exported.status_code == 200
    chart_type = exported.json()["layout"]["widgets"][0]["chartConfig"]["chartType"]
    assert chart_type == "table-info"


def test_publish_requires_manage(client: TestClient, auth_headers: dict, db_session) -> None:
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates

    seed_builtin_dashboard_templates(db_session)
    create = client.post(
        "/api/v1/dashboard-templates",
        headers=auth_headers,
        json={
            "name": "私有模板",
            "surfaceKind": "dashboard",
            "layoutJson": {"version": 1, "widgets": [], "globalFilters": [], "styleConfig": {"surfaceKind": "dashboard"}},
        },
    )
    assert create.status_code == 201
    template_id = create.json()["id"]
    publish = client.post(
        f"/api/v1/dashboard-templates/{template_id}/publish",
        headers=auth_headers,
    )
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"


def test_builtin_template_layout_update_for_admin(
    client: TestClient,
    auth_headers: dict,
    db_session,
) -> None:
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates

    seed_builtin_dashboard_templates(db_session)
    listed = client.get("/api/v1/dashboard-templates?visibility=builtin", headers=auth_headers).json()
    template = listed["items"][0]
    layout = {
        "version": 1,
        "widgets": [],
        "globalFilters": [],
        "styleConfig": {"surfaceKind": template["surfaceKind"]},
    }
    res = client.put(
        f"/api/v1/dashboard-templates/{template['id']}",
        headers=auth_headers,
        json={"layoutJson": layout, "contentRevision": template["contentRevision"]},
    )
    assert res.status_code == 200
    assert res.json()["contentRevision"] == template["contentRevision"] + 1


def test_builtin_template_delete_forbidden(client: TestClient, auth_headers: dict, db_session) -> None:
    from app.dashboard.templates.seed import seed_builtin_dashboard_templates

    seed_builtin_dashboard_templates(db_session)
    listed = client.get("/api/v1/dashboard-templates?visibility=builtin", headers=auth_headers).json()
    template_id = listed["items"][0]["id"]
    res = client.delete(f"/api/v1/dashboard-templates/{template_id}", headers=auth_headers)
    assert res.status_code == 403
    assert res.json()["code"] == "DASH_TEMPLATE_BUILTIN_READONLY"


def test_delete_custom_template(client: TestClient, auth_headers: dict, db_session) -> None:
    create = client.post(
        "/api/v1/dashboard-templates",
        headers=auth_headers,
        json={
            "name": "待删除模板",
            "surfaceKind": "dashboard",
            "layoutJson": {
                "version": 1,
                "widgets": [],
                "globalFilters": [],
                "styleConfig": {"surfaceKind": "dashboard"},
            },
        },
    )
    assert create.status_code == 201
    template_id = create.json()["id"]
    res = client.delete(f"/api/v1/dashboard-templates/{template_id}", headers=auth_headers)
    assert res.status_code == 204
    detail = client.get(f"/api/v1/dashboard-templates/{template_id}", headers=auth_headers)
    assert detail.status_code == 404


def test_legacy_data_screen_envelope_import(client: TestClient, auth_headers: dict) -> None:
    res = client.post(
        "/api/v1/dashboard-templates/import",
        headers=auth_headers,
        json={
            "templateVersion": 1,
            "kind": "data-screen",
            "name": "导入大屏",
            "layout": {
                "version": 2,
                "canvas": {"width": 1920, "height": 1080},
                "widgets": [],
                "globalFilters": [],
                "styleConfig": {"surfaceKind": "data-screen", "colorScheme": "dark"},
            },
        },
    )
    assert res.status_code == 201
    assert res.json()["surfaceKind"] == "data-screen"
