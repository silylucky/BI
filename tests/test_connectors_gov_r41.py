"""M11 嵌入式/时序/文档连接器 companion 质量推分 r41 — CONN-014/011/012/006/013."""
from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.dialects.mongodb import MongodbConnector
from app.datasources.models import get_meta_session
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app

_R41_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r41?mode=memory&cache=shared&uri=true"


def _dispose_meta_engines() -> None:
    from app.auth.models import get_meta_engine as auth_engine
    from app.datasources.models import get_meta_engine
    from app.ingestion.models import get_meta_engine as ingestion_engine
    from app.query.models import get_meta_engine as query_engine

    for engine_fn in (get_meta_engine, auth_engine, query_engine, ingestion_engine):
        try:
            engine_fn().dispose()
        except Exception:
            pass
        engine_fn.cache_clear()


@pytest.fixture(scope="module", autouse=True)
def r41_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R41_SQLITE_URL
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
    _dispose_meta_engines()
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_typed_ds(ds_type: str, *, host: str | None = None, name_suffix: str | None = None):
    suffix = name_suffix or uuid.uuid4().hex[:8]
    session = get_meta_session()
    try:
        defaults = {
            "mongodb": dict(port=27017, database="app", username="x", password="x"),
            "influxdb": dict(port=8086, database="metrics", username="myorg", password="token"),
            "tdengine": dict(port=6041, database="power", username="root", password="taosdata"),
            "sqlite": dict(port=1, database="main", username="sqlite", password="x"),
            "timescaledb": dict(port=5432, database="metrics", username="ts", password="secret"),
        }
        extra = defaults.get(ds_type, {})
        return create_data_source(
            session,
            DataSourceCreate(
                name=f"{ds_type}-{suffix}",
                code=f"{ds_type}-{suffix}",
                type=ds_type,
                host=host or "127.0.0.1",
                port=extra.get("port", 5432),
                database=extra.get("database", "test"),
                username=extra.get("username", "user"),
                password=extra.get("password", "secret"),
            ),
        )
    finally:
        session.close()


def test_r41_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_unknown_database_r41(mock_get_client):
    """T-CONN-R41-014-01: mock database missing → MONGODB_UNKNOWN_DATABASE。"""
    from pymongo.errors import OperationFailure

    mock_get_client.side_effect = OperationFailure('database "missing" does not exist', code=26)
    result = MongodbConnector().test_connection(
        host="127.0.0.1", port=27017, database="missing", username="", password=""
    )
    assert result.ok is False
    assert result.code == "MONGODB_UNKNOWN_DATABASE"


from app.datasources.registry import export_type_catalog


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_empty_collection_columns_r41(mock_get_client):
    """T-CONN-R41-014-02: mock 空 collection list_columns → []。"""
    client = MagicMock()
    collection = MagicMock()
    collection.find_one.return_value = None
    db = MagicMock()
    db.__getitem__.return_value = collection
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert connector.list_columns(connection, "app", "events") == []


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_empty_database_tables_r41(mock_get_client):
    """T-CONN-R41-014-03: mock 空库 list_tables → []。"""
    client = MagicMock()
    db = MagicMock()
    db.list_collection_names.return_value = []
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    assert connector.list_tables(connection, "app") == []


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_bson_type_enum_r41(mock_get_client):
    """T-CONN-R41-014-04: mock BSON 六类型 data_type 枚举。"""
    from datetime import datetime

    client = MagicMock()
    collection = MagicMock()
    collection.find_one.return_value = {
        "s": "x",
        "n": 1,
        "b": True,
        "dt": datetime(2026, 1, 1),
        "j": {"a": 1},
        "arr": [1, 2],
    }
    db = MagicMock()
    db.__getitem__.return_value = collection
    client.__getitem__.return_value = db
    mock_get_client.return_value = client
    connector = MongodbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=27017, database="app", username="", password=""
    )
    types = {c.name: c.data_type for c in connector.list_columns(connection, "app", "events")}
    assert types["s"] == "string"
    assert types["n"] == "number"
    assert types["b"] == "boolean"
    assert types["dt"] == "datetime"
    assert types["j"] == "json"
    assert types["arr"] == "json"


