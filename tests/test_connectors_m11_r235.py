"""M11 三期原生连接器扩展批次 1 r235 — CONN-009~013 集成验收。

可选 compose 端口（integration 分层 skip）：
  - StarRocks: 127.0.0.1:9030
  - Trino/Presto: 127.0.0.1:8080
  - InfluxDB: 127.0.0.1:8086
  - TDengine: 127.0.0.1:6041
  - TimescaleDB: 127.0.0.1:5434 (ops_tsdb)
"""
from __future__ import annotations

import json
import os
import uuid
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pymysql
import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources.dialects.base import ColumnInfo, SchemaInfo, TableInfo
from app.datasources.dialects.influxdb import InfluxdbConnector, _probe_readonly_flux
from app.datasources.dialects.presto import PrestoConnector
from app.datasources.dialects.starrocks import StarrocksConnector
from app.datasources.dialects.tdengine import TdengineConnector
from app.datasources.dialects.timescaledb import TimescaledbConnector
from app.datasources.dialects.trino import TrinoConnector
from app.datasources.registry import export_type_catalog, registry
from app.main import app

AUTH = jwt_auth_headers()
_R235_SQLITE_URL = "sqlite+pysqlite:///file:connectors_m11_r235?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r235_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R235_SQLITE_URL
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


def test_r235_scaffold_imports():
    """Scaffold: module loads and sqlite meta DB is ready."""
    assert app is not None


# --- CONN-009 StarRocks ---


def test_conn_r235_009_01_types_catalog_starrocks():
    """T-CONN-R235-009-01: export_type_catalog 含 starrocks / olap / schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "starrocks" in types
    assert types["starrocks"]["category"] == "olap"
    conn = registry.get("starrocks")
    assert isinstance(conn, StarrocksConnector)
    assert set(conn.capabilities) >= {"connectivity_test", "schema_browser"}


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r235_009_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R235-009-02: HTTP POST test mock 2003 → STARROCKS_CONN_REFUSED；无 password。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "starrocks",
            "name": "sr-r235",
            "code": f"sr-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "test",
            "username": "root",
            "password": "sample_secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "STARROCKS_CONN_REFUSED"
    assert "sample_secret" not in json.dumps(body)
    assert "password" not in resp.text.lower()


@patch("app.datasources.dialects.starrocks.StarrocksConnector.list_columns")
@patch("app.datasources.dialects.starrocks.StarrocksConnector.list_tables")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r235_009_03_http_metadata_columns_chain(
    mock_connect, mock_pool, mock_tables, mock_columns, client
):
    """T-CONN-R235-009-03: HTTP tables/columns mock → 200 + 列名集合。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    mock_tables.return_value = [TableInfo(name="orders", type="table")]
    mock_columns.return_value = [
        ColumnInfo(name="id", data_type="bigint", nullable=False),
        ColumnInfo(name="region", data_type="varchar", nullable=True),
    ]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "starrocks",
            "name": "sr-meta-r235",
            "code": f"sr-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9030,
            "database": "analytics",
            "username": "root",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=analytics", headers=AUTH)
    assert tables.status_code == 200
    cols = client.get(
        f"/api/v1/datasources/{ds_id}/columns?schema=analytics&table=orders",
        headers=AUTH,
    )
    assert cols.status_code == 200
    names = {c["name"] for c in cols.json()["items"]}
    assert names == {"id", "region"}


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_conn_r235_009_unknown_database(mock_connect):
    """T-CONN-R235-009-04: mock 1049 → STARROCKS_UNKNOWN_DATABASE（对称 Doris）。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1049, "Unknown database 'missing'")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="missing", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "STARROCKS_UNKNOWN_DATABASE"


@pytest.mark.integration
def test_conn_r235_009_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-009-05: 9030 可达则实库 test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 9030):
        pytest.skip("StarRocks not running on 127.0.0.1:9030")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is True


# --- CONN-010 Trino/Presto ---


def test_conn_r235_010_01_types_catalog_trino_presto():
    """T-CONN-R235-010-01: catalog 含 trino 与 presto，均为 lake。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "trino" in types
    assert "presto" in types
    assert types["trino"]["category"] == "lake"
    assert types["presto"]["category"] == "lake"
    assert isinstance(registry.get("presto"), PrestoConnector)


@patch("trino.dbapi.connect")
def test_conn_r235_010_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R235-010-02: HTTP POST test mock refused → TRINO_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "trino",
            "name": "trino-r235",
            "code": f"trino-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "trino",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TRINO_CONN_REFUSED"
    assert body.get("traceId")


