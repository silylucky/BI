"""M12 Query + M11 信创/专项连接器 + META 维度 companion 质量推分 r39."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.datasources.models import get_meta_session
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R39_SQLITE_URL = "sqlite+pysqlite:///file:query_meta_conn_r39?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r39_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R39_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.metadata.dimensions.models  # noqa: F401
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
            "trino": dict(port=8080, database="hive"),
            "gaussdb": dict(port=5432, database="postgres"),
            "dm": dict(port=5236, database="DAMENG"),
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
                password="secret123",
            ),
        )
    finally:
        session.close()


def test_r39_scaffold(client):
    """T-R39-000-01: fixture 可用，/health 200。"""
    assert client.get("/health").status_code == 200


from app.datasources.dialects.errors import (
    DM_TIMEOUT,
    GAUSSDB_TIMEOUT,
    TRINO_AUTH_FAILED,
    TRINO_TIMEOUT,
    map_dm_error,
    map_gaussdb_error,
    map_trino_error,
)
from app.datasources.dialects.trino import TRINO_MAX_COLUMNS, TrinoConnector


def test_conn_trino_auth_failed_r39():
    """T-CONN-R39-010-01: mock 401 Unauthorized → TRINO_AUTH_FAILED。"""
    code, _ = map_trino_error(Exception("401 Unauthorized"))
    assert code == TRINO_AUTH_FAILED


def test_conn_trino_timeout_r39():
    """T-CONN-R39-010-02: mock timeout → TRINO_TIMEOUT。"""
    code, _ = map_trino_error(Exception("Query timed out after 30s"))
    assert code == TRINO_TIMEOUT


@patch("trino.dbapi.connect")
def test_conn_trino_columns_limit_r39(mock_connect):
    """T-CONN-R39-010-03: mock 600 列 DESCRIBE → 返回 500 + 类型非空。"""
    conn = MagicMock()
    cursor = MagicMock()
    rows = [(f"col_{i}", "VARCHAR") for i in range(600)]
    cursor.fetchall.return_value = rows
    conn.cursor.return_value = cursor
    cols = TrinoConnector().list_columns(conn, "default", "t", catalog="hive")
    assert len(cols) == TRINO_MAX_COLUMNS
    assert cols[0].data_type == "VARCHAR"


@patch("trino.dbapi.connect")
def test_conn_trino_multi_schema_r39(mock_connect):
    """T-CONN-R39-010-04: mock 多 schema → default,sales。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("default",), ("sales",)]
    conn.cursor.return_value = cursor
    names = [s.name for s in TrinoConnector().list_schemas(conn, catalog="hive")]
    assert names == ["default", "sales"]


@patch("trino.dbapi.connect")
def test_conn_trino_http_conn_refused_r39(mock_connect, client):
    """T-CONN-R39-010-05: HTTP POST test mock refused → 200 ok=false TRINO_CONN_REFUSED traceId。"""
    mock_connect.side_effect = ConnectionRefusedError("refused")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "trino",
            "name": "trino-test",
            "code": f"trino-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 8080,
            "database": "hive",
            "username": "u",
            "password": "x",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "TRINO_CONN_REFUSED"
    assert body.get("traceId")


