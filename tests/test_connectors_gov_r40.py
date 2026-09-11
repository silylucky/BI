"""M11 嵌入式/时序/文档连接器 L1 kickoff r40 — CONN-014/011/012/006/013."""
from __future__ import annotations

import os
import sqlite3
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.influxdb import INFLUX_MAX_MEASUREMENTS, InfluxdbConnector
from app.datasources.dialects.mongodb import MONGODB_MAX_FIELDS, MongodbConnector
from app.datasources.dialects.sqlite import SqliteConnector
from app.datasources.dialects.tdengine import TDENGINE_MAX_COLUMNS, TdengineConnector
from app.datasources.dialects.timescaledb import TIMESCALE_MAX_COLUMNS, TimescaledbConnector
from app.datasources.registry import ConnectorRegistry, export_type_catalog
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R40_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r40?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r40_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R40_SQLITE_URL
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


def test_r40_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None


# --- CONN-014 MongoDB ---


def test_mongodb_types_catalog_r40():
    """T-CONN-R40-014-01: types 含 mongodb category=document schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "mongodb" in types
    assert types["mongodb"]["category"] == "document"
    assert "schema_browser" in types["mongodb"]["capabilities"]


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_test_connection_ok_r40(mock_get_client):
    """T-CONN-R40-014-02: mock ping 成功 → ok=True。"""
    client = MagicMock()
    client.admin.command.return_value = {"ok": 1}
    mock_get_client.return_value = client
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert result.ok is True
    client.admin.command.assert_called_with("ping")


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_auth_failed_r40(mock_get_client):
    """T-CONN-R40-014-03: mock 认证失败 → MONGODB_AUTH_FAILED。"""
    from pymongo.errors import OperationFailure

    mock_get_client.side_effect = OperationFailure("Authentication failed", code=18)
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "MONGODB_AUTH_FAILED"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_conn_refused_r40(mock_get_client):
    """T-CONN-R40-014-04: mock 连接拒绝 → MONGODB_CONN_REFUSED。"""
    mock_get_client.side_effect = ConnectionRefusedError("Connection refused")
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert result.ok is False
    assert result.code == "MONGODB_CONN_REFUSED"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_timeout_r40(mock_get_client):
    """T-CONN-R40-014-05: mock 超时 → MONGODB_TIMEOUT。"""
    from pymongo.errors import ServerSelectionTimeoutError

    mock_get_client.side_effect = ServerSelectionTimeoutError("timed out")
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert result.ok is False
    assert result.code == "MONGODB_TIMEOUT"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_list_schemas_filters_system_r40(mock_get_client):
    """T-CONN-R40-014-06: mock 库列表过滤 admin/local/config。"""
    client = MagicMock()
    client.list_database_names.return_value = ["app", "admin", "local", "config"]
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    schemas = connector.list_schemas(connection)
    names = {s.name for s in schemas}
    assert names == {"app"}
    assert "admin" not in names


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_unknown_database_tables_r40(mock_get_client):
    """T-CONN-R40-014-07: mock 未知 database list_tables → []。"""
    client = MagicMock()
    client.__getitem__.side_effect = KeyError("unknown")
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert connector.list_tables(connection, "missing_db") == []


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_list_columns_limit_r40(mock_get_client):
    """T-CONN-R40-014-08: mock 600 字段文档 → list_columns 返回 500。"""
    client = MagicMock()
    collection = MagicMock()
    doc = {f"field_{i}": i for i in range(600)}
    collection.find_one.return_value = doc
    db = MagicMock()
    db.__getitem__.return_value = collection
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    columns = connector.list_columns(connection, "app", "events")
    assert len(columns) == MONGODB_MAX_FIELDS


# --- CONN-011 InfluxDB ---


def test_influxdb_types_catalog_r40():
    """T-CONN-R40-011-01: types 含 influxdb category=timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "influxdb" in types
    assert types["influxdb"]["category"] == "timeseries"
    assert "schema_browser" in types["influxdb"]["capabilities"]


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_test_connection_ok_r40(mock_build):
    """T-CONN-R40-011-02: mock ping 成功 → ok=True。"""
    client = MagicMock()
    client.ping.return_value = True
    mock_build.return_value = client
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is True


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_auth_failed_r40(mock_build):
    """T-CONN-R40-011-03: mock 401 → INFLUX_AUTH_FAILED。"""
    mock_build.side_effect = Exception("401 Unauthorized")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="badorg", password="bad"
    )
    assert result.ok is False
    assert result.code == "INFLUX_AUTH_FAILED"


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_conn_refused_r40(mock_build):
    """T-CONN-R40-011-04: mock connection refused → INFLUX_CONN_REFUSED。"""
    mock_build.side_effect = ConnectionRefusedError("Connection refused")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_CONN_REFUSED"


