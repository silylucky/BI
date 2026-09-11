"""M-FINAL F-F/F-G 批次 1 r249 — NFR-008 + CONN-023~026。"""
from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from jwt_auth import AUTH

from app.core.config import get_settings
from app.core.nfr.deployment_report import (
    build_deployment_acceptance_report,
    probe_deployment_report_budget_ms,
)
from app.datasources.dialects.rest_api import RestApiConnector, probe_readonly_fetch
from app.datasources.dialects.csv_file import CsvFileConnector
from app.datasources.dialects.excel import ExcelConnector
from app.datasources.dialects.db2 import Db2Connector
from app.datasources.dialects.impala import ImpalaConnector
from app.datasources.registry import export_type_catalog
from app.main import app

_R249_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_ff_fg_r249?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]

MOCK_COMPOSE_CLEAN = """
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
"""

MOCK_COMPOSE_SUPERSET = """
services:
  postgres:
    image: postgres:16
  superset:
    image: apache-superset:latest
"""

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="module", autouse=True)
def r249_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R249_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- NFR-008 ---


def test_nfr_r249_008_01_deployment_report_accepted_with_compose(client: TestClient):
    """T-NFR-R249-008-01: 默认 accepted，含 composeServices 非空。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_CLEAN,
    ):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["overallAcceptance"] == "accepted"
    assert body["schemaVersion"] == "1.0"
    assert len(body["composeServices"]) >= 1


def test_nfr_r249_008_02_forbidden_compose_rejected(client: TestClient):
    """T-NFR-R249-008-02: mock compose 含 superset → forbiddenComposeHits 非空，rejected。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_SUPERSET,
    ):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    body = resp.json()
    assert body["forbiddenComposeHits"]
    assert body["overallAcceptance"] == "rejected"


def test_nfr_r249_008_03_forbidden_always_rejected(client: TestClient):
    """T-NFR-R249-008-03: forbidden hit → rejected（无 permissive）。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_SUPERSET,
    ):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    assert resp.json()["overallAcceptance"] == "rejected"


def test_nfr_r249_008_04_markdown_format(client: TestClient):
    """T-NFR-R249-008-04: format=markdown 200 text/markdown 含 ## 零第三方 BI。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_CLEAN,
    ):
        resp = client.get(
            "/api/v1/nfr/runtime-compliance/deployment-report?format=markdown",
            headers=AUTH,
        )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers.get("content-type", "")
    assert "## 零第三方 BI" in resp.text


def test_nfr_r249_008_05_budget_ms():
    """T-NFR-R249-008-05: probe_deployment_report_budget_ms ≤ 100。"""
    with patch(
        "app.core.nfr.deployment_report._read_compose_text",
        return_value=MOCK_COMPOSE_CLEAN,
    ):
        elapsed = probe_deployment_report_budget_ms()
    assert elapsed <= 100.0


def test_nfr_r249_008_06_strict_assert_503(client: TestClient):
    """T-NFR-R249-008-06: POST assert 违规 → 503 NFR_RUNTIME_VIOLATION。"""
    import sys

    with patch.dict(sys.modules, {"superset": object()}):
        resp = client.post("/api/v1/nfr/runtime-compliance/assert", headers=AUTH)
    assert resp.status_code == 503
    assert resp.json()["code"] == "NFR_RUNTIME_VIOLATION"


# --- CONN-023 REST API ---


def test_conn_r249_023_01_types_catalog():
    """T-CONN-R249-023-01: export_type_catalog 含 rest_api category=api。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "rest_api" in types
    assert types["rest_api"]["category"] == "api"
    assert "REST API" in types["rest_api"]["displayName"]


def test_conn_r249_023_02_http_types_endpoint(client: TestClient):
    """T-CONN-R249-023-02: GET /datasources/types 含 REST API。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    names = [i["displayName"] for i in resp.json()["items"]]
    assert any("REST API" in n for n in names)


@patch("httpx.Client")
def test_conn_r249_023_03_test_connection_ok(mock_client_cls):
    """T-CONN-R249-023-03: mock httpx 2xx → test_connection ok。"""
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RestApiConnector().test_connection(
        host="https://api.example.com", port=443, database="/health",
        username="", password="", timeout_sec=5.0,
    )
    assert result.ok is True


@patch("httpx.Client")
def test_conn_r249_023_04_auth_failed(mock_client_cls):
    """T-CONN-R249-023-04: 401 → REST_API_AUTH_FAILED。"""
    mock_resp = MagicMock(status_code=401, is_success=False)
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    result = RestApiConnector().test_connection(
        host="https://api.example.com", port=443, database="/",
        username="u", password="p", timeout_sec=5.0,
    )
    assert result.ok is False
    assert result.code == "REST_API_AUTH_FAILED"


@patch("httpx.Client")
def test_conn_r249_023_05_execute_native_query(mock_client_cls):
    """T-CONN-R249-023-05: execute_native_query mock JSON 返回 columns/rows。"""
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_resp.json.return_value = {"items": [{"id": 1, "name": "a"}]}
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.request.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    cols, rows, truncated = RestApiConnector().execute_native_query(
        mock_client, body={"path": "/items", "method": "GET", "jsonPath": "items"},
        limit=10, database="/",
    )
    assert cols
    assert rows
    assert truncated is False


