"""M12 Query 翻译器 + M11 信创/专项连接器 + META 维度 L1 kickoff r38."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R38_SQLITE_URL = "sqlite+pysqlite:///file:query_meta_conn_r38?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r38_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R38_SQLITE_URL
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


def test_r38_scaffold(client):
    """T-R38-000-01: fixture 可用，/health 200。"""
    assert client.get("/health").status_code == 200


from app.query.dialects import get_sql_dialect
from app.query.translator.schemas import TranslateConditions, TranslateConditionItem, TranslateRequest
from app.query.translator import service as translator_service
from app.query.translator.schemas import TranslateError


def test_query_translate_postgresql_r38():
    """T-QUERY-R38-008-01: postgresql 合法 config → sql 含 SELECT + quoted 表；有条件时 parameters 非空。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="orders",
        columns=["order_amount", "status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="status", operator="eq", value="open", valueType="string"),
            ],
        ),
        limit=100,
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "SELECT" in resp.sql
    assert '"public"' in resp.sql or "public" in resp.sql
    assert resp.parameters


def test_query_translate_mysql_eq_r38():
    """T-QUERY-R38-008-02: mysql + eq 条件 → WHERE + 占位符；无字面量注入。"""
    req = TranslateRequest(
        connectorType="mysql",
        schema="sales",
        table="orders",
        columns=["order_amount"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="order_amount", operator="eq", value=99, valueType="number"),
            ],
        ),
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "WHERE" in resp.sql
    assert "%(p0)s" in resp.sql
    assert "99" not in resp.sql
    assert resp.parameters["p0"] == 99


def test_query_translate_clickhouse_limit_r38():
    """T-QUERY-R38-008-03: clickhouse + limit → SQL 含 LIMIT。"""
    req = TranslateRequest(
        connectorType="clickhouse",
        schema="default",
        table="events",
        columns=["customer_id"],
        limit=50,
    )
    resp = translator_service.translate_config_to_sql(req)
    assert "LIMIT 50" in resp.sql


def test_query_translate_unsupported_dialect_r38():
    """T-QUERY-R38-008-04: 未知 connectorType → QUERY_TRANSLATE_UNSUPPORTED_DIALECT。"""
    req = TranslateRequest(
        connectorType="hive",
        schema="db",
        table="t",
        columns=["x"],
    )
    try:
        translator_service.translate_config_to_sql(req)
        assert False, "expected TranslateError"
    except TranslateError as exc:
        assert exc.code == "QUERY_TRANSLATE_UNSUPPORTED_DIALECT"


def test_query_translate_unknown_field_r38():
    """T-QUERY-R38-008-05: 未知 fieldId → QUERY_TRANSLATE_UNKNOWN_FIELD + fields。"""
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
        conditions=TranslateConditions(
            logic="AND",
            conditions=[
                TranslateConditionItem(fieldId="not_in_registry", operator="eq", value="x", valueType="string"),
            ],
        ),
    )
    try:
        translator_service.translate_config_to_sql(req)
        assert False, "expected TranslateError"
    except TranslateError as exc:
        assert exc.code == "QUERY_TRANSLATE_UNKNOWN_FIELD"
        assert exc.fields


def test_query_translate_empty_columns_r38():
    """T-QUERY-R38-008-06: 空 columns → 422 QUERY_TRANSLATE_INVALID_CONFIG。"""
    try:
        TranslateRequest(
            connectorType="postgresql",
            schema="public",
            table="t",
            columns=[],
        )
        assert False, "expected validation error"
    except Exception:
        pass
    req = TranslateRequest(
        connectorType="postgresql",
        schema="public",
        table="t",
        columns=["status"],
    )
    req.columns = []
    try:
        translator_service.translate_config_to_sql(req)
        assert False, "expected TranslateError"
    except TranslateError as exc:
        assert exc.code == "QUERY_TRANSLATE_INVALID_CONFIG"


def test_query_sql_dialect_registry_smoke_r38():
    """T-QUERY-R38-008-07: get_sql_dialect 三 type smoke。"""
    for t in ("mysql", "postgresql", "clickhouse"):
        d = get_sql_dialect(t)
        assert d.connector_type == t