@patch("app.datasources.dialects.influxdb._build_client")
def test_influxdb_unknown_org_r40(mock_build):
    """T-CONN-R40-011-05: mock 非法 org → INFLUX_UNKNOWN_ORG。"""
    mock_build.side_effect = Exception("org not found: badorg")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="badorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_UNKNOWN_ORG"


@patch("app.datasources.dialects.influxdb._query_api")
def test_influxdb_unknown_bucket_tables_r40(mock_query_api):
    """T-CONN-R40-011-06: mock 未知 bucket measurements → []。"""
    mock_query_api.return_value.query.return_value = []
    connector = InfluxdbConnector()
    connection = MagicMock()
    assert connector.list_tables(connection, "missing_bucket") == []


@patch("app.datasources.dialects.influxdb._query_api")
def test_influxdb_list_tables_limit_r40(mock_query_api):
    """T-CONN-R40-011-07: mock 600 measurements → list_tables 返回 500。"""
    tables = MagicMock()
    tables.records = [MagicMock(get_value=lambda i=i: f"m{i}") for i in range(600)]
    mock_query_api.return_value.query.return_value = [tables]
    connector = InfluxdbConnector()
    connection = MagicMock()
    result = connector.list_tables(connection, "metrics")
    assert len(result) == INFLUX_MAX_MEASUREMENTS


# --- CONN-012 TDengine ---


def test_tdengine_types_catalog_r40():
    """T-CONN-R40-012-01: types 含 tdengine category=timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tdengine" in types
    assert types["tdengine"]["category"] == "timeseries"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_test_connection_ok_r40(mock_connect):
    """T-CONN-R40-012-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchone.return_value = ("3.0.0",)
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is True


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_auth_failed_r40(mock_connect):
    """T-CONN-R40-012-03: mock 认证失败 → TDENGINE_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Authentication failure")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_AUTH_FAILED"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_conn_refused_r40(mock_connect):
    """T-CONN-R40-012-04: mock 端点不可达 → TDENGINE_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_CONN_REFUSED"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_unknown_database_tables_r40(mock_connect):
    """T-CONN-R40-012-05: mock 未知 database list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.side_effect = Exception("database not exist")
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert connector.list_tables(connection, "missing") == []


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_stable_table_types_r40(mock_connect):
    """T-CONN-R40-012-06: mock stable+table 列表含 type 区分。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [("meters",)],
        [("d001",)],
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    tables = {t.name: t.type for t in connector.list_tables(connection, "power")}
    assert tables.get("meters") == "stable"
    assert tables.get("d001") == "table"


def test_tdengine_registry_plugin_r40():
    """T-CONN-R40-012-07: registry 插件注册不修改 ConnectorRegistry 核心类（NFR-04）。"""
    registry = ConnectorRegistry()
    assert hasattr(registry, "register")
    assert hasattr(registry, "get")
    assert "tdengine" in {item["type"] for item in export_type_catalog()}


# --- CONN-006 SQLite ---