@patch("app.datasources.dialects.trino.TrinoConnector.list_schemas")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("trino.dbapi.connect")
def test_conn_r235_010_03_http_metadata_catalog_passed(
    mock_connect, mock_pool, mock_list_schemas, client
):
    """T-CONN-R235-010-03: type=trino database=hive → list_schemas(catalog='hive') 非空。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    mock_list_schemas.return_value = [SchemaInfo(name="default"), SchemaInfo(name="sales")]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "trino",
            "name": "trino-meta-r235",
            "code": f"trino-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "trino",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    schemas = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert schemas.status_code == 200
    names = {s["name"] for s in schemas.json()["items"]}
    assert names == {"default", "sales"}
    mock_list_schemas.assert_called_once()
    _args, kwargs = mock_list_schemas.call_args
    assert kwargs.get("catalog") == "hive"


@patch("trino.dbapi.connect")
def test_conn_r235_010_04_presto_symmetric_http_test(mock_connect, client):
    """T-CONN-R235-010-04: type=presto HTTP test 与 trino 对称。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "presto",
            "name": "presto-r235",
            "code": f"presto-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "presto",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is False
    assert resp.json()["code"] == "TRINO_CONN_REFUSED"


@pytest.mark.integration
def test_conn_r235_010_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-010-05: 8080 可达则 Trino test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 8080):
        pytest.skip("Trino not running on 127.0.0.1:8080")
    result = TrinoConnector().test_connection(
        host="127.0.0.1", port=8080, database="hive", username="trino", password=""
    )
    assert result.ok is True


# --- CONN-011 InfluxDB ---


def test_conn_r235_011_01_types_catalog_influxdb():
    """T-CONN-R235-011-01: types catalog influxdb / timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "influxdb" in types
    assert types["influxdb"]["category"] == "timeseries"


@patch("app.datasources.dialects.influxdb._build_client")
def test_conn_r235_011_02_http_test_conn_refused(mock_build, client):
    """T-CONN-R235-011-02: HTTP test mock refused → INFLUX_CONN_REFUSED；无 token。"""
    mock_build.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "influxdb",
            "name": "influx-r235",
            "code": f"influx-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "secret_token_value",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "INFLUX_CONN_REFUSED"
    assert "secret_token_value" not in json.dumps(body)
    assert "token" not in resp.text.lower() or "INFLUX" in body.get("code", "")


@patch("app.datasources.dialects.influxdb.InfluxdbConnector.list_tables")
@patch("app.datasources.dialects.influxdb.InfluxdbConnector.list_schemas")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.influxdb._build_client")
def test_conn_r235_011_03_http_metadata_bucket_measurements(
    mock_build, mock_pool, mock_schemas, mock_tables, client
):
    """T-CONN-R235-011-03: HTTP metadata bucket → measurements mock 链。"""
    conn = MagicMock()
    mock_build.return_value = conn
    mock_schemas.return_value = [SchemaInfo(name="metrics")]
    mock_tables.return_value = [TableInfo(name="cpu", type="measurement")]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "influxdb",
            "name": "influx-meta-r235",
            "code": f"influx-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8086,
            "database": "metrics",
            "username": "myorg",
            "password": "token",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=metrics", headers=AUTH)
    assert tables.status_code == 200
    assert tables.json()["items"][0]["name"] == "cpu"


@patch("app.datasources.dialects.influxdb._query_api")
def test_conn_r235_011_04_probe_readonly_flux(mock_query_api):
    """T-CONN-R235-011-04: mock query_api().query 只读 Flux 探测返回 True。"""
    mock_query_api.return_value.query.return_value = []
    conn = MagicMock()
    assert _probe_readonly_flux(conn, "metrics") is True
    mock_query_api.return_value.query.assert_called_once()
    flux_arg = mock_query_api.return_value.query.call_args[0][0]
    assert 'limit(n: 1)' in flux_arg or "limit(n:1)" in flux_arg


# --- CONN-012 TDengine ---


def test_conn_r235_012_01_types_catalog_tdengine():
    """T-CONN-R235-012-01: types catalog tdengine / timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tdengine" in types
    assert types["tdengine"]["category"] == "timeseries"


