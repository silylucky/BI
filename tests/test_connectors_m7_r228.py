"""M7 二期数据源类型扩展批次 1 r228 — CONN-003~007 集成 + 方言差异验收。

可选 compose 服务（integration 分层 skip）：
  docker compose up -d sample-mariadb sample-clickhouse
  - sample-mariadb: 127.0.0.1:3308
  - sample-clickhouse: 127.0.0.1:8124
SQLite 使用 tests/fixtures/m7/sample.db（无需 compose）。
"""
from __future__ import annotations

import inspect
import json
import os
import time
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.core.config import get_settings
from app.datasources.dialects.clickhouse import CLICKHOUSE_MAX_COLUMNS, ClickhouseConnector
from app.datasources.dialects.hive import HiveConnector
from app.datasources.dialects.mariadb import MariadbConnector
from app.datasources.dialects.oracle import OracleConnector
from app.datasources.dialects.relational_hints import (
    build_limit_clause,
    normalize_column_type,
    quote_identifier,
)
from app.datasources.dialects.sqlite import SqliteConnector
from app.datasources.dialects.sqlserver import SqlserverConnector
from app.datasources.pool import DataSourcePoolManager
from app.datasources.registry import export_type_catalog, registry
from app.main import app
from app.query.dialects import get_sql_dialect

AUTH = jwt_auth_headers()

_R228_SQLITE_URL = "sqlite+pysqlite:///file:connectors_m7_r228?mode=memory&cache=shared&uri=true"

pytestmark = [pytest.mark.integration]


@pytest.fixture(scope="module", autouse=True)
def r228_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R228_SQLITE_URL
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


def test_conn_r228_005_01_quote_oracle():
    """T-CONN-R228-005-01: quote_identifier oracle → 大写双引号。"""
    assert quote_identifier("oracle", "My Table") == '"MY TABLE"'


def test_conn_r228_005_02_quote_sqlserver():
    """T-CONN-R228-005-02: quote_identifier sqlserver → bracket。"""
    assert quote_identifier("sqlserver", "My Table") == "[My Table]"


def test_conn_r228_005_03_build_limit_sqlserver():
    """T-CONN-R228-005-03: build_limit_clause 含 OFFSET/FETCH。"""
    clause = build_limit_clause("sqlserver", 10, 20)
    assert "OFFSET 20" in clause
    assert "FETCH NEXT 10" in clause


def test_conn_r228_005_04_normalize_oracle_number():
    """T-CONN-R228-005-04: normalize_column_type oracle NUMBER → decimal。"""
    assert normalize_column_type("oracle", "NUMBER") == "decimal"
    assert normalize_column_type("oracle", "VARCHAR2") == "string"
    assert normalize_column_type("oracle", "DATE") == "datetime"


def test_conn_r228_005_05_normalize_sqlserver_types():
    """T-CONN-R228-005-05: normalize_column_type sqlserver nvarchar/datetime2/bit。"""
    assert normalize_column_type("sqlserver", "nvarchar") == "string"
    assert normalize_column_type("sqlserver", "datetime2") == "datetime"
    assert normalize_column_type("sqlserver", "bit") == "boolean"


def test_conn_r228_003_01_mariadb_type_and_catalog():
    """T-CONN-R228-003-01: MariadbConnector.type=mariadb；catalog 含 mariadb+hive。"""
    assert MariadbConnector().type == "mariadb"
    types = {item["type"]: item for item in export_type_catalog()}
    assert "mariadb" in types
    assert types["mariadb"]["category"] == "relational"
    assert "hive" in types
    assert types["hive"]["category"] == "lake"


def test_conn_r228_003_05_registry_no_conflict():
    """T-CONN-R228-005-05 预检: registry 同时含 oracle 与 sqlserver（mariadb 注册后不冲突）。"""
    assert registry.get("mariadb") is not None
    assert registry.get("oracle") is not None
    assert registry.get("sqlserver") is not None


def test_conn_r228_003_02_mariadb_test_connection(m7_mariadb_env):
    """T-CONN-R228-003-02: compose mariadb test_connection ok=true。"""
    result = MariadbConnector().test_connection(**{k: v for k, v in m7_mariadb_env.items() if k != "_available"})
    assert result.ok is True


def test_conn_r228_003_03_mariadb_metadata(m7_mariadb_env):
    """T-CONN-R228-003-03: list_schemas 含 sample_db；list_tables 含 dirty_orders。"""
    env = {k: v for k, v in m7_mariadb_env.items() if k != "_available"}
    connector = MariadbConnector()
    conn = connector.open_connection(**env)
    try:
        schemas = [s.name for s in connector.list_schemas(conn)]
        assert "sample_db" in schemas
        tables = [t.name for t in connector.list_tables(conn, "sample_db")]
        assert "dirty_orders" in tables
    finally:
        conn.close()


