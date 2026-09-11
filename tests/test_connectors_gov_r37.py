"""M11 关系型/OLAP 连接器 companion 质量推分 r37 — CONN-004/008/005/003/007."""
from __future__ import annotations

import os
import time
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pymssql
import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.base import ColumnInfo
from app.datasources.dialects.clickhouse import CLICKHOUSE_MAX_COLUMNS, ClickhouseConnector
from app.datasources.dialects.doris import DORIS_MAX_COLUMNS, DorisConnector
from app.datasources.dialects.hive import HIVE_MAX_COLUMNS, HiveConnector
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.oracle import ORACLE_MAX_COLUMNS, OracleConnector
from app.datasources.dialects.sqlserver import SQLSERVER_MAX_COLUMNS, SqlserverConnector
from app.datasources.models import get_meta_session
from app.datasources.registry import export_type_catalog
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app
from app.query.dialects import get_sql_dialect
from jwt_auth import AUTH, jwt_auth_headers

_R37_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r37?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r37_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R37_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.themes.models  # noqa: F401
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


@pytest.fixture
def client():
    return TestClient(app)


def _create_typed_ds(ds_type: str, name_suffix: str | None = None):
    suffix = name_suffix or uuid.uuid4().hex[:8]
    session = get_meta_session()
    try:
        defaults = {
            "mysql": dict(port=3306),
            "doris": dict(port=9030),
            "hive": dict(port=10000, database="default"),
            "clickhouse": dict(port=8123, database="default"),
            "sqlserver": dict(port=1433, database="master"),
            "oracle": dict(port=1521, database="ORCL"),
        }
        extra = defaults.get(ds_type, {})
        return create_data_source(
            session,
            DataSourceCreate(
                name=f"{ds_type}-{suffix}",
                code=f"{ds_type}-{suffix}",
                type=ds_type,
                host="127.0.0.1",
                port=extra.get("port", 5432),
                database=extra.get("database", "test"),
                username="user",
                password="secret",
            ),
        )
    finally:
        session.close()


def test_r37_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None


# --- CONN-004 Oracle ---


@patch("oracledb.connect")
def test_oracle_unknown_service_r37(mock_connect):
    """T-CONN-R37-004-01: mock ORA-12505 → ORACLE_UNKNOWN_SERVICE。"""
    mock_connect.side_effect = Exception("ORA-12505: TNS:listener does not currently know of SID")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert result.ok is False
    assert result.code == "ORACLE_UNKNOWN_SERVICE"


@patch("oracledb.connect")
def test_oracle_timeout_r37(mock_connect):
    """T-CONN-R37-004-02: mock timeout → ORACLE_TIMEOUT。"""
    mock_connect.side_effect = Exception("ORA-12170: TNS:Connect timeout occurred")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert result.ok is False
    assert result.code == "ORACLE_TIMEOUT"


@patch("oracledb.connect")
def test_oracle_multi_owner_schemas_r37(mock_connect):
    """T-CONN-R37-004-03: mock 多 owner list_schemas 含 HR 不含 SYS。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("HR",), ("APP",), ("SYS",), ("SYSTEM",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    names = {s.name for s in connector.list_schemas(connection)}
    assert "HR" in names
    assert "APP" in names
    assert "SYS" not in names
    assert "SYSTEM" not in names


@patch("oracledb.connect")
def test_oracle_unknown_owner_tables_r37(mock_connect):
    """T-CONN-R37-004-04: mock 未知 owner list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert connector.list_tables(connection, "UNKNOWN_OWNER") == []


@patch("oracledb.connect")
def test_oracle_columns_limit_r37(mock_connect):
    """T-CONN-R37-004-05: mock 600 列 → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    rows = [(f"COL_{i}", "VARCHAR2", "Y") for i in range(600)]
    cursor.fetchall.return_value = rows
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    cols = connector.list_columns(connection, "HR", "EMPLOYEES")
    assert len(cols) == ORACLE_MAX_COLUMNS == 500
    assert cols[0].name == "COL_0"
    assert cols[-1].name == "COL_499"


def test_oracle_types_catalog_r37():
    """T-CONN-R37-004-06: types catalog oracle category=relational schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["oracle"]["category"] == "relational"
    assert "schema_browser" in types["oracle"]["capabilities"]
    assert types["oracle"]["displayName"]


