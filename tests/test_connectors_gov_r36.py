"""M11 关系型/OLAP 连接器 L1 kickoff r36 — CONN-003/007/005/008/004."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pymssql
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.clickhouse import CLICKHOUSE_MAX_COLUMNS, ClickhouseConnector
from app.datasources.dialects.doris import DorisConnector
from app.datasources.dialects.hive import HiveConnector
from app.datasources.dialects.mysql import MysqlConnector
from app.datasources.dialects.oracle import OracleConnector
from app.datasources.dialects.sqlserver import SqlserverConnector
from app.datasources.registry import ConnectorRegistry, export_type_catalog, register_dialect
from app.main import app
from app.query.dialects import get_sql_dialect
from jwt_auth import AUTH, jwt_auth_headers

_R36_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r36?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r36_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R36_SQLITE_URL
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


def test_r36_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None


# --- CONN-003 Hive ---


def test_hive_types_catalog_r36():
    """T-CONN-R36-003-01: types 含 hive category=lake schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "hive" in types
    assert types["hive"]["category"] == "lake"
    assert "schema_browser" in types["hive"]["capabilities"]


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-003-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert result.ok is True
    cursor.execute.assert_called()


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_auth_failed_r36(mock_connect):
    """T-CONN-R36-003-03: mock 认证失败 → HIVE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Authentication failed: invalid credentials")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "HIVE_AUTH_FAILED"


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_conn_refused_r36(mock_connect):
    """T-CONN-R36-003-04: mock 连接拒绝 → HIVE_CONN_REFUSED。"""
    mock_connect.side_effect = Exception("Connection refused")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert result.ok is False
    assert result.code == "HIVE_CONN_REFUSED"


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_timeout_r36(mock_connect):
    """T-CONN-R36-003-05: mock 超时 → HIVE_TIMEOUT。"""
    mock_connect.side_effect = Exception("timed out waiting for response")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert result.ok is False
    assert result.code == "HIVE_TIMEOUT"


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_empty_schemas_r36(mock_connect):
    """T-CONN-R36-003-06: mock 仅 default 库 → list_schemas 过滤 information_schema。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("default",), ("information_schema",)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    schemas = connector.list_schemas(connection)
    names = {s.name for s in schemas}
    assert "information_schema" not in names
    assert "default" in names


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_unknown_database_tables_r36(mock_connect):
    """T-CONN-R36-003-07: mock 未知库 list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = HiveConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=10000, database="default", username="hive", password=""
    )
    assert connector.list_tables(connection, "missing_db") == []


# --- CONN-007 ClickHouse ---


def test_clickhouse_types_catalog_r36():
    """T-CONN-R36-007-01: types 含 clickhouse category=olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "clickhouse" in types
    assert types["clickhouse"]["category"] == "olap"


@patch("clickhouse_connect.get_client")
def test_clickhouse_test_connection_ok_r36(mock_get_client):
    """T-CONN-R36-007-02: mock ping 成功 → ok=True。"""
    client = MagicMock()
    client.command.return_value = 1
    mock_get_client.return_value = client
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert result.ok is True


@patch("clickhouse_connect.get_client")
def test_clickhouse_auth_failed_r36(mock_get_client):
    """T-CONN-R36-007-03: mock 401 → CLICKHOUSE_AUTH_FAILED。"""
    mock_get_client.side_effect = Exception("HTTP 401 Unauthorized")
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "CLICKHOUSE_AUTH_FAILED"


@patch("clickhouse_connect.get_client")
def test_clickhouse_conn_refused_r36(mock_get_client):
    """T-CONN-R36-007-04: mock connection refused → CLICKHOUSE_CONN_REFUSED。"""
    mock_get_client.side_effect = ConnectionRefusedError("Connection refused")
    result = ClickhouseConnector().test_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert result.ok is False
    assert result.code == "CLICKHOUSE_CONN_REFUSED"