def test_mongodb_types_catalog_r41():
    """T-CONN-R41-014-05: types catalog mongodb category=document + schema_browser + displayName。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["mongodb"]["category"] == "document"
    assert "schema_browser" in types["mongodb"]["capabilities"]
    assert types["mongodb"]["displayName"] == "MongoDB"


@patch("app.datasources.dialects.mongodb._get_client")
def test_mongodb_http_auth_failed_r41(mock_get_client, client):
    """T-CONN-R41-014-06: HTTP POST test mock auth fail → 200 ok=false MONGODB_AUTH_FAILED traceId。"""
    from pymongo.errors import OperationFailure

    mock_get_client.side_effect = OperationFailure("Authentication failed", code=18)
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "mongodb",
            "name": "mongo-test",
            "code": f"mongo-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 27017,
            "database": "app",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "MONGODB_AUTH_FAILED"
    assert body.get("traceId")


def test_mongodb_metadata_tables_missing_schema_400_r41(client):
    """T-CONN-R41-014-07: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("mongodb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


# --- CONN-011 InfluxDB ---

from app.datasources.dialects.influxdb import InfluxdbConnector


@patch("app.datasources.dialects.influxdb._build_client")
def test_influx_timeout_r41(mock_build):
    """T-CONN-R41-011-01: mock timeout → INFLUX_TIMEOUT。"""
    mock_build.side_effect = Exception("Connection timed out")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_TIMEOUT"


@patch("app.datasources.dialects.influxdb._build_client")
def test_influx_unknown_bucket_r41(mock_build):
    """T-CONN-R41-011-02: mock bucket not found → INFLUX_UNKNOWN_BUCKET。"""
    mock_build.side_effect = Exception("bucket not found: metrics")
    result = InfluxdbConnector().test_connection(
        host="127.0.0.1", port=8086, database="metrics", username="myorg", password="token"
    )
    assert result.ok is False
    assert result.code == "INFLUX_UNKNOWN_BUCKET"


@patch("app.datasources.dialects.influxdb._query_api")
def test_influx_empty_bucket_tables_r41(mock_query_api):
    """T-CONN-R41-011-03: mock 空 bucket measurements → list_tables []。"""
    mock_query_api.return_value.query.return_value = []
    connector = InfluxdbConnector()
    assert connector.list_tables(MagicMock(), "metrics") == []


@patch("app.datasources.dialects.influxdb._query_api")
def test_influx_field_tag_type_enum_r41(mock_query_api):
    """T-CONN-R41-011-04: mock fieldKeys/tagKeys → number+string 各 ≥1。"""
    field_tbl = MagicMock()
    field_tbl.records = [MagicMock(get_value=lambda: "temperature")]
    tag_tbl = MagicMock()
    tag_tbl.records = [MagicMock(get_value=lambda: "host")]
    mock_query_api.return_value.query.side_effect = [[field_tbl], [tag_tbl]]
    connector = InfluxdbConnector()
    cols = connector.list_columns(MagicMock(), "metrics", "cpu")
    kinds = {c.data_type for c in cols}
    assert "number" in kinds
    assert "string" in kinds


@patch("app.datasources.dialects.influxdb._build_client")
def test_influx_http_auth_failed_r41(mock_build, client):
    """T-CONN-R41-011-05: HTTP POST test mock 401 → 200 ok=false INFLUX_AUTH_FAILED traceId。"""
    mock_build.side_effect = Exception("401 Unauthorized")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "influxdb",
            "name": "influx-test",
            "code": f"influx-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "badtoken",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "INFLUX_AUTH_FAILED"
    assert body.get("traceId")


def test_influx_metadata_tables_missing_schema_400_r41(client):
    """T-CONN-R41-011-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("influxdb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


# --- CONN-012 TDengine ---

from app.datasources.dialects.tdengine import TDENGINE_MAX_COLUMNS, TdengineConnector


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_timeout_r41(mock_connect):
    """T-CONN-R41-012-01: mock timeout → TDENGINE_TIMEOUT。"""
    mock_connect.side_effect = Exception("Connection timed out")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_TIMEOUT"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_unknown_database_r41(mock_connect):
    """T-CONN-R41-012-02: mock database not exist → TDENGINE_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = Exception("database not exist")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="missing", username="root", password="taosdata"
    )
    assert result.ok is False
    assert result.code == "TDENGINE_UNKNOWN_DATABASE"


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_empty_database_tables_r41(mock_connect):
    """T-CONN-R41-012-03: mock 空库 list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [[], []]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert connector.list_tables(connection, "power") == []


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_describe_type_enum_r41(mock_connect):
    """T-CONN-R41-012-04: mock DESCRIBE 类型枚举 ≥3 种 data_type。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("ts", "TIMESTAMP"),
        ("val", "INT"),
        ("name", "NCHAR"),
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    types = {c.data_type for c in connector.list_columns(connection, "power", "meters")}
    assert types == {"TIMESTAMP", "INT", "NCHAR"}


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_columns_limit_r41(mock_connect):
    """T-CONN-R41-012-05: mock 600 列 → list_columns 返回 500。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [(f"col_{i}", "INT") for i in range(600)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = TdengineConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    cols = connector.list_columns(connection, "power", "wide")
    assert len(cols) == TDENGINE_MAX_COLUMNS == 500


@patch("app.datasources.dialects.tdengine._connect")
def test_tdengine_http_auth_failed_r41(mock_connect, client):
    """T-CONN-R41-012-06: HTTP POST test mock auth fail → 200 ok=false TDENGINE_AUTH_FAILED traceId。"""
    mock_connect.side_effect = Exception("Authentication failure")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "tdengine",
            "name": "td-test",
            "code": f"td-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TDENGINE_AUTH_FAILED"
    assert body.get("traceId")


@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.tdengine.TdengineConnector.list_schemas")
def test_tdengine_metadata_schemas_502_r41(mock_list, mock_pool, client):
    """T-CONN-R41-012-07: HTTP GET schemas list_schemas 失败 → 502 METADATA_CONNECTION_FAILED。"""
    mock_list.side_effect = Exception("connection failed")

    @contextmanager
    def _cm(*_a, **_k):
        yield MagicMock()

    mock_pool.side_effect = _cm
    ds = _create_typed_ds("tdengine")
    resp = client.get(f"/api/v1/datasources/{ds.id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"
    assert "password" not in resp.text.lower()


# --- CONN-006 SQLite ---

import sqlite3

from app.datasources.dialects.sqlite import SqliteConnector


@patch("app.datasources.dialects.sqlite.sqlite3.connect")
@patch("app.datasources.dialects.sqlite._validate_db_path")
def test_sqlite_readonly_r41(mock_validate, mock_connect, tmp_path):
    """T-CONN-R41-006-01: mock readonly OperationalError → SQLITE_READONLY。"""
    db_path = tmp_path / "sample.db"
    db_path.touch()
    mock_validate.return_value = (db_path, None)
    mock_connect.side_effect = sqlite3.OperationalError("attempt to write a readonly database")
    result = SqliteConnector().test_connection(
        host=str(db_path), port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_READONLY"


def test_sqlite_open_connection_path_traversal_r41():
    """T-CONN-R41-006-02: open_connection 路径穿越 → ValueError SQLITE_PATH_TRAVERSAL。"""
    connector = SqliteConnector()
    with pytest.raises(ValueError) as exc_info:
        connector.open_connection(host="../../etc/passwd", port=1, database="main", username="sqlite", password="x")
    assert "SQLITE_PATH_TRAVERSAL" in str(exc_info.value)


def test_sqlite_pragma_type_enum_r41(tmp_path):
    """T-CONN-R41-006-03: mock PRAGMA 类型枚举 integer/text/real。"""
    db_path = tmp_path / "types.db"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE t (id INTEGER, name TEXT, score REAL)")
    conn.commit()
    conn.close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    types = {c.name: c.data_type for c in connector.list_columns(connection, "main", "t")}
    assert types["id"] == "INTEGER"
    assert types["name"] == "TEXT"
    assert types["score"] == "REAL"


def test_sqlite_empty_database_tables_r41(tmp_path):
    """T-CONN-R41-006-04: 空库 list_tables → []。"""
    db_path = tmp_path / "empty.db"
    sqlite3.connect(db_path).close()
    connector = SqliteConnector()
    connection = connector.open_connection(host=str(db_path), port=1, database="main", username="sqlite", password="x")
    assert connector.list_tables(connection, "main") == []


def test_sqlite_http_file_not_found_r41(client):
    """T-CONN-R41-006-05: HTTP POST test 缺失文件 → 200 ok=false SQLITE_FILE_NOT_FOUND traceId。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "sqlite",
            "name": "sqlite-test",
            "code": f"sqlite-{uuid.uuid4().hex[:8]}",
            "host": "/tmp/vitalspan_missing_r41.db",
            "port": 1,
            "database": "main",
            "username": "sqlite",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "SQLITE_FILE_NOT_FOUND"
    assert body.get("traceId")