@patch("oracledb.connect")
def test_oracle_http_auth_failed_r37(mock_connect, client):
    """T-CONN-R37-004-07: HTTP POST test mock ORA-01017 → 200 ok=false ORACLE_AUTH_FAILED traceId。"""
    mock_connect.side_effect = Exception("ORA-01017: invalid username/password")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oracle",
            "name": "ora-test",
            "code": f"ora-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 1521,
            "database": "ORCL",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "ORACLE_AUTH_FAILED"
    assert body.get("traceId")


# --- CONN-008 Doris ---


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_unknown_database_r37(mock_connect):
    """T-CONN-R37-008-01: mock 1049 → DORIS_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="missing", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "DORIS_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_timeout_r37(mock_connect):
    """T-CONN-R37-008-02: mock 2013 → DORIS_TIMEOUT。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2013, "Lost connection: timeout")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "DORIS_TIMEOUT"


def test_doris_columns_limit_r37():
    """T-CONN-R37-008-03: mock 600 列 → list_columns 返回 500。"""
    connector = DorisConnector()
    connector._inner.list_columns = MagicMock(
        return_value=[
            ColumnInfo(name=f"col_{i}", data_type="varchar", nullable=True) for i in range(600)
        ]
    )
    cols = connector.list_columns(MagicMock(), "db", "wide_tbl")
    assert len(cols) == DORIS_MAX_COLUMNS == 500


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_empty_schemas_r37(mock_connect):
    """T-CONN-R37-008-04: mock 仅系统库 list_schemas → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("information_schema",), ("mysql",)]
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = DorisConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_http_conn_refused_r37(mock_connect, client):
    """T-CONN-R37-008-05: HTTP POST test mock 2003 → 200 ok=false DORIS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "doris",
            "name": "doris-test",
            "code": f"doris-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "DORIS_CONN_REFUSED"
    assert body.get("traceId")