def test_conn_r228_003_04_mariadb_http_chain(client, m7_mariadb_env):
    """T-CONN-R228-003-04: HTTP POST mariadb → test → GET schemas 全 200。"""
    code = f"mariadb-{uuid.uuid4().hex[:8]}"
    env = {k: v for k, v in m7_mariadb_env.items() if k != "_available"}
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": f"MariaDB M7 {code}",
            "code": code,
            "type": "mariadb",
            **env,
        },
    )
    assert create.status_code == 201
    ds_id = create.json()["id"]
    test_resp = client.post(f"/api/v1/datasources/{ds_id}/test", headers=AUTH)
    assert test_resp.status_code == 200
    assert test_resp.json()["ok"] is True
    schemas_resp = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert schemas_resp.status_code == 200


def test_conn_r228_003_06_mariadb_skip_documented():
    """T-CONN-R228-003-06: m7_mariadb_env 在无 3308 时 pytest.skip（由 conftest 保证）。"""
    import conftest

    src = inspect.getsource(conftest.m7_mariadb_env)
    assert "3308" in src
    assert "pytest.skip" in src


@patch("app.datasources.dialects.hive.HiveConnector._connect")
def test_conn_r228_003_05_hive_auth_failed_regression(mock_connect):
    """T-CONN-R228-003-05: Hive mock 失败 → HIVE_* code（r37 回归）。"""
    mock_connect.side_effect = Exception("Authentication failed: invalid credentials")
    result = HiveConnector().test_connection(
        host="127.0.0.1", port=10000, database="default", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "HIVE_AUTH_FAILED"


@patch("oracledb.connect")
def test_conn_r228_004_01_oracle_test_ok(mock_connect):
    """T-CONN-R228-004-01: mock 成功 test_connection ok=true。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="scott", password="tiger"
    )
    assert result.ok is True


@patch("oracledb.connect")
def test_conn_r228_004_02_oracle_auth_failed_stable(mock_connect):
    """T-CONN-R228-004-02: mock ORA-01017 → ORACLE_AUTH_FAILED（r37 回归）。"""
    mock_connect.side_effect = Exception("ORA-01017: invalid username/password")
    result = OracleConnector().test_connection(
        host="127.0.0.1", port=1521, database="ORCL", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "ORACLE_AUTH_FAILED"


@patch("oracledb.connect")
def test_conn_r228_004_03_http_test_failure_chain(mock_connect, client):
    """T-CONN-R228-004-03: HTTP test 失败 → 200 ok=false + code（非 500）。"""
    mock_connect.side_effect = Exception("ORA-01017: invalid username/password")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oracle",
            "name": "ora-r228",
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


@patch("oracledb.connect")
def test_conn_r228_004_04_http_no_password_leak(mock_connect, client):
    """T-CONN-R228-004-04: HTTP 响应体无明文 sample_secret。"""
    mock_connect.side_effect = Exception("ORA-12505: TNS:listener does not currently know of SID")
    secret = "sample_secret"
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oracle",
            "name": "ora-secret-r228",
            "code": f"ora-sec-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 1521,
            "database": "ORCL",
            "username": "scott",
            "password": secret,
        },
    )
    text = json.dumps(resp.json())
    assert secret not in text
    assert "password=" not in resp.text.lower()


def test_conn_r228_004_05_connectors_ext_oracledb_declared():
    """T-CONN-R228-004-05: pyproject connectors-ext 含 oracledb>=2.5.0。"""
    content = (Path(__file__).resolve().parents[1] / "backend" / "pyproject.toml").read_text()
    assert "oracledb>=2.5.0" in content


@patch("pymssql.connect")
def test_conn_r228_005_06_sqlserver_normalized_columns(mock_connect):
    """T-CONN-R228-005-06: mock list_columns 返回归一化 data_type。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("id", "int", "NO"),
        ("name", "nvarchar", "YES"),
        ("active", "bit", "NO"),
        ("created", "datetime2", "YES"),
    ]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    connector = SqlserverConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=1433, database="master", username="sa", password="pwd"
    )
    cols = connector.list_columns(connection, "dbo", "users")
    types = {c.name: c.data_type for c in cols}
    assert types["name"] == "string"
    assert types["active"] == "boolean"
    assert types["created"] == "datetime"


def test_conn_r228_005_07_pool_reuse_sqlserver():
    """T-CONN-R228-005-07: pooled_connection 同一 dataSourceId 复用连接。"""
    mgr = DataSourcePoolManager()
    ds_id = uuid.uuid4()
    connector = MagicMock()
    conn = MagicMock()
    connector.open_connection.return_value = conn
    kwargs = {"host": "127.0.0.1", "port": 1433, "database": "master", "username": "sa", "password": "pwd"}
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
        pass
    with mgr.pooled_connection(ds_id, connector=connector, connect_kwargs=kwargs):
        pass
    assert connector.open_connection.call_count == 1