def test_conn_trino_metadata_tables_missing_schema_400_r39(client):
    """T-CONN-R39-010-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    ds = _create_typed_ds("trino")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


from app.datasources.dialects.gaussdb import GAUSSDB_MAX_COLUMNS, GaussdbConnector


def test_conn_gaussdb_timeout_r39():
    """T-CONN-R39-022-01: mock timeout → GAUSSDB_TIMEOUT。"""
    code, _ = map_gaussdb_error(Exception("connection timed out"))
    assert code == GAUSSDB_TIMEOUT


@patch("app.datasources.dialects.gaussdb.PostgresConnector.list_columns")
def test_conn_gaussdb_columns_limit_r39(mock_list_columns):
    """T-CONN-R39-022-02: mock 600 列 → 返回 500。"""
    from app.datasources.dialects.base import ColumnInfo
    mock_list_columns.return_value = [
        ColumnInfo(name=f"c{i}", data_type="varchar", nullable=True) for i in range(600)
    ]
    conn = MagicMock()
    cols = GaussdbConnector().list_columns(conn, "public", "t")
    assert len(cols) == GAUSSDB_MAX_COLUMNS


@patch("app.datasources.dialects.gaussdb.PostgresConnector.list_schemas")
def test_conn_gaussdb_multi_schema_r39(mock_list_schemas):
    """T-CONN-R39-022-03: mock 多 schema 含 public 不含 pg_catalog（委托 PG 过滤）。"""
    from app.datasources.dialects.base import SchemaInfo
    mock_list_schemas.return_value = [
        SchemaInfo(name="public"),
        SchemaInfo(name="sales"),
    ]
    conn = MagicMock()
    names = {s.name for s in GaussdbConnector().list_schemas(conn)}
    assert "public" in names
    assert "pg_catalog" not in names


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_http_auth_failed_r39(mock_open, client):
    """T-CONN-R39-022-04: HTTP POST test mock 28P01 → GAUSSDB_AUTH_FAILED。"""
    import psycopg
    exc = psycopg.OperationalError("password authentication failed")
    exc.sqlstate = "28P01"
    mock_open.side_effect = exc
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "gaussdb",
            "name": "gauss-test",
            "code": f"gauss-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5432,
            "database": "postgres",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "GAUSSDB_AUTH_FAILED"
    assert body.get("traceId")


def test_conn_gaussdb_metadata_tables_missing_schema_400_r39(client):
    """T-CONN-R39-022-05: HTTP GET tables 缺 schema → 400。"""
    ds = _create_typed_ds("gaussdb")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


from app.datasources.dialects.dm import DmConnector


def test_conn_dm_timeout_r39():
    """T-CONN-R39-017-01: mock timeout → DM_TIMEOUT。"""
    code, _ = map_dm_error(Exception("connection timed out"))
    assert code == DM_TIMEOUT


@patch("dmPython.connect")
def test_conn_dm_multi_owner_schemas_r39(mock_connect):
    """T-CONN-R39-017-02: mock 多 owner 含 HR 不含 SYS。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [("HR",), ("APP",), ("SYS",)]
    conn.cursor.return_value = cursor
    names = {s.name for s in DmConnector().list_schemas(conn)}
    assert "HR" in names
    assert "APP" in names
    assert "SYS" not in names


@patch("dmPython.connect")
def test_conn_dm_column_types_smoke_r39(mock_connect):
    """T-CONN-R39-017-03: mock list_columns 类型枚举非空。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ("NAME", "VARCHAR", "Y"),
        ("AMT", "NUMBER", "N"),
        ("CREATED", "DATE", "Y"),
    ]
    conn.cursor.return_value = cursor
    cols = DmConnector().list_columns(conn, "HR", "EMP")
    assert len(cols) == 3
    assert {c.data_type for c in cols} == {"VARCHAR", "NUMBER", "DATE"}


@patch("dmPython.connect")
def test_conn_dm_http_no_password_leak_r39(mock_connect, client):
    """T-CONN-R39-017-04: HTTP test 失败响应不含 password 明文 secret123。"""
    mock_connect.side_effect = Exception("Login failed -2501 wrong password secret123")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "dm",
            "name": "dm-test",
            "code": f"dm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5236,
            "database": "DAMENG",
            "username": "u",
            "password": "secret123",
        },
    )
    assert resp.status_code == 200
    assert "secret123" not in resp.text


@patch("dmPython.connect")
def test_conn_dm_http_auth_failed_r39(mock_connect, client):
    """T-CONN-R39-017-05: HTTP POST test mock -2501 → DM_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Login failed -2501")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "dm",
            "name": "dm-auth",
            "code": f"dm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 5236,
            "database": "DAMENG",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["code"] == "DM_AUTH_FAILED"


def test_conn_dm_metadata_tables_missing_schema_400_r39(client):
    """T-CONN-R39-017-06: HTTP GET tables 无 schema → 400。"""
    ds = _create_typed_ds("dm")
    resp = client.get(f"/api/v1/datasources/{ds.id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


def _create_dimension(client, code: str) -> dict:
    resp = client.post(
        "/api/v1/metadata/dimensions",
        headers=AUTH,
        json={"code": code, "name": code},
    )
    assert resp.status_code == 201
    return resp.json()


def test_meta_value_invalid_empty_code_r39(client):
    """T-META-R39-003-01: POST values code='' → 422 META_DIM_VALUE_INVALID_CODE。"""
    dim = _create_dimension(client, "val_empty_code")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "", "label": "X"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_INVALID_CODE"


def test_meta_value_invalid_code_pattern_r39(client):
    """T-META-R39-003-02: POST values code=Bad-Code → 422。"""
    dim = _create_dimension(client, "val_bad_pattern")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "Bad-Code", "label": "X"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_INVALID_CODE"


def test_meta_value_duplicate_batch_r39(client):
    """T-META-R39-003-03: 批内重复 code → 422 META_DIM_VALUE_DUPLICATE_BATCH。"""
    dim = _create_dimension(client, "val_dup_batch")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "aa", "label": "A"}, {"code": "aa", "label": "B"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_DUPLICATE_BATCH"


def test_meta_value_invalid_blank_label_r39(client):
    """T-META-R39-003-04: label 仅空白 → 422 META_DIM_VALUE_INVALID_LABEL。"""
    dim = _create_dimension(client, "val_blank_label")
    resp = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "ok", "label": "   "}]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_DIM_VALUE_INVALID_LABEL"