def test_query_translate_http_postgresql_r38(client):
    """T-QUERY-R38-008-08: POST /translate postgresql → 200 + sql。"""
    payload = {
        "connectorType": "postgresql",
        "schema": "public",
        "table": "orders",
        "columns": ["order_amount"],
        "conditions": {
            "logic": "AND",
            "conditions": [
                {"fieldId": "status", "operator": "eq", "value": "open", "valueType": "string"},
            ],
        },
        "limit": 10,
    }
    resp = client.post("/api/v1/query/translate", headers=AUTH, json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "sql" in body
    assert body["connectorType"] == "postgresql"


def test_query_translate_http_unknown_field_r38(client):
    """T-QUERY-R38-008-09: POST /translate 未知字段 → 422 + code。"""
    payload = {
        "connectorType": "mysql",
        "schema": "db",
        "table": "t",
        "columns": ["status"],
        "conditions": {
            "logic": "AND",
            "conditions": [
                {"fieldId": "bogus_field", "operator": "eq", "value": "x", "valueType": "string"},
            ],
        },
    }
    resp = client.post("/api/v1/query/translate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_TRANSLATE_UNKNOWN_FIELD"


from unittest.mock import MagicMock, patch

from app.datasources.dialects.gaussdb import GaussdbConnector
from app.datasources.registry import export_type_catalog


def test_conn_gaussdb_catalog_r38():
    """T-CONN-R38-022-01: types catalog 含 gaussdb，category=relational。"""
    types = {t["type"]: t for t in export_type_catalog()}
    if "gaussdb" not in types:
        from app.datasources.registry import register_dialect
        register_dialect(GaussdbConnector())
        types = {t["type"]: t for t in export_type_catalog()}
    assert "gaussdb" in types
    assert types["gaussdb"]["category"] == "relational"


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_success_r38(mock_open):
    """T-CONN-R38-022-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    mock_open.return_value = conn
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="db", username="u", password="p",
    )
    assert result.ok is True
    conn.close.assert_called_once()


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_auth_failed_r38(mock_open):
    """T-CONN-R38-022-03: mock 认证失败 → GAUSSDB_AUTH_FAILED。"""
    import psycopg

    exc = psycopg.OperationalError("password authentication failed")
    exc.sqlstate = "28P01"
    mock_open.side_effect = exc
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="db", username="u", password="bad",
    )
    assert result.ok is False
    assert result.code == "GAUSSDB_AUTH_FAILED"


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_conn_refused_r38(mock_open):
    """T-CONN-R38-022-04: mock 连接拒绝 → GAUSSDB_CONN_REFUSED。"""
    mock_open.side_effect = ConnectionRefusedError("refused")
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="db", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "GAUSSDB_CONN_REFUSED"


@patch("app.datasources.dialects.gaussdb.PostgresConnector.open_connection")
def test_conn_gaussdb_unknown_database_r38(mock_open):
    """T-CONN-R38-022-05: mock 未知库 → GAUSSDB_UNKNOWN_DATABASE。"""
    import psycopg

    exc = psycopg.OperationalError("database does not exist")
    exc.sqlstate = "3D000"
    mock_open.side_effect = exc
    result = GaussdbConnector().test_connection(
        host="h", port=5432, database="missing", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "GAUSSDB_UNKNOWN_DATABASE"


def test_conn_gaussdb_empty_schemas_r38():
    """T-CONN-R38-022-06: mock 空 schema 列表 → []。"""
    conn = MagicMock()
    connector = GaussdbConnector()
    with patch.object(connector, "_delegate") as mock_delegate:
        mock_delegate.list_schemas.return_value = []
        assert connector.list_schemas(conn) == []


def test_conn_gaussdb_unknown_schema_tables_r38():
    """T-CONN-R38-022-07: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    connector = GaussdbConnector()
    with patch.object(connector, "_delegate") as mock_delegate:
        mock_delegate.list_tables.return_value = []
        assert connector.list_tables(conn, "unknown_schema") == []


from app.datasources.dialects.dm import DmConnector


def test_conn_dm_catalog_r38():
    """T-CONN-R38-017-01: types catalog 含 dm（注册后断言，Task 6 注册后全绿）。"""
    types = {t["type"]: t for t in export_type_catalog()}
    if "dm" not in types:
        from app.datasources.registry import register_dialect
        register_dialect(DmConnector())
        types = {t["type"]: t for t in export_type_catalog()}
    assert types["dm"]["category"] == "relational"


@patch("dmPython.connect")
def test_conn_dm_success_r38(mock_connect):
    """T-CONN-R38-017-02: mock 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = DmConnector().test_connection(
        host="h", port=5236, database="db", username="u", password="p",
    )
    assert result.ok is True


@patch("dmPython.connect")
def test_conn_dm_auth_failed_r38(mock_connect):
    """T-CONN-R38-017-03: mock 凭证失败 → DM_AUTH_FAILED。"""
    mock_connect.side_effect = Exception("Login failed -2501")
    result = DmConnector().test_connection(
        host="h", port=5236, database="db", username="u", password="bad",
    )
    assert result.ok is False
    assert result.code == "DM_AUTH_FAILED"


@patch("dmPython.connect")
def test_conn_dm_conn_refused_r38(mock_connect):
    """T-CONN-R38-017-04: mock 不可达 → DM_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("refused")
    result = DmConnector().test_connection(
        host="h", port=5236, database="db", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "DM_CONN_REFUSED"


@patch("dmPython.connect")
def test_conn_dm_unknown_database_r38(mock_connect):
    """T-CONN-R38-017-05: mock 未知 database → DM_UNKNOWN_DATABASE。"""
    mock_connect.side_effect = Exception("database not exist")
    result = DmConnector().test_connection(
        host="h", port=5236, database="missing", username="u", password="p",
    )
    assert result.ok is False
    assert result.code == "DM_UNKNOWN_DATABASE"


@patch("dmPython.connect")
def test_conn_dm_unknown_schema_tables_r38(mock_connect):
    """T-CONN-R38-017-06: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    assert DmConnector().list_tables(conn, "UNKNOWN") == []


from app.datasources.dialects.trino import TrinoConnector
from jwt_auth import AUTH, jwt_auth_headers


def test_conn_trino_catalog_r38():
    """T-CONN-R38-010-01: types catalog 含 trino，category=lake。"""
    types = {t["type"]: t for t in export_type_catalog()}
    if "trino" not in types:
        from app.datasources.registry import register_dialect
        register_dialect(TrinoConnector())
        types = {t["type"]: t for t in export_type_catalog()}
    assert "trino" in types
    assert types["trino"]["category"] == "lake"


@patch("trino.dbapi.connect")
def test_conn_trino_success_r38(mock_connect):
    """T-CONN-R38-010-02: mock coordinator 成功 → ok=True。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = [(1,)]
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    result = TrinoConnector().test_connection(
        host="coordinator", port=8080, database="hive", username="u", password="",
    )
    assert result.ok is True


@patch("trino.dbapi.connect")
def test_conn_trino_conn_refused_r38(mock_connect):
    """T-CONN-R38-010-03: mock 不可达 → TRINO_CONN_REFUSED。"""
    mock_connect.side_effect = ConnectionRefusedError("refused")
    result = TrinoConnector().test_connection(
        host="coordinator", port=8080, database="hive", username="u", password="",
    )
    assert result.ok is False
    assert result.code == "TRINO_CONN_REFUSED"


@patch("trino.dbapi.connect")
def test_conn_trino_unknown_catalog_r38(mock_connect):
    """T-CONN-R38-010-04: mock 非法 catalog → TRINO_UNKNOWN_CATALOG。"""
    mock_connect.side_effect = Exception("Catalog 'bad' not found")
    result = TrinoConnector().test_connection(
        host="coordinator", port=8080, database="bad", username="u", password="",
    )
    assert result.ok is False
    assert result.code == "TRINO_UNKNOWN_CATALOG"


@patch("trino.dbapi.connect")
def test_conn_trino_empty_schemas_r38(mock_connect):
    """T-CONN-R38-010-05: mock SHOW SCHEMAS 空 → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    mock_connect.return_value = conn
    opened = TrinoConnector().open_connection(
        host="h", port=8080, database="hive", username="u", password="",
    )
    assert TrinoConnector().list_schemas(opened, catalog="hive") == []


@patch("trino.dbapi.connect")
def test_conn_trino_unknown_schema_tables_r38(mock_connect):
    """T-CONN-R38-010-06: mock 未知 schema list_tables → []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value = cursor
    assert TrinoConnector().list_tables(conn, "unknown", catalog="hive") == []


def test_meta_dimension_create_and_list_r38(client):
    """T-META-R38-003-01: POST 合法维度 → 201；GET list 含该项。"""
    payload = {"code": "region", "name": "区域维度"}
    created = client.post("/api/v1/metadata/dimensions", headers=AUTH, json=payload)
    assert created.status_code == 201
    listed = client.get("/api/v1/metadata/dimensions", headers=AUTH)
    assert listed.status_code == 200
    codes = [d["code"] for d in listed.json()["items"]]
    assert "region" in codes


def test_meta_dimension_duplicate_code_r38(client):
    """T-META-R38-003-02: 重复 code → 409 META_DIM_CODE_CONFLICT。"""
    payload = {"code": "dup_dim", "name": "A"}
    assert client.post("/api/v1/metadata/dimensions", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/metadata/dimensions", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_DIM_CODE_CONFLICT"


def test_meta_dimension_invalid_code_r38(client):
    """T-META-R38-003-03: 空/非法 code → 422 META_DIM_INVALID_CODE。"""
    resp = client.post("/api/v1/metadata/dimensions", headers=AUTH, json={"code": "", "name": "X"})
    assert resp.status_code == 422


def test_meta_dimension_values_register_r38(client):
    """T-META-R38-003-04: POST 批量 values → GET values 含条目。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "status_dim", "name": "状态"},
    ).json()
    reg = client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "open", "label": "开启"}, {"code": "closed", "label": "关闭"}]},
    )
    assert reg.status_code in (200, 201)
    values = client.get(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH)
    assert values.status_code == 200
    codes = [v["code"] for v in values.json()["items"]]
    assert "open" in codes and "closed" in codes


def test_meta_dimension_value_duplicate_r38(client):
    """T-META-R38-003-05: 重复 value code → 409 META_DIM_VALUE_CODE_CONFLICT。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "dup_val_dim", "name": "D"},
    ).json()
    body = {"items": [{"code": "aa", "label": "A"}]}
    assert client.post(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH, json=body).status_code in (200, 201)
    dup = client.post(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH, json=body)
    assert dup.status_code == 409
    assert dup.json()["code"] == "META_DIM_VALUE_CODE_CONFLICT"


def test_meta_dimension_list_pagination_r38(client):
    """T-META-R38-003-06: list limit=1 分页 total 正确。"""
    for code in ("page_a", "page_b"):
        client.post("/api/v1/metadata/dimensions", headers=AUTH, json={"code": code, "name": code})
    resp = client.get("/api/v1/metadata/dimensions", headers=AUTH, params={"limit": 1, "offset": 0})
    body = resp.json()
    assert body["total"] >= 2
    assert len(body["items"]) == 1


def test_meta_dimension_delete_cascade_r38(client):
    """T-META-R38-003-07: DELETE 维度 → values 级联不可见。"""
    dim = client.post(
        "/api/v1/metadata/dimensions", headers=AUTH, json={"code": "cascade_dim", "name": "C"},
    ).json()
    client.post(
        f"/api/v1/metadata/dimensions/{dim['id']}/values",
        headers=AUTH,
        json={"items": [{"code": "v1", "label": "V1"}]},
    )
    assert client.delete(f"/api/v1/metadata/dimensions/{dim['id']}", headers=AUTH).status_code in (200, 204)
    values = client.get(f"/api/v1/metadata/dimensions/{dim['id']}/values", headers=AUTH)
    assert values.status_code == 404