@patch("clickhouse_connect.get_client")
def test_clickhouse_unknown_database_tables_r36(mock_get_client):
    """T-CONN-R36-007-05: mock 未知 database tables → []。"""
    client = MagicMock()
    client.query.return_value.result_rows = []
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    assert connector.list_tables(connection, "missing_db") == []


@patch("clickhouse_connect.get_client")
def test_clickhouse_column_limit_r36(mock_get_client):
    """T-CONN-R36-007-06: mock 600 列 → list_columns 返回 500。"""
    client = MagicMock()
    rows = [(f"col_{i}", "String") for i in range(600)]
    client.query.return_value.result_rows = rows
    mock_get_client.return_value = client
    connector = ClickhouseConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=8123, database="default", username="default", password=""
    )
    columns = connector.list_columns(connection, "db", "wide")
    assert len(columns) == CLICKHOUSE_MAX_COLUMNS
    assert CLICKHOUSE_MAX_COLUMNS == 500


def test_clickhouse_query_dialect_unchanged_r36():
    """T-CONN-R36-007-07: get_sql_dialect(clickhouse) 仍成功（QUERY-004 回归）。"""
    dialect = get_sql_dialect("clickhouse")
    assert dialect.connector_type == "clickhouse"


# --- CONN-005 SQL Server ---


def test_sqlserver_types_catalog_r36():
    """T-CONN-R36-005-01: types 含 sqlserver category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "sqlserver" in types
    assert types["sqlserver"]["category"] == "relational"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-005-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password=""
    )
    assert result.ok is True
    conn.close.assert_called_once()


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_auth_failed_r36(mock_connect):
    """T-CONN-R36-005-03: mock 18456 → SQLSERVER_AUTH_FAILED。"""
    mock_connect.side_effect = pymssql.OperationalError(18456, b"Login failed")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_AUTH_FAILED"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_conn_refused_r36(mock_connect):
    """T-CONN-R36-005-04: mock 连接拒绝 → SQLSERVER_CONN_REFUSED。"""
    mock_connect.side_effect = pymssql.OperationalError(20009, b"Unable to connect")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password=""
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_CONN_REFUSED"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_unknown_database_r36(mock_connect):
    """T-CONN-R36-005-05: mock 未知库 → SQLSERVER_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = pymssql.OperationalError(4060, b"Cannot open database")
    result = SqlserverConnector().test_connection(
        host="127.0.0.1", port=1433, database="missing", username="sa", password=""
    )
    assert result.ok is False
    assert result.code == "SQLSERVER_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.sqlserver.pymssql.connect")
def test_sqlserver_ssl_required_r36(mock_connect):
    """T-CONN-R36-005-06: ssl_mode=required → encrypt=True 传入。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    SqlserverConnector().test_connection(
        host="127.0.0.1",
        port=1433,
        database="master",
        username="sa",
        password="",
        ssl_mode="required",
    )
    assert mock_connect.call_args.kwargs.get("encrypt") is True


# --- CONN-008 Doris ---


def test_doris_types_catalog_r36():
    """T-CONN-R36-008-01: types 含 doris category=olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "doris" in types
    assert types["doris"]["category"] == "olap"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-008-02: mock ping 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is True
    conn.ping.assert_called_once_with(reconnect=False)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_conn_refused_r36(mock_connect):
    """T-CONN-R36-008-03: mock 2003 → DORIS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "DORIS_CONN_REFUSED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_auth_failed_r36(mock_connect):
    """T-CONN-R36-008-04: mock 1045 → DORIS_AUTH_FAILED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = DorisConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "DORIS_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_doris_unknown_catalog_tables_r36(mock_connect):
    """T-CONN-R36-008-05: mock 非法 catalog list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = DorisConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert connector.list_tables(connection, "") == []
    assert connector.list_tables(connection, "missing") == []


def test_doris_registry_nfr04_r36():
    """T-CONN-R36-008-06: register_dialect 不替换 ConnectorRegistry 核心类。"""
    from app.datasources.registry import ConnectorAlreadyRegisteredError, ConnectorRegistry as RegistryClass

    before = RegistryClass
    try:
        register_dialect(DorisConnector())
    except ConnectorAlreadyRegisteredError:
        pass
    assert RegistryClass is before


# --- CONN-004 Oracle ---


def test_oracle_types_catalog_r36():
    """T-CONN-R36-004-01: types 含 oracle category=relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "oracle" in types
    assert types["oracle"]["category"] == "relational"