def test_conn_r249_023_06_routing_mode_native(client: TestClient):
    """T-CONN-R249-023-06: routing-modes rest_api mode=native。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("rest_api") == "native"


@patch("httpx.Client")
def test_conn_r249_023_07_http_test_no_password(mock_client_cls, client: TestClient):
    """T-CONN-R249-023-07: POST /datasources/test 响应无 password。"""
    mock_resp = MagicMock(status_code=200, is_success=True)
    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client
    secret = "rest_secret_xyz"
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "rest_api",
            "name": "api-r249",
            "code": f"api-{uuid.uuid4().hex[:8]}",
            "host": "https://api.example.com",
            "port": 443,
            "database": "/health",
            "username": "u",
            "password": secret,
        },
    )
    assert resp.status_code == 200
    assert secret not in json.dumps(resp.json())


# --- CONN-024 Excel/CSV ---


def test_conn_r249_024_01_types_file_category():
    """T-CONN-R249-024-01: types 含 excel 与 csv category=file。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["excel"]["category"] == "file"
    assert types["csv"]["category"] == "file"


def test_conn_r249_024_02_excel_list_tables():
    """T-CONN-R249-024-02: fixture xlsx → list_tables 含 Sheet1。"""
    xlsx = FIXTURES / "sample.xlsx"
    conn = ExcelConnector().open_connection(host=str(xlsx), port=1, database="", username="", password="")
    tables = ExcelConnector().list_tables(conn, "workbook")
    names = [t.name for t in tables]
    assert "Sheet1" in names


def test_conn_r249_024_03_csv_list_columns():
    """T-CONN-R249-024-03: fixture csv → list_columns 非空。"""
    csv_path = FIXTURES / "sample.csv"
    conn = CsvFileConnector().open_connection(host=str(csv_path), port=1, database="", username="", password="")
    cols = CsvFileConnector().list_columns(conn, "file", "data")
    assert len(cols) >= 2


def test_conn_r249_024_04_traversal_denied():
    """T-CONN-R249-024-04: .. 路径 → FILE_NOT_FOUND 或 traversal。"""
    result = ExcelConnector().test_connection(
        host="../etc/passwd", port=1, database="", username="", password="",
    )
    assert result.ok is False
    assert result.code in {"FILE_NOT_FOUND", "FILE_PATH_TRAVERSAL"}


def test_conn_r249_024_05_csv_native_query():
    """T-CONN-R249-024-05: execute_native_query csv 至少 1 行。"""
    csv_path = FIXTURES / "sample.csv"
    conn = CsvFileConnector().open_connection(host=str(csv_path), port=1, database="", username="", password="")
    cols, rows, _ = CsvFileConnector().execute_native_query(conn, body={"table": "data"}, limit=10)
    assert cols
    assert len(rows) >= 1


def test_conn_r249_024_06_routing_native(client: TestClient):
    """T-CONN-R249-024-06: excel/csv routing mode=native。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("excel") == "native"
    assert modes.get("csv") == "native"


# --- CONN-025 Db2 ---


def test_conn_r249_025_01_types_db2():
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["db2"]["category"] == "relational"


@patch("app.datasources.dialects.db2.Db2Connector.open_connection")
def test_conn_r249_025_02_probe_readonly(mock_open):
    conn = MagicMock()
    mock_open.return_value = conn
    assert Db2Connector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once()


@patch("app.datasources.dialects.db2.Db2Connector.open_connection")
def test_conn_r249_025_03_auth_failed(mock_open, client: TestClient):
    mock_open.side_effect = Exception("SQL30082N Security processing failed")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "db2",
            "name": "db2-r249",
            "code": f"db2-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 50000,
            "database": "SAMPLE",
            "username": "u",
            "password": "db2_secret",
        },
    )
    assert resp.status_code == 200
    assert resp.json().get("code") == "DB2_AUTH_FAILED" or "DB2_AUTH_FAILED" in resp.text


def test_conn_r249_025_04_readonly_guard(client: TestClient):
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "db2", "sql": "SELECT 1 FROM SYSIBM.SYSDUMMY1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@patch("app.datasources.dialects.db2.Db2Connector.open_connection")
def test_conn_r249_025_05_no_password(mock_open, client: TestClient):
    mock_open.side_effect = Exception("auth fail")
    secret = "db2_pwd_xyz"
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "db2", "name": "d", "code": f"d-{uuid.uuid4().hex[:8]}",
            "host": "h", "port": 50000, "database": "SAMPLE", "username": "u", "password": secret,
        },
    )
    assert secret not in json.dumps(resp.json())


# --- CONN-026 Impala ---


def test_conn_r249_026_01_types_impala():
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["impala"]["category"] == "lake"


@patch("app.datasources.dialects.impala.ImpalaConnector.open_connection")
def test_conn_r249_026_02_probe(mock_open):
    conn = MagicMock()
    mock_open.return_value = conn
    assert ImpalaConnector().probe_readonly_sql(conn) is True


@patch("app.datasources.dialects.impala.ImpalaConnector.open_connection")
def test_conn_r249_026_03_unknown_database(mock_open):
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value = cur
    cur.execute.side_effect = Exception("Database does not exist: missing_db")
    mock_open.return_value = conn
    result = ImpalaConnector().test_connection(
        host="127.0.0.1", port=21050, database="missing_db", username="", password="",
    )
    assert result.ok is False
    assert result.code == "IMPALA_UNKNOWN_DATABASE"


def test_conn_r249_026_04_empty_schema_tables():
    conn = MagicMock()
    assert ImpalaConnector().list_tables(conn, "") == []


def test_conn_r249_026_05_routing_sql(client: TestClient):
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes.get("impala") == "sql"


def test_link_r249_types_count_includes_four_new():
    """LINK: types 总数较 r248 增四型。"""
    types = export_type_catalog()
    new_types = {"rest_api", "excel", "csv", "db2", "impala"}
    present = {t["type"] for t in types}
    assert new_types.issubset(present)