@patch("app.datasources.dialects.tdengine._connect")
def test_conn_r235_012_02_http_test_conn_refused(mock_connect, client):
    """T-CONN-R235-012-02: HTTP test mock refused → TDENGINE_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("Connection refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "tdengine",
            "name": "td-r235",
            "code": f"td-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "root",
            "password": "taosdata",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TDENGINE_CONN_REFUSED"


@patch("app.datasources.dialects.tdengine.TdengineConnector.list_columns")
@patch("app.datasources.dialects.tdengine.TdengineConnector.list_tables")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.tdengine._connect")
def test_conn_r235_012_03_http_metadata_stable_type(
    mock_connect, mock_pool, mock_tables, mock_columns, client
):
    """T-CONN-R235-012-03: HTTP metadata 超级表 type=stable mock 链。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    mock_tables.return_value = [TableInfo(name="meters", type="stable")]
    mock_columns.return_value = [ColumnInfo(name="ts", data_type="TIMESTAMP", nullable=False)]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "tdengine",
            "name": "td-meta-r235",
            "code": f"td-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 6041,
            "database": "power",
            "username": "root",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=power", headers=AUTH)
    assert tables.status_code == 200
    assert tables.json()["items"][0]["type"] == "stable"


@patch("app.datasources.dialects.tdengine._import_taos", return_value=None)
def test_conn_r235_012_04_driver_missing(mock_import):
    """T-CONN-R235-012-04: mock driver missing → TDENGINE_DRIVER_MISSING。"""
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "TDENGINE_DRIVER_MISSING"


@pytest.mark.integration
def test_conn_r235_012_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-012-05: 6041 可达则 TDengine test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 6041):
        pytest.skip("TDengine not running on 127.0.0.1:6041")
    result = TdengineConnector().test_connection(
        host="127.0.0.1", port=6041, database="power", username="root", password="taosdata"
    )
    assert result.ok is True


# --- CONN-013 TimescaleDB ---


def test_conn_r235_013_01_types_catalog_timescaledb():
    """T-CONN-R235-013-01: types catalog timescaledb / timeseries。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "timescaledb" in types
    assert types["timescaledb"]["category"] == "timeseries"


@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_conn_r235_013_02_http_test_extension_missing(mock_open, client):
    """T-CONN-R235-013-02: HTTP test mock 无 timescaledb 扩展 → TIMESCALE_EXTENSION_MISSING。"""
    conn = MagicMock()
    ext_result = MagicMock()
    ext_result.fetchone.return_value = None
    conn.execute.side_effect = [MagicMock(), ext_result]
    mock_open.return_value = conn
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "timescaledb",
            "name": "ts-r235",
            "code": f"ts-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5433,
            "database": "analytics",
            "username": "vitalspan",
            "password": "secret",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TIMESCALE_EXTENSION_MISSING"
    assert "secret" not in json.dumps(body)


@patch("app.datasources.dialects.timescaledb.PostgresConnector.list_tables")
@patch("app.datasources.dialects.timescaledb.TimescaledbConnector._hypertable_names")
@patch("app.datasources.metadata.service.pool_manager.pooled_connection")
@patch("app.datasources.dialects.timescaledb.PostgresConnector.open_connection")
def test_conn_r235_013_03_http_metadata_hypertable(
    mock_open, mock_pool, mock_hypertables, mock_list_tables, client
):
    """T-CONN-R235-013-03: HTTP metadata tables 含 type=hypertable。"""
    conn = MagicMock()
    mock_open.return_value = conn
    mock_hypertables.return_value = {"metrics"}
    mock_list_tables.return_value = [TableInfo(name="metrics", type="table")]

    @contextmanager
    def _cm(*_a, **_k):
        yield conn

    mock_pool.side_effect = _cm
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "timescaledb",
            "name": "ts-meta-r235",
            "code": f"ts-meta-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5433,
            "database": "analytics",
            "username": "vitalspan",
            "password": "x",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    tables = client.get(f"/api/v1/datasources/{ds_id}/tables?schema=public", headers=AUTH)
    assert tables.status_code == 200
    assert tables.json()["items"][0]["type"] == "hypertable"


def test_conn_r235_013_04_probe_readonly_sql():
    """T-CONN-R235-013-04: mock PG 连接 probe_readonly_sql 返回 True。"""
    conn = MagicMock()
    assert TimescaledbConnector().probe_readonly_sql(conn) is True
    conn.execute.assert_called_once_with("SELECT 1")


@pytest.mark.integration
def test_conn_r235_013_05_optional_compose_live(m11_compose_env):
    """T-CONN-R235-013-05: 5433 可达则 TimescaleDB test_connection；否则 skip。"""
    from conftest import _port_open

    if not _port_open("127.0.0.1", 5433):
        pytest.skip("TimescaleDB/analytics-postgres not running on 127.0.0.1:5433")
    result = TimescaledbConnector().test_connection(
        host="127.0.0.1",
        port=5433,
        database="analytics",
        username="vitalspan",
        password="vitalspan",
    )
    assert result.ok is True