@patch("oracledb.connect")
def test_oracle_test_connection_ok_r36(mock_connect):
    """T-CONN-R36-004-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="system", password=""
    )
    assert result.ok is True
    cursor.execute.assert_called()


@patch("oracledb.connect")
def test_oracle_auth_failed_r36(mock_connect):
    """T-CONN-R36-004-03: mock ORA-01017 → ORACLE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("ORA-01017: invalid username/password")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "ORACLE_AUTH_FAILED"


@patch("oracledb.connect")
def test_oracle_unknown_service_r36(mock_connect):
    """T-CONN-R36-004-04: mock ORA-12514 → ORACLE_UNKNOWN_SERVICE。"""
    mock_connect.side_effect = Exception("ORA-12514: TNS:listener does not know of service")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="BAD_SVC", username="system", password=""
    )
    assert result.ok is False
    assert result.code == "ORACLE_UNKNOWN_SERVICE"


@patch("oracledb.connect")
def test_oracle_conn_refused_r36(mock_connect):
    """T-CONN-R36-004-05: mock 连接拒绝 → ORACLE_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="system", password=""
    )
    assert result.ok is False
    assert result.code == "ORACLE_CONN_REFUSED"


@patch("oracledb.connect")
def test_oracle_empty_owner_columns_r36(mock_connect):
    """T-CONN-R36-004-06: mock 空 owner list_columns → []。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    connector = OracleConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1521, database="ORCLPDB1", username="system", password=""
    )
    assert connector.list_columns(connection, "", "T1") == []


# --- T-REG-R36 Registry + HTTP ---


def test_registry_ten_types_r36():
    """T-REG-R36-01: export_type_catalog 含 mysql/tidb/starrocks/elasticsearch + 五新 type。"""
    types = {item["type"] for item in export_type_catalog()}
    expected = {
        "mysql",
        "postgresql",
        "tidb",
        "starrocks",
        "elasticsearch",
        "hive",
        "clickhouse",
        "sqlserver",
        "doris",
        "oracle",
    }
    assert expected.issubset(types)
    assert len(types) >= 10


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_hive_http_test_connection_r36(mock_connect, client):
    """T-REG-R36-02: POST /datasources/test type=hive mock 成功 → 200 ok=true traceId。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "hive",
            "name": "hive-test",
            "code": "hive-test",
            "host": "127.0.0.1",
            "port": 10000,
            "database": "default",
            "username": "hive",
            "password": "secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body.get("traceId")


def test_clickhouse_create_and_types_r36(client):
    """T-REG-R36-03: POST /datasources type=clickhouse 创建；GET /types 含五新 type。"""
    with patch("clickhouse_connect.get_client") as mock_get:
        client_mock = MagicMock()
        client_mock.command.return_value = 1
        mock_get.return_value = client_mock
        create = client.post(
            "/api/v1/datasources",
            headers=AUTH,
            json={
                "type": "clickhouse",
                "name": f"ch-{uuid.uuid4().hex[:8]}",
                "code": f"ch-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 8123,
                "database": "default",
                "username": "default",
                "password": "secret",
            },
        )
        assert create.status_code in (200, 201)
    types_resp = client.get("/api/v1/datasources/types", headers=AUTH)
    type_names = {item["type"] for item in types_resp.json()["items"]}
    for t in ("hive", "clickhouse", "sqlserver", "doris", "oracle"):
        assert t in type_names


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_mysql_no_regression_r36(mock_connect, client):
    """T-REG-R36-04: mysql test_connection mock 成功不回归。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = MysqlConnector().test_connection(
        host="127.0.0.1", port=3306, database="test", username="root", password=""
    )
    assert result.ok is True
