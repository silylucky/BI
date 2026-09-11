"""M5 VIZ/DASH L1 kickoff r28 smoke — VIZ-001~002 + DASH-001~003."""
from __future__ import annotations

import os
import uuid

import pytest
from pydantic import ValidationError
from sqlalchemy import text

from app.core.config import get_settings
from app.dashboard.models import Dashboard
from app.dashboard.service import DashboardError, create_dashboard, get_dashboard, update_layout
from app.datasources.models import Base, get_meta_engine, get_meta_session
from app.schemas.chart_view import ChartViewConfig, ChartViewError, validate_chart_view_config

_DASH_SQLITE_URL = "sqlite+pysqlite:///file:viz_dash_r28?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def dash_r28_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DASH_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_get_meta_engine

    get_meta_engine.cache_clear()
    auth_get_meta_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
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
        session.execute(text("DELETE FROM dashboards"))
        session.commit()
    finally:
        session.close()


@pytest.fixture
def auth_user_id() -> uuid.UUID:
    return uuid.UUID("00000000-0000-4000-8000-000000000001")


def _valid_dataset_chart(**overrides: object) -> dict:
    payload = {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "dataset",
        "datasetId": "demo-orders",
        "configId": str(uuid.uuid4()),
    }
    payload.update(overrides)
    return payload


def test_chart_view_table_sql_valid():
    """T-VIZ-R28-001-01: 合法 dataset 配置 model_validate 成功。"""
    cfg = validate_chart_view_config(_valid_dataset_chart())
    assert cfg.chart_type == "table-info"


def test_chart_view_missing_datasource():
    """T-VIZ-R28-001-02: 缺 dataSourceId → ChartViewError CHART_MISSING_DATASOURCE。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _valid_dataset_chart(dataSourceId=None, chartType="table")
        )
    assert exc.value.code == "CHART_MISSING_DATASOURCE"
    assert exc.value.status == 422


def test_chart_view_invalid_type():
    """T-VIZ-R28-001-03: chartType=not-registered → CHART_INVALID_TYPE。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _valid_dataset_chart(chartType="not-registered-type"),
        )
    assert exc.value.code == "CHART_INVALID_TYPE"


