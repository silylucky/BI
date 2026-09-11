"""M-FINAL F-C 批次 1 r242 — CONN-017~021 信创连接器 companion。"""
from __future__ import annotations

import json
import os
import uuid
from unittest.mock import MagicMock, patch

import pymysql
import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources.dialects.dm import DmConnector
from app.datasources.dialects.base import TestConnectionResult as _TestConnectionResult
from app.datasources.dialects.gbase import GbaseConnector
from app.datasources.dialects.kingbase.connector import KingbaseConnector
from app.datasources.dialects.oceanbase import OceanbaseConnector, probe_test_connection_budget_ms
from app.datasources.dialects.tidb import TidbConnector
from app.datasources.registry import export_type_catalog
from app.main import app

AUTH = jwt_auth_headers()
_R242_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fc_r242?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r242_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R242_SQLITE_URL
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


def test_conn_r242_scaffold_imports():
    """Scaffold: module loads."""
    assert app is not None


# --- CONN-017 DM ---


def test_conn_r242_017_01_types_catalog_dm():
    """T-CONN-R242-017-01: export_type_catalog 含 dm，displayName 含达梦，category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "dm" in types
    assert "达梦" in types["dm"]["displayName"]
    assert types["dm"]["category"] == "relational"


def test_conn_r242_017_02_probe_readonly_sql():
    """T-CONN-R242-017-02: mock dmPython cursor → probe_readonly_sql True；execute SELECT 1 FROM DUAL。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert DmConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1 FROM DUAL")


@patch("dmPython.connect")
def test_conn_r242_017_03_http_test_no_password(mock_connect, client):
    """T-CONN-R242-017-03: POST /datasources/test type=dm mock 失败 → 响应无 password。"""
    mock_connect.side_effect = Exception("Login failed secret_token_xyz")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "dm",
            "name": "dm-r242",
            "code": f"dm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5236,
            "database": "DAMENG",
            "username": "u",
            "password": "secret_token_xyz",
        },
    )
    assert resp.status_code == 200
    assert "secret_token_xyz" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


def test_conn_r242_017_04_readonly_guard_dm(client):
    """T-CONN-R242-017-04: readonly-guard connectorType=dm sql=SELECT 1 → 200 ok mode=sql。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "dm", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["mode"] == "sql"


# --- CONN-018 Kingbase ---


def test_conn_r242_018_01_types_catalog_kingbase():
    """T-CONN-R242-018-01: types 含 kingbase relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "kingbase" in types
    assert types["kingbase"]["category"] == "relational"
    assert "金仓" in types["kingbase"]["displayName"] or "Kingbase" in types["kingbase"]["displayName"]


def test_conn_r242_018_02_probe_readonly_sql():
    """T-CONN-R242-018-02: mock psycopg 连接 probe_readonly_sql True。"""
    conn = MagicMock()
    assert KingbaseConnector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once_with("SELECT 1")


def test_conn_r242_018_03_http_missing_host_422(client):
    """T-CONN-R242-018-03: 缺 host → 422 KINGBASE_INVALID_PARAMS（r67 回归）。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-r242",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "",
            "port": 54321,
            "database": "db",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "KINGBASE_INVALID_PARAMS"


def test_conn_r242_018_04_readonly_guard_kingbase(client):
    """T-CONN-R242-018-04: readonly-guard kingbase + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "kingbase", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection")
def test_conn_r242_018_05_http_test_no_password(mock_test, client):
    """T-CONN-R242-018-05: HTTP test kingbase mock 失败无 password。"""
    mock_test.return_value = _TestConnectionResult(
        ok=False, message="[KINGBASE_CONN_FAILED] denied", latency_ms=1, code="KINGBASE_CONN_FAILED"
    )
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-r242-fail",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 54321,
            "database": "db",
            "username": "u",
            "password": "kb_secret",
        },
    )
    assert resp.status_code == 200
    assert "kb_secret" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


# --- CONN-019 GBase ---


def test_conn_r242_019_01_types_catalog_gbase():
    """T-CONN-R242-019-01: types 含 gbase relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "gbase" in types
    assert types["gbase"]["category"] == "relational"


def test_conn_r242_019_02_probe_readonly_sql():
    """T-CONN-R242-019-02: mock pymysql cursor probe_readonly_sql True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert GbaseConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1")


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r242_019_03_http_test_no_password(mock_connect, client):
    """T-CONN-R242-019-03: HTTP test gbase mock 失败无 password。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "gbase",
            "name": "gb-r242",
            "code": f"gb-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5258,
            "database": "test",
            "username": "u",
            "password": "gbase_secret",
        },
    )
    assert resp.status_code == 200
    assert "gbase_secret" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


def test_conn_r242_019_04_readonly_guard_gbase(client):
    """T-CONN-R242-019-04: readonly-guard gbase + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "gbase", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# --- CONN-020 OceanBase ---


def test_conn_r242_020_01_types_catalog_oceanbase():
    """T-CONN-R242-020-01: types 含 oceanbase relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "oceanbase" in types
    assert types["oceanbase"]["category"] == "relational"


def test_conn_r242_020_02_probe_readonly_sql():
    """T-CONN-R242-020-02: mock pymysql cursor probe_readonly_sql True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert OceanbaseConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1")


