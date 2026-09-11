"""Embed 分享页须绑定本环境演示数据源与 Dataset configId。"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF
from app.datasources.models import get_meta_engine
from app.metadata.dataset.demo_bindings import ensure_demo_dataset_bindings
from app.metadata.dataset.models import DatasetRecord
from jwt_auth import AUTH


def _seed_dashboard_with_dataset_chart(client: TestClient) -> tuple[str, str]:
    dash = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Embed Dataset", "slug": f"embed-ds-{uuid.uuid4().hex[:8]}"},
    )
    assert dash.status_code == 201, dash.text
    dash_id = dash.json()["id"]
    chart_id = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": chart_id,
                "type": "chart",
                "title": "销售",
                "colSpan": 6,
                "rowSpan": 1,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "chartId": chart_id,
                    "mode": "dataset",
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "datasetId": "demo-sales-wide",
                    "configId": "00000000-0000-4000-8000-00000000dead",
                },
            }
        ],
        "globalFilters": [],
    }
    put = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text
    return dash_id, chart_id


def test_embed_dashboard_layout_binds_demo_dataset_config(client: TestClient):
    with Session(get_meta_engine()) as session:
        ensure_demo_dataset_bindings(session)
        demo_row = session.get(DatasetRecord, "demo-sales-wide")
        assert demo_row is not None
        assert demo_row.bound_config_id is not None
        expected_config = str(demo_row.bound_config_id)

    dash_id, _ = _seed_dashboard_with_dataset_chart(client)
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"dashboardId": dash_id, "shareMode": "public"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]

    resp = client.get(
        f"/api/v1/embed/dashboard-layout?token={token}&dashboardId={dash_id}",
    )
    assert resp.status_code == 200, resp.text
    cfg = resp.json()["layoutJson"]["widgets"][0]["chartConfig"]
    assert cfg["dataSourceId"] not in (None, "", TEMPLATE_DEMO_DATASOURCE_REF)
    assert cfg["configId"] == expected_config


def test_embed_dataset_execute_with_token_header(client: TestClient):
    """Dataset 模式图表须走 /embed/dataset/execute + X-Embed-Token，不得落 JWT 中间件。"""
    with Session(get_meta_engine()) as session:
        ensure_demo_dataset_bindings(session)
        demo_row = session.get(DatasetRecord, "demo-sales-wide")
        assert demo_row is not None
        assert demo_row.bound_config_id is not None
        expected_config = str(demo_row.bound_config_id)
        from app.dashboard.templates.demo_datasource import resolve_sample_db_datasource_id

        demo_ds = resolve_sample_db_datasource_id(session)
        assert demo_ds is not None

    dash_id, _ = _seed_dashboard_with_dataset_chart(client)
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"dashboardId": dash_id, "shareMode": "public"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]

    resp = client.post(
        "/api/v1/embed/dataset/execute",
        headers={"X-Embed-Token": token},
        json={
            "dataSourceId": str(demo_ds),
            "configId": expected_config,
            "limit": 5,
            "parameters": {},
            "rls": {"enabled": False},
        },
    )
    # 须穿透中间件（非 Missing or invalid bearer token）；CI 无样例库时可能 500。
    assert resp.status_code != 401 or resp.json().get("message") != "Missing or invalid bearer token", (
        resp.text
    )

    unauth = client.post(
        "/api/v1/embed/dataset/execute",
        json={
            "dataSourceId": str(demo_ds),
            "configId": expected_config,
            "limit": 5,
            "parameters": {},
            "rls": {"enabled": False},
        },
    )
    assert unauth.status_code == 401, unauth.text
    assert unauth.json()["message"] == "Missing embed token"


def test_embed_chart_view_binds_demo_dataset_config(client: TestClient):
    with Session(get_meta_engine()) as session:
        ensure_demo_dataset_bindings(session)
        expected_config = str(session.get(DatasetRecord, "demo-sales-wide").bound_config_id)

    _, chart_id = _seed_dashboard_with_dataset_chart(client)
    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": chart_id, "shareMode": "public"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]

    resp = client.get(f"/api/v1/embed/chart-view?token={token}&chartId={chart_id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["configId"] == expected_config
    assert body["dataSourceId"] not in (None, "", TEMPLATE_DEMO_DATASOURCE_REF)


def test_embed_chart_view_resolves_legacy_widget_without_type(client: TestClient):
    dash = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Embed Legacy Widget", "slug": f"embed-leg-{uuid.uuid4().hex[:8]}"},
    )
    assert dash.status_code == 201, dash.text
    dash_id = dash.json()["id"]
    chart_id = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": chart_id,
                "title": "Widget",
                "colSpan": 6,
                "rowSpan": 1,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "chartId": chart_id,
                    "mode": "sql",
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "sql": "SELECT 1 AS id",
                },
            }
        ],
        "globalFilters": [],
    }
    put = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text

    created = client.post(
        "/api/v1/embed/token",
        headers=AUTH,
        json={"chartId": chart_id, "shareMode": "public"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]

    resp = client.get(f"/api/v1/embed/chart-view?token={token}&chartId={chart_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["chartId"] == chart_id