def test_chart_view_binding_conflict():
    """T-VIZ-R28-001-04: bindingId → CHART_DATASET_REQUIRED。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "table",
                "bindingId": str(uuid.uuid4()),
                "dataSourceId": str(uuid.uuid4()),
                "mode": "dataset",
                "datasetId": "demo-orders",
                "configId": str(uuid.uuid4()),
            }
        )
    assert exc.value.code == "CHART_DATASET_REQUIRED"


def test_chart_view_camel_round_trip():
    """T-VIZ-R28-001-05: JSON camelCase ↔ snake 一致。"""
    ds = uuid.uuid4()
    raw = _valid_dataset_chart(
        chartType="line",
        dataSourceId=str(ds),
        dimensions=[{"field": "x", "label": "X"}],
        metrics=[{"field": "y"}],
    )
    cfg = validate_chart_view_config(raw)
    dumped = cfg.model_dump(by_alias=True, mode="json")
    assert dumped["chartType"] == "line"
    assert dumped["dataSourceId"] == str(ds)


def test_post_charts_validate_rejects_invalid(client, auth_headers):
    """T-VIZ-R28-001-06: POST /api/v1/charts/validate 非法 → 422 结构化 body。"""
    resp = client.post(
        "/api/v1/charts/validate",
        json={"chartType": "not-registered-type"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "CHART_INVALID_TYPE"


def test_create_dashboard_success(db_session, auth_user_id):
    """T-DASH-R28-001-01: POST 创建 → 返回 id。"""
    out = create_dashboard(db_session, name="销售看板", slug="sales", created_by=auth_user_id)
    assert out.name == "销售看板"
    assert out.slug == "sales"


def test_duplicate_slug_conflict(db_session, auth_user_id):
    """T-DASH-R28-001-05: 重复 slug → DASH_SLUG_CONFLICT。"""
    create_dashboard(db_session, name="A", slug="dup", created_by=auth_user_id)
    with pytest.raises(DashboardError) as exc:
        create_dashboard(db_session, name="B", slug="dup", created_by=auth_user_id)
    assert exc.value.code == "DASH_SLUG_CONFLICT"
    assert exc.value.status == 409


def test_dashboard_crud_smoke(client, auth_headers):
    """T-DASH-R28-001-01~04: CRUD + layout round-trip。"""
    create = client.post(
        "/api/v1/dashboards",
        json={"name": "测试看板", "slug": "test-dash"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    dash_id = create.json()["id"]
    layout = {
        "version": 1,
        "widgets": [{
            "id": str(uuid.uuid4()),
            "type": "chart",
            "title": "表",
            "colSpan": 6,
            "rowSpan": 1,
            "order": 0,
            "chartConfig": _valid_dataset_chart(),
        }],
        "globalFilters": [],
    }
    put_layout = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        json={"layoutJson": layout},
        headers=auth_headers,
    )
    assert put_layout.status_code == 200
    got = client.get(f"/api/v1/dashboards/{dash_id}", headers=auth_headers)
    assert got.json()["layoutJson"]["widgets"][0]["chartConfig"]["chartType"] == "table-info"


def test_dashboard_layout_invalid_chart(client, auth_headers):
    """T-DASH-R28-001-06: 非法 chartType → 422 DASH_INVALID_LAYOUT。"""
    create = client.post(
        "/api/v1/dashboards",
        json={"name": "X", "slug": "x-invalid"},
        headers=auth_headers,
    )
    dash_id = create.json()["id"]
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        json={"layoutJson": {"version": 1, "widgets": [{
            "id": str(uuid.uuid4()), "type": "chart", "title": "t",
            "colSpan": 6, "rowSpan": 1, "order": 0,
            "chartConfig": {"chartType": "not-registered-type"},
        }], "globalFilters": []}},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body.get("code") == "DASH_INVALID_LAYOUT" or "not-registered" in str(body).lower()


def test_charts_validate_success(client, auth_headers):
    """T-VIZ-R28-001-07: POST validate 合法配置 → 200。"""
    resp = client.post(
        "/api/v1/charts/validate",
        json=_valid_dataset_chart(),
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["chartType"] == "table-info"


def test_chart_view_line_valid():
    """T-VIZ-R28-001-08: line 配置含 dimensions/metrics 通过。"""
    cfg = validate_chart_view_config(
        _valid_dataset_chart(
            chartType="line",
            dimensions=[{"field": "x"}],
            metrics=[{"field": "y"}],
        )
    )
    assert cfg.chart_type == "line"


def test_chart_view_bar_valid():
    """T-VIZ-R28-001-09: bar 配置含 dimensions/metrics 通过。"""
    cfg = validate_chart_view_config(
        _valid_dataset_chart(
            chartType="bar",
            dimensions=[{"field": "x"}],
            metrics=[{"field": "y"}],
        )
    )
    assert cfg.chart_type == "bar"


def test_chart_view_dataset_mode_valid():
    """T-VIZ-R28-001-09b: dataset 模式含 configId + dimensions/metrics 通过。"""
    cfg = validate_chart_view_config(
        {
            "chartType": "bar",
            "dataSourceId": str(uuid.uuid4()),
            "mode": "dataset",
            "configId": str(uuid.uuid4()),
            "datasetId": "test1",
            "dimensions": [{"field": "region"}],
            "metrics": [{"field": "amount"}],
        }
    )
    assert cfg.mode == "dataset"
    assert cfg.dataset_id == "test1"


def test_chart_view_dataset_missing_config_id():
    """T-VIZ-R28-001-09c: dataset 模式缺 configId → CHART_MISSING_CONFIG_ID。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "bar",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "dataset",
                "dimensions": [{"field": "x"}],
                "metrics": [{"field": "y"}],
            }
        )
    assert exc.value.code == "CHART_MISSING_CONFIG_ID"