def test_doris_metadata_tables_missing_schema_400_r37(client):
    """T-CONN-R37-008-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("doris")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


# --- CONN-005 SQL Server ---


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_timeout_r37(mock_connect):
    """T-CONN-R37-005-01: mock 20002 → SQLSERVER_TIMEOUT。"""
    mock_connect.side_effect = pymssql.OperationalError(20002, b"timeout expired")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_TIMEOUT"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_ssl_error_r37(mock_connect):
    """T-CONN-R37-005-02: mock ssl error message → SQLSERVER_SSL_ERROR。"""
    mock_connect.side_effect = pymssql.OperationalError(0, b"SSL Provider: certificate verify failed")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_SSL_ERROR"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_dbo_and_custom_schemas_r37(mock_connect):
    """T-CONN-R37-005-03: mock list_schemas 含 dbo 与 sales。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("dbo",), ("sales",), ("guest",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    names = {s.name for s in connector.list_schemas(connection)}
    assert "dbo" in names
    assert "sales" in names


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_empty_schemas_r37(mock_connect):
    """T-CONN-R37-005-04: mock 空库 list_schemas → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_unknown_schema_tables_r37(mock_connect):
    """T-CONN-R37-005-05: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    assert connector.list_tables(connection, "missing_schema") == []


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_columns_limit_r37(mock_connect):
    """T-CONN-R37-005-06: mock 600 列 → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    rows = [(f"col_{i}", "varchar", "YES") for i in range(600)]
    cursor.fetchall.return_value = rows
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    cols = connector.list_columns(connection, "dbo", "wide_tbl")
    assert len(cols) == SQLSERVER_MAX_COLUMNS == 500


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_ssl_disabled_encrypt_false_r37(mock_connect):
    """T-CONN-R37-005-07: ssl_mode=disabled → encrypt=False。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    SqlserverConnector().test_connection(
        host="127.0.0.1",
        port=1433,
        database="master",
        username="sa",
        password="pwd",
        ssl_mode="disabled",
    )
    _, kwargs = mock_connect.call_args
    assert kwargs.get("encrypt") is False


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_http_auth_failed_r37(mock_connect, client):
    """T-CONN-R37-005-08: HTTP POST test mock 18456 → 200 ok=false SQLSERVER_AUTH_FAILED。"""
    mock_connect.side_effect = pymssql.OperationalError(18456, b"Login failed for user")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "sqlserver",
            "name": "mssql-test",
            "code": f"mssql-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 1433,
            "database": "master",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "SQLSERVER_AUTH_FAILED"
    assert body.get("traceId")


# --- CONN-003 Hive ---


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_unknown_database_r37(mock_connect):
    """T-CONN-R37-003-01: mock unknown database → HIVE_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = Exception("Database X does not exist")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="X", username="hive", password=""
    )
    assert result.ok is False
    assert result.code == "HIVE_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_empty_schemas_r37(mock_connect):
    """T-CONN-R37-003-02: mock 仅 information_schema → list_schemas []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("information_schema",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_column_types_smoke_r37(mock_connect):
    """T-CONN-R37-003-03: mock DESCRIBE 类型枚举 ≥3 种 data_type。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("id", "bigint", ""),
        ("name", "string", ""),
        ("amount", "double", ""),
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    cols = connector.list_columns(connection, "default", "orders")
    dtypes = {c.data_type for c in cols}
    assert len(dtypes) >= 3


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_columns_limit_r37(mock_connect):
    """T-CONN-R37-003-04: mock 600 列 DESCRIBE → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [(f"col_{i}", "string", "") for i in range(600)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    cols = connector.list_columns(connection, "default", "wide_tbl")
    assert len(cols) == HIVE_MAX_COLUMNS == 500


def test_hive_types_catalog_r37():
    """T-CONN-R37-003-05: types catalog hive category=lake。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["hive"]["category"] == "lake"
    assert types["hive"]["displayName"]


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_http_auth_failed_r37(mock_connect, client):
    """T-CONN-R37-003-06: HTTP POST test mock auth fail → 200 ok=false HIVE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Authentication failed: invalid credentials")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "hive",
            "name": "hive-test",
            "code": f"hive-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 10000,
            "database": "default",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "HIVE_AUTH_FAILED"
    assert body.get("traceId")


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.hive.HiveConnector.list_schemas")
def test_hive_metadata_schemas_502_r37(mock_list, mock_pool, client):
    """T-CONN-R37-003-07: HTTP GET schemas list_schemas 失败 → 502 METADATA_CONNECTION_FAILED。"""
    mock_list.side_effect = Exception("connection failed")

    @contextmanager
    def _cm(*a, **k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    ds = _create_typed_ds("hive")
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"
    assert "password" not in resp.text.lower()


# --- CONN-007 ClickHouse ---


@patch("clickhouse_connect.get_client")
def test_clickhouse_timeout_r37(mock_get_client):
    """T-CONN-R37-007-01: mock timeout → CLICKHOUSE_TIMEOUT。"""
    mock_get_client.side_effect = Exception("Connection timed out")
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert result.ok is False
    assert result.code == "CLICKHOUSE_TIMEOUT"


@patch("clickhouse_connect.get_client")
def test_clickhouse_unknown_table_columns_r37(mock_get_client):
    """T-CONN-R37-007-02: mock 未知 table list_columns → []。"""
    client = MagicMock()
    client.query.return_value.result_rows = []
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert connector.list_columns(connection, "default", "missing_table") == []


@patch("clickhouse_connect.get_client")
def test_clickhouse_columns_limit_perf_r37(mock_get_client):
    """T-CONN-R37-007-03: mock 600 列 limit + perf <0.1s。"""
    rows = [(f"col_{i}", "String") for i in range(600)]
    client = MagicMock()
    client.query.return_value.result_rows = rows
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    started = time.perf_counter()
    cols = connector.list_columns(connection, "default", "wide_tbl")
    elapsed = time.perf_counter() - started
    assert len(cols) == CLICKHOUSE_MAX_COLUMNS == 500
    assert elapsed < 0.1


def test_clickhouse_types_catalog_r37():
    """T-CONN-R37-007-04: types catalog clickhouse category=olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["clickhouse"]["category"] == "olap"
    assert types["clickhouse"]["displayName"]


@patch("clickhouse_connect.get_client")
def test_clickhouse_http_conn_refused_r37(mock_get_client, client):
    """T-CONN-R37-007-05: HTTP POST test mock refused → 200 ok=false CLICKHOUSE_CONN_REFUSED。"""
    mock_get_client.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "clickhouse",
            "name": "ch-test",
            "code": f"ch-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8123,
            "database": "default",
            "username": "default",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "CLICKHOUSE_CONN_REFUSED"
    assert body.get("traceId")


def test_clickhouse_metadata_tables_missing_schema_400_r37(client):
    """T-CONN-R37-007-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("clickhouse")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


def test_clickhouse_sql_dialect_regression_r37():
    """T-CONN-R37-007-07: get_sql_dialect('clickhouse') connector_type 回归。"""
    dialect = get_sql_dialect("clickhouse")
    assert dialect.connector_type == "clickhouse"


# --- T-REG-R37 Registry ---


def test_registry_five_types_display_fields_r37():
    """T-REG-R37-01: export_type_catalog 五新 type 均含 displayName/category/capabilities。"""
    types = {item["type"]: item for item in export_type_catalog()}
    for t in ("hive", "clickhouse", "sqlserver", "doris", "oracle"):
        assert t in types
        entry = types[t]
        assert entry.get("displayName")
        assert entry.get("category")
        assert entry.get("capabilities")


def test_registry_create_five_types_visible_r37(client):
    """T-REG-R37-02: 创建五 type 各一 DataSource → GET /types 均可见。"""
    created_types = []
    for ds_type, patch_target in [
        ("hive", "app.datasources.dialects.hive.HiveConnector._connect"),
        ("clickhouse", "clickhouse_connect.get_client"),
        ("sqlserver", "app.datasources.dialects.sqlserver.pymssql.connect"),
        ("doris", "app.datasources.dialects.mysql.pymysql.connect"),
        ("oracle", "oracledb.connect"),
    ]:
        with patch(patch_target) as mock_conn:
            if ds_type == "clickhouse":
                m = MagicMock()
                m.command.return_value = 1
                mock_conn.return_value = m
            elif ds_type == "hive":
                m = MagicMock()
                m.cursor.return_value = MagicMock()
                mock_conn.return_value = m
            else:
                mock_conn.return_value = MagicMock()
            suffix = uuid.uuid4().hex[:8]
            resp = client.post(
                "/api/v1/datasources",
                headers=AUTH,
                json={
                    "type": ds_type,
                    "name": f"{ds_type}-{suffix}",
                    "code": f"{ds_type}-{suffix}",
                    "host": "127.0.0.1",
                    "port": {"hive": 10000, "clickhouse": 8123, "sqlserver": 1433, "doris": 9030, "oracle": 1521}[ds_type],
                    "database": "default" if ds_type in ("hive", "clickhouse") else ("master" if ds_type == "sqlserver" else ("ORCL" if ds_type == "oracle" else "test")),
                    "username": "user",
                    "password": "secret",
                },
            )
            assert resp.status_code in (200, 201)
            created_types.append(ds_type)
    types_resp = client.get("/api/v1/datasources/types", headers=AUTH)
    type_names = {item["type"] for item in types_resp.json()["items"]}
    for t in created_types:
        assert t in type_names


def test_r36_suite_import_no_conflict_r37():
    """T-REG-R37-03: r36 test_connectors_gov_r36 模块可导入无冲突。"""
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "test_connectors_gov_r36",
        Path(__file__).resolve().parent / "test_connectors_gov_r36.py",
    )
    assert spec is not None and spec.loader is not None
    r36_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r36_mod)
    assert hasattr(r36_mod, "test_registry_ten_types_r36")


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_no_regression_r37(mock_connect):
    """T-REG-R37-04: mysql test_connection mock 成功不回归。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = MysqlConnector().test_connection(
        host="127.0.0.1", port=3306, database="test", username="root", password=""
    )
    assert result.ok is True