def test_sqlite_metadata_tables_missing_schema_400_r41(client, tmp_path):
    """T-CONN-R41-006-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    db_path = tmp_path / "app.db"
    sqlite3.connect(db_path).close()
    ds = _create_typed_ds("sqlite", host=str(db_path))
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


# --- CONN-013 TimescaleDB ---

from app.datasources.dialects.base import ColumnInfo
from app.datasources.dialects.timescaledb import TIMESCALE_MAX_COLUMNS, TimescaledbConnector
from jwt_auth import AUTH, jwt_auth_headers


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescale_timeout_r41(mock_open):
    """T-CONN-R41-013-01: mock timeout → TIMESCALE_TIMEOUT。"""
    import psycopg

    exc = psycopg.OperationalError("timeout expired")
    exc.pgcode = None
    mock_open.side_effect = exc
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_TIMEOUT"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescale_conn_refused_r41(mock_open):
    """T-CONN-R41-013-02: mock connection refused → TIMESCALE_CONN_REFUSED。"""
    mock_open.side_effect = ConnectionRefusedError("Connection refused")
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1", port=5432, database="metrics", username="ts", password="secret"
    )
    assert result.ok is False
    assert result.code == "TIMESCALE_CONN_REFUSED"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_tables")
@patch("app.datasources.dialects.timescaledb.TimescaledbConnector._hypertable_names")
def test_timescale_empty_schema_tables_r41(mock_hypertables, mock_list_tables):
    """T-CONN-R41-013-03: mock 空 schema list_tables → []。"""
    mock_list_tables.return_value = []
    mock_hypertables.return_value = set()
    connector = TimescaledbConnector()
    assert connector.list_tables(MagicMock(), "public") == []


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_columns")
def test_timescale_columns_limit_r41(mock_list_columns):
    """T-CONN-R41-013-04: mock 600 列 → list_columns 返回 500。"""
    mock_list_columns.return_value = [
        ColumnInfo(name=f"col_{i}", data_type="varchar", nullable=True) for i in range(600)
    ]
    connector = TimescaledbConnector()
    cols = connector.list_columns(MagicMock(), "public", "wide")
    assert len(cols) == TIMESCALE_MAX_COLUMNS == 500


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_columns")
def test_timescale_pg_type_enum_r41(mock_list_columns):
    """T-CONN-R41-013-05: mock PG 类型枚举 ≥3 种。"""
    mock_list_columns.return_value = [
        ColumnInfo(name="name", data_type="varchar", nullable=True),
        ColumnInfo(name="value", data_type="int4", nullable=True),
        ColumnInfo(name="ts", data_type="timestamptz", nullable=False),
    ]
    connector = TimescaledbConnector()
    types = {c.data_type for c in connector.list_columns(MagicMock(), "public", "events")}
    assert types == {"varchar", "int4", "timestamptz"}


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_timescale_http_auth_failed_r41(mock_open, client):
    """T-CONN-R41-013-06: HTTP POST test mock 28P01 → 200 ok=false TIMESCALE_AUTH_FAILED traceId。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed")
    exc.pgcode = "28P01"
    mock_open.side_effect = exc
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "timescaledb",
            "name": "ts-test",
            "code": f"ts-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5432,
            "database": "metrics",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TIMESCALE_AUTH_FAILED"
    assert body.get("traceId")


def test_timescale_metadata_tables_missing_schema_400_r41(client):
    """T-CONN-R41-013-07: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("timescaledb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


# --- Registry regression ---

_R41_TYPES = ("mongodb", "influxdb", "tdengine", "sqlite", "timescaledb")


def test_r41_export_type_catalog_count():
    """T-REG-R41-01: export_type_catalog() 仍返回 31 种 type（含 r250 redshift + CONN-028 roapi）。"""
    catalog = export_type_catalog()
    assert len(catalog) == 31
    for t in _R41_TYPES:
        assert t in {item["type"] for item in catalog}


def test_r41_five_types_capabilities_complete():
    """T-REG-R41-02: 五 type connectivity_test + schema_browser capabilities 完整。"""
    types = {item["type"]: item for item in export_type_catalog()}
    for t in _R41_TYPES:
        assert "connectivity_test" in types[t]["capabilities"]
        assert "schema_browser" in types[t]["capabilities"]
        assert types[t]["displayName"]