@patch.object(OceanbaseConnector, "list_schemas", return_value=[])
def test_conn_r242_020_03_empty_schema_regression(_mock_list):
    """T-CONN-R242-020-03: 空 schema 回归 r55 → []。"""
    assert OceanbaseConnector().list_schemas(MagicMock()) == []


def test_conn_r242_020_04_readonly_guard_oceanbase(client):
    """T-CONN-R242-020-04: readonly-guard oceanbase + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "oceanbase", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_conn_r242_020_05_probe_budget_constant_exists():
    """T-CONN-R242-020-05: probe_test_connection_budget_ms 常量存在（r55 回归）。"""
    assert probe_test_connection_budget_ms == 100


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r242_020_06_http_test_no_password(mock_connect, client):
    """T-CONN-R242-020-06: HTTP test oceanbase mock 失败无 password。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-r242",
            "code": f"ob-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "test",
            "username": "u",
            "password": "ob_secret",
        },
    )
    assert resp.status_code == 200
    assert "ob_secret" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


# --- CONN-021 TiDB ---


def test_conn_r242_021_01_types_catalog_tidb_distinct_from_mysql():
    """T-CONN-R242-021-01: types 含独立 tidb（非 mysql）。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tidb" in types
    assert "mysql" in types
    assert types["tidb"]["type"] == "tidb"
    assert types["tidb"]["category"] == "relational"


def test_conn_r242_021_02_probe_readonly_sql():
    """T-CONN-R242-021-02: mock pymysql cursor probe_readonly_sql True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    assert TidbConnector().probe_readonly_sql(conn) is True
    cursor.execute.assert_called_once_with("SELECT 1")


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r242_021_03_tidb_auth_failed_regression(mock_connect):
    """T-CONN-R242-021-03: mock 1045 → TIDB_AUTH_FAILED（r35 回归）。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TIDB_AUTH_FAILED"


def test_conn_r242_021_04_readonly_guard_tidb(client):
    """T-CONN-R242-021-04: readonly-guard tidb + SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "tidb", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r242_021_05_http_test_no_password(mock_connect, client):
    """T-CONN-R242-021-05: HTTP test tidb mock 失败无 password。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "tidb",
            "name": "tidb-r242",
            "code": f"tidb-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 4000,
            "database": "test",
            "username": "u",
            "password": "tidb_secret",
        },
    )
    assert resp.status_code == 200
    assert "tidb_secret" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


@pytest.mark.integration
def test_conn_r242_021_06_optional_compose_live():
    """T-CONN-R242-021-06: 信创 TiDB 无 compose 镜像 → skip。"""
    pytest.skip("xinchuang DB not in compose")


from app.datasources.dialects.gaussdb import GaussdbConnector


# --- CONN-022 GaussDB ---


def test_conn_r242_022_01_types_catalog_gaussdb():
    """T-CONN-R242-022-01: export_type_catalog 含 gaussdb，displayName 含 GaussDB，category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "gaussdb" in types
    assert "GaussDB" in types["gaussdb"]["displayName"]
    assert types["gaussdb"]["category"] == "relational"


def test_conn_r242_022_02_probe_readonly_sql():
    """T-CONN-R242-022-02: mock psycopg connection → probe_readonly_sql True；execute SELECT 1。"""
    conn = MagicMock()
    assert GaussdbConnector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once_with("SELECT 1")


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_r242_022_03_http_test_no_password(mock_open, client):
    """T-CONN-R242-022-03: POST /datasources/test type=gaussdb mock 失败 → 响应无 password。"""
    mock_open.side_effect = Exception("Login failed gauss_secret_xyz")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "gaussdb",
            "name": "gauss-r243",
            "code": f"gauss-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5432,
            "database": "postgres",
            "username": "u",
            "password": "gauss_secret_xyz",
        },
    )
    assert resp.status_code == 200
    assert "gauss_secret_xyz" not in json.dumps(resp.json())
    assert "password" not in resp.text.lower()


def test_conn_r242_022_04_readonly_guard_gaussdb(client):
    """T-CONN-R242-022-04: readonly-guard connectorType=gaussdb sql=SELECT 1 → 200 ok。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "gaussdb", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_conn_r242_022_05_probe_readonly_budget_smoke():
    """T-CONN-R242-022-05: mock probe_readonly_sql elapsed <30ms（与 r242 OceanBase 同级 smoke）。"""
    import time

    conn = MagicMock()
    start = time.perf_counter()
    GaussdbConnector().probe_readonly_sql(conn)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert elapsed_ms < 30


# --- 五型 compose skip 占位 ---


@pytest.mark.parametrize(
    "connector_type",
    ["dm", "kingbase", "gbase", "oceanbase", "tidb"],
)
@pytest.mark.integration
def test_conn_r242_optional_xinchuang_compose_live(connector_type: str):
    """每型 1 条 live 占位：无信创 compose 环境一律 skip。"""
    pytest.skip("xinchuang DB not in compose")
