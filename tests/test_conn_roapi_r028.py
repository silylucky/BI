"""CONN-028 RoAPI connector — registration, connectivity, native query smoke."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.datasources.dialects.errors import ROAPI_AUTH_FAILED
from app.datasources.dialects.roapi import RoapiConnector, probe_readonly_fetch
from app.datasources.dialects import roapi_support as support
from app.datasources.registry import export_type_catalog
from app.query.capabilities import NATIVE_OFFSET_TYPES, NATIVE_QUERY_CAPABLE
from app.query.schemas import QueryError
from jwt_auth import jwt_auth_headers
AUTH = jwt_auth_headers()


def test_conn_r028_01_types_catalog():
    """T-CONN-R028-01: export_type_catalog 含 roapi category=api。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "roapi" in types
    assert types["roapi"]["category"] == "api"
    assert "RoAPI" in types["roapi"]["displayName"]


def test_conn_r028_02_http_types_endpoint(client: TestClient):
    """T-CONN-R028-02: GET /datasources/types 含 RoAPI。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    names = [i["displayName"] for i in resp.json()["items"]]
    assert any("RoAPI" in n for n in names)


@patch("httpx.Client")
def test_conn_r028_03_test_connection_ok(mock_client_cls):
    """T-CONN-R028-03: mock httpx schema 2xx → test_connection ok。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"{}")
    mock_resp.json.return_value = {"demo_orders": {"fields": []}}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.request.return_value = mock_resp
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RoapiConnector().test_connection(
        host="http://127.0.0.1", port=8080, database="/api/schema",
        username="none", password="-", timeout_sec=5.0,
    )
    assert result.ok is True


@patch("httpx.Client")
def test_conn_r028_04_auth_failed(mock_client_cls):
    """T-CONN-R028-04: 401 → ROAPI_AUTH_FAILED。"""
    mock_resp = MagicMock(status_code=401, is_success=False, content=b"")
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.request.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RoapiConnector().test_connection(
        host="http://127.0.0.1", port=8080, database="/api/schema",
        username="bearer", password="secret", timeout_sec=5.0,
    )
    assert result.ok is False
    assert result.code == ROAPI_AUTH_FAILED


@patch("httpx.Client")
def test_conn_r028_05_execute_native_sql(mock_client_cls):
    """T-CONN-R028-05: execute_native_query SQL 返回 columns/rows。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"[]")
    mock_resp.json.return_value = [{"id": 1, "name": "alpha"}]
    mock_client = MagicMock()
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    cols, rows, truncated = RoapiConnector().execute_native_query(
        mock_client,
        body={"sql": "SELECT id, name FROM demo_orders"},
        limit=10,
    )
    assert cols == ["id", "name"]
    assert rows == [[1, "alpha"]]
    assert truncated is False


@patch("httpx.Client")
def test_conn_r028_06_list_tables_from_schema(mock_client_cls):
    """T-CONN-R028-06: list_tables 解析 /api/schema。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"{}")
    mock_resp.json.return_value = {
        "demo_orders": {"fields": [{"name": "id", "data_type": "Int64"}]},
    }
    mock_client = MagicMock()
    mock_client.request.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    tables = RoapiConnector().list_tables(mock_client, "roapi")
    assert [t.name for t in tables] == ["demo_orders"]


def test_conn_r028_07_routing_mode_native(client: TestClient):
    """T-CONN-R028-07: routing-modes roapi mode=native。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("roapi") == "native"


@patch("httpx.Client")
def test_conn_r028_08_http_test_no_password(mock_client_cls, client: TestClient):
    """T-CONN-R028-08: POST /datasources/test 响应无 password。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"{}")
    mock_resp.json.return_value = {}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.request.return_value = mock_resp
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    secret = "roapi_secret_xyz"
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "roapi",
            "name": "roapi-r028",
            "code": f"roapi-{uuid.uuid4().hex[:8]}",
            "host": "http://127.0.0.1",
            "port": 8080,
            "database": "/api/schema",
            "username": "bearer",
            "password": secret,
        },
    )
    assert resp.status_code == 200
    body = resp.text
    assert secret not in body


def test_conn_r028_09_capabilities_sets():
    assert "roapi" in NATIVE_QUERY_CAPABLE
    assert "roapi" in NATIVE_OFFSET_TYPES


def test_conn_r028_10_probe_readonly_fetch():
    client = MagicMock()
    client._vs_roapi_schema_path = "/api/schema"
    ok_resp = MagicMock(is_success=True)
    client.get.return_value = ok_resp
    assert probe_readonly_fetch(client) is True
    client.get.assert_called_once_with("/api/schema", timeout=5.0)