def test_sqlite_types_catalog_r40():
    """T-CONN-R40-006-01: types 含 sqlite category=embedded。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "sqlite" in types
    assert types["sqlite"]["category"] == "embedded"


def test_sqlite_test_connection_ok_r40(tmp_path):
    """T-CONN-R40-006-02: tmp 文件 → ok=True。"""
    db_path = tmp_path / "sample.db"
    sqlite3.connect(db_path).close()
    result = SqliteConnector().test_connection(
        host=str(db_path), port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is True


def test_sqlite_file_not_found_r40():
    """T-CONN-R40-006-03: 不存在路径 → SQLITE_FILE_NOT_FOUND。"""
    result = SqliteConnector().test_connection(
        host="/tmp/vitalspan_missing_r40.db", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_FILE_NOT_FOUND"


def test_sqlite_path_traversal_r40():
    """T-CONN-R40-006-04: ../../etc/passwd 样式 → SQLITE_PATH_TRAVERSAL。"""
    result = SqliteConnector().test_connection(
        host="../../etc/passwd", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_PATH_TRAVERSAL"


def test_sqlite_permission_denied_r40(tmp_path, monkeypatch):
    """T-CONN-R40-006-05: mock 无读权限 → SQLITE_PERMISSION_DENIED。"""
    db_path = tmp_path / "locked.db"
    sqlite3.connect(db_path).close()
    monkeypatch.setattr(os, "access", lambda *_a, **_k: False)
    result = SqliteConnector().test_connection(
        host=str(db_path), port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_PERMISSION_DENIED"


def test_sqlite_list_schemas_main_r40(tmp_path):
    """T-CONN-R40-006-06: list_schemas 返回 main。"""
    db_path = tmp_path / "app.db"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE t1 (id INTEGER)")
    conn.commit()
    conn.close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    schemas = connector.list_schemas(connection)
    assert [s.name for s in schemas] == ["main"]


def test_sqlite_unknown_table_columns_r40(tmp_path):
    """T-CONN-R40-006-07: 未知表 list_columns → []。"""
    db_path = tmp_path / "app.db"
    sqlite3.connect(db_path).close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    assert connector.list_columns(connection, "main", "missing_table") == []


# --- CONN-013 TimescaleDB ---


def test_timescaledb_types_catalog_r40():
    """T-CONN-R40-013-01: types 含 timescaledb category=timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "timescaledb" in types
    assert types["timescaledb"]["category"] == "timeseries"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_test_connection_ok_r40(mock_open):
    """T-CONN-R40-013-02: mock PG ping + 扩展存在 → ok=True。"""
    conn = MagicMock()
    ext_cur = MagicMock()
    ext_cur.fetchone.return_value = (1,)
    conn.execute.side_effect = [MagicMock(), ext_cur]
    mock_open.return_value = conn
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is True


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_auth_failed_r40(mock_open):
    """T-CONN-R40-013-03: mock 认证失败 → TIMESCALE_AUTH_FAILED。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed")
    exc.pgcode = "28P01"
    mock_open.side_effect = exc
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_AUTH_FAILED"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_extension_missing_r40(mock_open):
    """T-CONN-R40-013-04: mock 扩展缺失 → TIMESCALE_EXTENSION_MISSING。"""
    conn = MagicMock()
    ext_cur = MagicMock()
    ext_cur.fetchone.return_value = None
    conn.execute.side_effect = [MagicMock(), ext_cur]
    mock_open.return_value = conn
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_EXTENSION_MISSING"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_tables")
@patch("app.datasources.dialects.timescaledb.TimescaledbConnector._hypertable_names")
def test_timescaledb_hypertable_mark_r40(mock_hypertables, mock_list_tables):
    """T-CONN-R40-013-06: mock tables 含 hypertable 标记 type=hypertable。"""
    from app.datasources.dialects.base import TableInfo

    mock_list_tables.return_value = [
        TableInfo(name="events", type="table"),
        TableInfo(name="metrics", type="table"),
    ]
    mock_hypertables.return_value = {"metrics"}
    connector = TimescaledbConnector()
    tables = {t.name: t.type for t in connector.list_tables(MagicMock(), "public")}
    assert tables["metrics"] == "hypertable"
    assert tables["events"] == "table"


def test_timescaledb_postgresql_still_registered_r40():
    """T-CONN-R40-013-07: postgresql types catalog 仍独立存在。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "postgresql" in types
    assert "timescaledb" in types
    assert types["postgresql"]["type"] == "postgresql"


# --- T-REG-R40 registry ---

_R40_NEW_TYPES = ("mongodb", "influxdb", "tdengine", "sqlite", "timescaledb")


def test_r40_export_type_catalog_count():
    """T-REG-R40-01: export_type_catalog 返回 31 种 type（含 r250 redshift + CONN-028 roapi）。"""
    catalog = export_type_catalog()
    assert len(catalog) == 31


@pytest.mark.parametrize("connector_type", _R40_NEW_TYPES)
def test_r40_new_types_capabilities(connector_type):
    """T-REG-R40-02: 五新 type 均含 connectivity_test + schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert connector_type in types
    caps = set(types[connector_type]["capabilities"])
    assert "connectivity_test" in caps
    assert "schema_browser" in caps


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescaledb_unknown_database_r40(mock_open):
    """T-CONN-R40-013-05: mock 未知 database → TIMESCALE_UNKNOWN_DATABASE。"""
    import psycopg

    exc = psycopg.OperationalError('database "missing" does not exist')
    exc.pgcode = "3D000"
    mock_open.side_effect = exc
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="missing", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_UNKNOWN_DATABASE"