def test_conn_r228_006_01_sqlite_fixture_ok(m7_sqlite_env):
    """T-CONN-R228-006-01: fixture 路径 test_connection ok=true。"""
    env = {k: v for k, v in m7_sqlite_env.items() if k != "_available"}
    result = SqliteConnector().test_connection(**env)
    assert result.ok is True


def test_conn_r228_006_02_sqlite_list_columns(m7_sqlite_env):
    """T-CONN-R228-006-02: list_columns 返回列名与类型。"""
    env = {k: v for k, v in m7_sqlite_env.items() if k != "_available"}
    connector = SqliteConnector()
    conn = connector.open_connection(host=env["host"])
    try:
        cols = connector.list_columns(conn, "main", "dirty_orders")
        names = {c.name for c in cols}
        assert "product_name" in names
        assert "amount" in names
    finally:
        conn.close()


def test_conn_r228_006_03_sqlite_path_traversal():
    """T-CONN-R228-006-03: host 含 .. → SQLITE_PATH_TRAVERSAL。"""
    result = SqliteConnector().test_connection(
        host="../../../etc/passwd", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_PATH_TRAVERSAL"


def test_conn_r228_006_04_sqlite_http_metadata(client, m7_sqlite_env):
    """T-CONN-R228-006-04: HTTP sqlite 源 metadata tables 200。"""
    code = f"sqlite-{uuid.uuid4().hex[:8]}"
    env = {k: v for k, v in m7_sqlite_env.items() if k != "_available"}
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={"name": f"SQLite M7 {code}", "code": code, "type": "sqlite", **env},
    )
    assert create.status_code == 201
    ds_id = create.json()["id"]
    tables = client.get(
        f"/api/v1/datasources/{ds_id}/tables",
        params={"schema": "main"},
        headers=AUTH,
    )
    assert tables.status_code == 200


def test_conn_r228_006_05_sqlite_file_not_found_regression():
    """T-CONN-R228-006-05: 不存在路径 → SQLITE_FILE_NOT_FOUND（r40 回归）。"""
    result = SqliteConnector().test_connection(
        host="/tmp/vitalspan_missing_r228.db", port=1, database="main", username="sqlite", password="x"
    )
    assert result.ok is False
    assert result.code == "SQLITE_FILE_NOT_FOUND"


def test_conn_r228_007_01_clickhouse_test_connection(m7_clickhouse_env):
    """T-CONN-R228-007-01: compose clickhouse test_connection ok=true。"""
    env = {k: v for k, v in m7_clickhouse_env.items() if k != "_available"}
    result = ClickhouseConnector().test_connection(**env)
    assert result.ok is True


def test_conn_r228_007_02_clickhouse_list_tables(m7_clickhouse_env):
    """T-CONN-R228-007-02: list_tables(sample_db) 含 dirty_orders。"""
    env = {k: v for k, v in m7_clickhouse_env.items() if k != "_available"}
    connector = ClickhouseConnector()
    conn = connector.open_connection(**env)
    try:
        tables = [t.name for t in connector.list_tables(conn, "sample_db")]
        assert "dirty_orders" in tables
    finally:
        conn.close()


def test_conn_r228_007_03_clickhouse_columns_limit_perf(m7_clickhouse_env):
    """T-CONN-R228-007-03: list_columns ≤500；宽表不超时（r37 perf 回归）。"""
    env = {k: v for k, v in m7_clickhouse_env.items() if k != "_available"}
    connector = ClickhouseConnector()
    conn = connector.open_connection(**env)
    try:
        started = time.perf_counter()
        cols = connector.list_columns(conn, "sample_db", "dirty_orders")
        elapsed = time.perf_counter() - started
        assert len(cols) <= CLICKHOUSE_MAX_COLUMNS
        assert elapsed < 2.0
    finally:
        conn.close()


def test_conn_r228_007_04_clickhouse_http_metadata(client, m7_clickhouse_env):
    """T-CONN-R228-007-04: HTTP metadata 链 200。"""
    code = f"ch-{uuid.uuid4().hex[:8]}"
    env = {k: v for k, v in m7_clickhouse_env.items() if k != "_available"}
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={"name": f"CH M7 {code}", "code": code, "type": "clickhouse", **env},
    )
    assert create.status_code == 201
    ds_id = create.json()["id"]
    schemas = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert schemas.status_code == 200


def test_conn_r228_007_05_get_sql_dialect_clickhouse():
    """T-CONN-R228-007-05: get_sql_dialect(clickhouse) 不抛 UnsupportedDialectError。"""
    dialect = get_sql_dialect("clickhouse")
    assert dialect is not None


def test_conn_r228_007_06_clickhouse_skip_documented():
    """T-CONN-R228-007-06: m7_clickhouse_env 在无 8124 时 pytest.skip。"""
    import conftest

    src = inspect.getsource(conftest.m7_clickhouse_env)
    assert "8124" in src
    assert "pytest.skip" in src


def test_r228_scaffold():
    """占位：fixture 可加载。"""
    assert app is not None
