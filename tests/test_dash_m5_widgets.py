"""M5 DASH-003 — 四类扩展 widget registry + render-spec."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.viz.builtin import register_builtin_chart_types
from jwt_auth import AUTH

M5_TYPES = ("map", "heatmap", "kpi", "timeline")


@pytest.fixture(scope="module", autouse=True)
def _register_builtins():
    register_builtin_chart_types()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_dash_003_01_catalog_includes_m5_types(client: TestClient):
    resp = client.get("/api/v1/charts/types", headers=AUTH)
    assert resp.status_code == 200
    types = {item["type"] for item in resp.json()}
    for t in M5_TYPES:
        assert t in types, f"missing {t} in catalog"


@pytest.mark.parametrize(
    "chart_type,sql,dims,metrics,expected_engine",
    [
        ("map", "SELECT '北京' AS region, 100 AS value", ["region"], ["value"], "echarts"),
        ("heatmap", "SELECT 'A' AS x, '1' AS y, 10 AS v", ["x", "y"], ["v"], "echarts"),
        ("kpi", "SELECT 1280 AS total, 12.5 AS rate", [], ["total", "rate"], "kpi"),
        ("timeline", "SELECT '2026-01-01' AS t, 1 AS v", ["t"], ["v"], "echarts"),
    ],
)
def test_dash_003_02_render_spec(
    client: TestClient, chart_type, sql, dims, metrics, expected_engine,
):
    body = {
        "chartType": chart_type,
        "mode": "sql",
        "dataSourceId": "00000000-0000-4000-8000-000000000010",
        "sql": sql,
        "dimensions": [{"field": d} for d in dims],
        "metrics": [{"field": m} for m in metrics],
    }
    resp = client.post("/api/v1/charts/render-spec", headers=AUTH, json=body)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["engine"] == expected_engine
    assert data["chartType"] == chart_type


def test_dash_003_05_execute_chain_sql_mode(client: TestClient):
    """不经 Dataset：chartConfig sql 模式可走 query execute（mock 数据源存在时 200/422 均可断言结构）。"""
    body = {
        "chartType": "kpi",
        "mode": "sql",
        "dataSourceId": "00000000-0000-4000-8000-000000000099",
        "sql": "SELECT 1 AS total",
        "dimensions": [],
        "metrics": [{"field": "total"}],
    }
    resp = client.post("/api/v1/charts/render-spec", headers=AUTH, json=body)
    assert resp.status_code == 200
    assert resp.json()["source"]["mode"] == "sql"