@patch("httpx.Client")
def test_conn_r028_11_custom_schema_path_test_connection(mock_client_cls):
    """T-CONN-R028-11: database 字段作为 Schema 探测路径。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"{}")
    mock_resp.json.return_value = {}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.request.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RoapiConnector().test_connection(
        host="http://127.0.0.1",
        port=8086,
        database="/custom/schema",
        username="none",
        password="-",
        timeout_sec=5.0,
    )
    assert result.ok is True
    mock_client.request.assert_called_with("GET", "/custom/schema")


def test_conn_r028_12_list_tables_uses_client_schema_path():
    """T-CONN-R028-12: list_tables 使用连接上的 schema 路径。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"{}")
    mock_resp.json.return_value = {"demo_orders": {"fields": []}}
    client = MagicMock()
    client._vs_roapi_schema_path = "/v2/schema"
    client.request.return_value = mock_resp
    tables = RoapiConnector().list_tables(client, "roapi")
    assert [t.name for t in tables] == ["demo_orders"]
    client.request.assert_called_with("GET", "/v2/schema")


def test_conn_r028_13_rejects_multi_statement_sql():
    """T-CONN-R028-13: 只读守卫拒绝多语句。"""
    client = MagicMock()
    with pytest.raises(QueryError) as exc:
        RoapiConnector().execute_native_query(
            client,
            body={"sql": "SELECT 1; SELECT 2"},
            limit=10,
        )
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_conn_r028_13b_rejects_drop_injection():
    """T-CONN-R028-13b: native 注入守卫拦截 DROP。"""
    client = MagicMock()
    with pytest.raises(QueryError) as exc:
        RoapiConnector().execute_native_query(
            client,
            body={"sql": "SELECT 1; DROP TABLE demo_orders"},
            limit=10,
        )
    assert exc.value.code == "QUERY_NATIVE_INJECTION_SUSPECT"


def test_conn_r028_14_rejects_write_prefix_sql():
    """T-CONN-R028-14: 只读守卫拒绝 INSERT。"""
    client = MagicMock()
    with pytest.raises(QueryError) as exc:
        RoapiConnector().execute_native_query(
            client,
            body={"sql": "INSERT INTO demo_orders VALUES (1, 'x', 1)"},
            limit=10,
        )
    assert exc.value.code == "QUERY_NOT_READONLY"


def test_conn_r028_15_list_columns_from_full_schema():
    """T-CONN-R028-15: list_columns 从 /api/schema 全量响应解析表字段。"""
    mock_resp = MagicMock(status_code=200, is_success=True, content=b"{}")
    mock_resp.json.return_value = {
        "demo_orders": {
            "fields": [
                {"name": "id", "data_type": "Int64"},
                {"name": "region", "data_type": "Utf8"},
            ],
        },
    }
    client = MagicMock()
    client._vs_roapi_schema_path = "/api/schema"
    client.request.return_value = mock_resp
    cols = RoapiConnector().list_columns(client, "roapi", "demo_orders")
    assert [c.name for c in cols] == ["id", "region"]
    client.request.assert_called_with("GET", "/api/schema")


def test_conn_r028_16_build_chart_sql_for_dataset():
    """T-CONN-R028-16: Dataset 图表 encoding 可为 roapi 生成 SQL。"""
    from app.query.config_store.schemas import DatasetQueryConfigPayload
    from app.query.dataset.chart_sql import build_chart_sql
    from app.query.dataset.schemas import ChartExecuteEncoding, ChartMetricEncoding

    payload = DatasetQueryConfigPayload(
        dataSourceId="00000000-0000-0000-0000-000000000001",
        connectorType="roapi",
        schema="roapi",
        table="demo_orders",
        columns=["order_date", "amount", "region"],
        conditions={"logic": "AND", "conditions": []},
        limit=1000,
        offset=0,
    )
    encoding = ChartExecuteEncoding(
        chartType="bar",
        dimensions=["order_date"],
        metrics=[ChartMetricEncoding(field="amount", agg="sum")],
        filters=[],
    )
    sql, _params = build_chart_sql(payload, encoding, computed_fields=[], limit=50, offset=0)
    assert '"demo_orders"' in sql or "demo_orders" in sql
    assert "roapi" not in sql.lower().split("from")[-1] or "demo_orders" in sql
    assert "SUM" in sql.upper()


def test_resolve_schema_path_defaults():
    assert support.resolve_schema_path(None) == "/api/schema"
    assert support.resolve_schema_path("api/schema") == "/api/schema"