def test_chart_view_binding_only():
    """T-VIZ-R28-001-10: 仅 bindingId → CHART_DATASET_REQUIRED。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {"chartType": "table", "bindingId": str(uuid.uuid4())}
        )
    assert exc.value.code == "CHART_DATASET_REQUIRED"


def test_list_dashboards_api(client, auth_headers):
    """T-DASH-R28-001-02: GET /dashboards 返回列表结构。"""
    client.post(
        "/api/v1/dashboards",
        json={"name": "L", "slug": "list-test"},
        headers=auth_headers,
    )
    resp = client.get("/api/v1/dashboards", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert body["total"] >= 1


def test_dashboard_layout_draft_widget_without_datasource(client, auth_headers):
    """T-DASH-DE-DRAFT-01: 未配数据源的草稿 widget 可保存 layout（对标 DE 草稿）。"""
    create = client.post(
        "/api/v1/dashboards",
        json={"name": "草稿看板", "slug": f"draft-{uuid.uuid4().hex[:8]}"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    dash_id = create.json()["id"]
    wid = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [{
            "id": wid,
            "type": "chart",
            "title": "表格",
            "colSpan": 6,
            "rowSpan": 2,
            "order": 0,
            "chartConfig": {
                "chartType": "table",
                "chartId": wid,
                "dataSourceId": "",
                "mode": "dataset",
                "dimensions": [],
                "metrics": [],
            },
        }],
        "globalFilters": [],
    }
    put_layout = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        json={"layoutJson": layout},
        headers=auth_headers,
    )
    assert put_layout.status_code == 200
    got = client.get(f"/api/v1/dashboards/{dash_id}", headers=auth_headers)
    saved = got.json()["layoutJson"]["widgets"][0]["chartConfig"]
    assert saved["chartType"] == "table-info"
    assert saved.get("dataSourceId") in (None, "")


def test_dashboard_duplicate_slug_api(client, auth_headers):
    """T-DASH-R28-001-05-api: 重复 slug → 409。"""
    client.post(
        "/api/v1/dashboards",
        json={"name": "A", "slug": "dup-api"},
        headers=auth_headers,
    )
    resp = client.post(
        "/api/v1/dashboards",
        json={"name": "B", "slug": "dup-api"},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "DASH_SLUG_CONFLICT"


def test_delete_dashboard_api(client, auth_headers):
    """T-DASH-R28-001-03: DELETE → 204。"""
    created = client.post(
        "/api/v1/dashboards",
        json={"name": "Del", "slug": "del-test"},
        headers=auth_headers,
    )
    dash_id = created.json()["id"]
    resp = client.delete(f"/api/v1/dashboards/{dash_id}", headers=auth_headers)
    assert resp.status_code == 204
    got = client.get(f"/api/v1/dashboards/{dash_id}", headers=auth_headers)
    assert got.status_code == 404


def test_update_dashboard_name_api(client, auth_headers):
    """T-DASH-R28-001-04: PUT 更新名称。"""
    created = client.post(
        "/api/v1/dashboards",
        json={"name": "Old", "slug": "upd-test"},
        headers=auth_headers,
    )
    dash_id = created.json()["id"]
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}",
        json={"name": "New Name"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_get_dashboard_not_found(client, auth_headers):
    """T-DASH-R28-001-07: 不存在 id → 404。"""
    resp = client.get(
        f"/api/v1/dashboards/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DASH_NOT_FOUND"


def test_update_layout_service(db_session, auth_user_id):
    """T-DASH-R28-003-01: service update_layout 持久化 chartConfig。"""
    out = create_dashboard(db_session, name="L", slug="layout-svc", created_by=auth_user_id)
    layout = {
        "version": 1,
        "widgets": [{
            "id": str(uuid.uuid4()),
            "type": "chart",
            "title": "T",
            "colSpan": 6,
            "rowSpan": 1,
            "order": 0,
            "chartConfig": _valid_dataset_chart(
                chartType="bar",
                dimensions=[{"field": "x"}],
                metrics=[{"field": "y"}],
            ),
        }],
        "globalFilters": [],
    }
    updated = update_layout(db_session, out.id, layout)
    layout_json = updated.layout_json.model_dump(by_alias=True, mode="json")
    assert layout_json["widgets"][0]["chartConfig"]["chartType"] == "bar"
    got = get_dashboard(db_session, out.id)
    got_layout = got.layout_json.model_dump(by_alias=True, mode="json")
    assert got_layout["widgets"][0]["title"] == "T"


def test_chart_view_missing_sql():
    """T-VIZ-R28-001-11: sql mode → CHART_DATASET_REQUIRED（出图仅 Dataset）。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "table",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "sql",
                "sql": "SELECT 1",
            }
        )
    assert exc.value.code == "CHART_DATASET_REQUIRED"


def test_chart_view_missing_series():
    """T-VIZ-R28-001-12: line 缺 metrics → CHART_MISSING_SERIES。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            _valid_dataset_chart(
                chartType="line",
                dimensions=[{"field": "x"}],
                metrics=[],
            )
        )
    assert exc.value.code == "CHART_MISSING_SERIES"


def test_chart_view_table_mode():
    """T-VIZ-R28-001-13: table mode → CHART_DATASET_REQUIRED。"""
    with pytest.raises(ChartViewError) as exc:
        validate_chart_view_config(
            {
                "chartType": "table",
                "dataSourceId": str(uuid.uuid4()),
                "mode": "table",
                "schema": "public",
                "table": "orders",
            }
        )
    assert exc.value.code == "CHART_DATASET_REQUIRED"


def test_dashboard_auto_slug(client, auth_headers):
    """T-DASH-R28-001-08: 省略 slug 自动生成。"""
    resp = client.post(
        "/api/v1/dashboards",
        json={"name": "Auto Slug Board"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["slug"]


def test_dashboard_layout_empty_widgets(client, auth_headers):
    """T-DASH-R28-001-09: 空 widgets layout 合法。"""
    created = client.post(
        "/api/v1/dashboards",
        json={"name": "Empty", "slug": "empty-layout"},
        headers=auth_headers,
    )
    dash_id = created.json()["id"]
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        json={"layoutJson": {"version": 1, "widgets": [], "globalFilters": []}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["layoutJson"]["widgets"] == []


def test_create_dashboard_with_description(db_session, auth_user_id):
    """T-DASH-R28-001-10: 创建含 description。"""
    out = create_dashboard(
        db_session,
        name="Desc",
        slug="with-desc",
        description="备注",
        created_by=auth_user_id,
    )
    assert out.description == "备注"