def test_meta_value_list_pagination_r39(client):
    """T-META-R39-003-05: GET values limit=1 → len(items)==1 且 total>=2。"""
    dim = _create_dimension(client, "val_page")
    client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "v1", "label": "V1"}, {"code": "v2", "label": "V2"}]},
    )
    resp = client.get(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        params={"limit": 1, "offset": 0},
    )
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["total"] >= 2


def test_meta_dimension_list_limit_500_r39(client):
    """T-META-R39-003-06: GET dimensions limit=500 上限 smoke（与 glossary 对齐）。"""
    resp = client.get("/api/v1/metadata/dimensions", headers=AUTH, params={"limit": 500})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 500


from app.query.translator import service as translator_service
from app.query.translator.schemas import (
    TranslateConditionItem,
    TranslateConditions,
    TranslateError,
    TranslateRequest,
)


def test_query_invalid_operator_not_in_r39():
    """T-QUERY-R39-008-01: operator=not_in → QUERY_TRANSLATE_INVALID_OPERATOR。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="not_in", value=["a"], valueType="string"),
            ],
        ),
    )
    with pytest.raises(TranslateError) as exc:
        translator_service.translate_config_to_sql(req)
    assert exc.value.code == "QUERY_TRANSLATE_INVALID_OPERATOR"


def test_query_invalid_identifier_injection_r39():
    """T-QUERY-R39-008-02: columns 含注入字符 → QUERY_TRANSLATE_INVALID_IDENTIFIER。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="public",
        table="t",
        columns=["x;drop"],
    )
    with pytest.raises(TranslateError) as exc:
        translator_service.translate_config_to_sql(req)
    assert exc.value.code == "QUERY_TRANSLATE_INVALID_IDENTIFIER"


def test_query_mysql_in_three_params_r39():
    """T-QUERY-R39-008-03: mysql in 三值 → 3 占位符 + parameters 3 键。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="db",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(
                    fieldId="status", operator="in", value=["a", "b", "c"], valueType="string",
                ),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert resp.sql.count("%(p") == 3
    assert len(resp.parameters) == 3
    assert "'a'" not in resp.sql and "'b'" not in resp.sql


def test_query_postgresql_or_logic_r39():
    """T-QUERY-R39-008-04: postgresql logic=OR 双条件 → SQL 含 OR。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="OR",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="eq", value="a", valueType="string"),
                TranslateConditionItem(fieldId="order_amount", operator="eq", value=1, valueType="number"),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert " OR " in resp.sql


def test_query_clickhouse_like_placeholder_r39():
    """T-QUERY-R39-008-05: clickhouse like → {p0:String}。"""
    req = TranslateRequest(
        connectorType="clickhouse",
        schema="default",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="like", value="%x%", valueType="string"),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "{p0:String}" in resp.sql


def test_query_in_non_array_r39():
    """T-QUERY-R39-008-06: in + 非 array value → QUERY_TRANSLATE_INVALID_CONFIG。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="db",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="in", value="not-array", valueType="string"),
            ],
        ),
    )
    with pytest.raises(TranslateError) as exc:
        translator_service.translate_config_to_sql(req)
    assert exc.value.code == "QUERY_TRANSLATE_INVALID_CONFIG"


def test_query_http_invalid_operator_r39(client):
    """T-QUERY-R39-008-07: HTTP POST 非法算子 contains → 422 + code。"""
    payload = {
        "connectorType": "postgresql",
        "schema": "public",
        "table": "t",
        "columns": ["status"],
        "conditions": {
            "logic": "AND",
            "conditions": [
                {"fieldId": "status", "operator": "contains", "value": "x", "valueType": "string"},
            ],
        },
    }
    resp = client.post("/api/v1/query/translate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_INVALID_OPERATOR"


def test_query_sql_injection_guard_r39():
    """T-QUERY-R39-008-08: 恶意 value 不在 SQL 字面量中。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(
                    fieldId="status",
                    operator="eq",
                    value="' OR 1=1 --",
                    valueType="string",
                ),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "' OR 1=1 --" not in resp.sql
    assert "%(p0)s" in resp.sql
    assert resp.parameters["p0"] == "' OR 1=1 --"


def test_r38_r37_regression_import_r39():
    """T-R39-999-01: r38/r37 套件可 import 且无命名冲突。"""
    import importlib

    r38 = importlib.import_module("test_query_meta_conn_r38")
    r37 = importlib.import_module("test_connectors_gov_r37")
    assert r38 is not None and r37 is not None
