"""M11 连接器 + M13 治理 companion 质量推分 r35 — CONN-021/009/015 + GOV-004/008."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.datasources.dialects.tidb import TidbConnector
from app.datasources.registry import export_type_catalog
from app.main import app

_R35_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r35?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r35_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R35_SQLITE_URL
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


def test_tidb_types_catalog_r35():
    """T-CONN-R35-021-01: types 含 tidb relational schema_browser。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tidb" in types
    assert types["tidb"]["category"] == "relational"
    assert "schema_browser" in types["tidb"]["capabilities"]


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_test_connection_ok_r35(mock_connect):
    """T-CONN-R35-021-02: mock ping 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is True
    conn.ping.assert_called_once_with(reconnect=False)


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_auth_failed_r35(mock_connect):
    """T-CONN-R35-021-03: mock 1045 → TIDB_AUTH_FAILED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "TIDB_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_conn_refused_r35(mock_connect):
    """T-CONN-R35-021-04: mock 2003 → TIDB_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "TIDB_CONN_REFUSED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_timeout_r35(mock_connect):
    """T-CONN-R35-021-05: mock 2013 → TIDB_TIMEOUT。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2013, "Lost connection: timeout")
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "TIDB_TIMEOUT"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_empty_schemas_r35(mock_connect):
    """T-CONN-R35-021-06: mock 空 schemas → list_schemas []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = TidbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert connector.list_schemas(connection) == []


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_unknown_table_columns_r35(mock_connect):
    """T-CONN-R35-021-07: mock 未知表零行 → list_columns []。"""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    conn.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = conn
    connector = TidbConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert connector.list_columns(connection, "missing_db", "missing_tbl") == []


from app.datasources.dialects.starrocks import StarrocksConnector


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_conn_refused_r35(mock_connect):
    """T-CONN-R35-009-01: mock 2003 → STARROCKS_CONN_REFUSED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "STARROCKS_CONN_REFUSED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_auth_failed_r35(mock_connect):
    """T-CONN-R35-009-02: mock 1045 → STARROCKS_AUTH_FAILED。"""
    mock_connect.side_effect = pymysql.err.OperationalError(1045, "Access denied")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="bad", password="bad"
    )
    assert result.ok is False
    assert result.code == "STARROCKS_AUTH_FAILED"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_empty_schema_tables_r35(mock_connect):
    """T-CONN-R35-009-03: schema='' → list_tables []。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    connector = StarrocksConnector()
    connection = connector.open_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert connector.list_tables(connection, "") == []


def test_starrocks_columns_limit_r35():
    """T-CONN-R35-009-04: 600 列 mock → 返回 500。"""
    from app.datasources.dialects.base import ColumnInfo

    connector = StarrocksConnector()
    connector._inner.list_columns = MagicMock(
        return_value=[
            ColumnInfo(name=f"col_{i}", data_type="varchar", nullable=True) for i in range(600)
        ]
    )
    cols = connector.list_columns(MagicMock(), "db", "wide_tbl")
    assert len(cols) == 500
    assert cols[0].name == "col_0"
    assert cols[-1].name == "col_499"


def test_starrocks_types_catalog_r35():
    """T-CONN-R35-009-05: types 含 starrocks category olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert types["starrocks"]["category"] == "olap"


def _valid_visual_query_design(ref_id: str | None = None) -> dict:
    rid = ref_id or str(uuid.uuid4())
    return {
        "schemaVersion": "1.0",
        "refType": "gov_query_design",
        "refId": rid,
        "title": "销售分析",
        "status": "draft",
        "conditions": {
            "schemaVersion": "1.0",
            "logic": "AND",
            "conditions": [
                {"fieldId": "order_amount", "operator": "gte", "value": 100, "valueType": "number"}
            ],
            "refType": "design_draft",
            "refId": rid,
        },
    }


def test_gov_preview_execute_viewer_forbidden_r35(client):
    """T-GOV-R35-008-01: viewer POST preview-execute → 403 GOV_ACL_FORBIDDEN。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-1", username="viewer", roles=["viewer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "GOV_ACL_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.resolve_user_org_node_ids", return_value=set())
def test_gov_preview_execute_designer_no_binding_r35(_mock_org, client):
    """T-GOV-R35-008-02: designer 无 org → 403 GOV_RLS_BINDING_REQUIRED。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="designer-1", username="designer", roles=["designer"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "GOV_RLS_BINDING_REQUIRED"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="t.org_node_id IN ('n1')")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_preview_execute_admin_ok_r35(_mock_org, _mock_rls, client):
    """T-GOV-R35-008-03: admin → 200 且 rlsFragment 非空。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 200
        assert resp.json()["rlsFragment"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="t.org_node_id IN ('n1')")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_preview_execute_admin_bypass_audit_r35(_mock_org, _mock_rls, client, caplog):
    """T-GOV-R35-008-04: admin bypass 触发 gov_acl_bypass 日志。"""
    import logging

    caplog.set_level(logging.INFO, logger="app.governance.acl")
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 200
        assert any("gov_acl_bypass" in r.message for r in caplog.records)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="1=0")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_preview_execute_empty_rls_chain_r35(_mock_org, _mock_rls, client):
    """T-GOV-R35-008-05: 空 RLS 链 → 200 且 rlsFragment == '1=0'。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        resp = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert resp.status_code == 200
        assert resp.json()["rlsFragment"] == "1=0"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.get_query_rls_fragment", return_value="1=1")
@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
def test_gov_save_then_preview_execute_r35(_mock_org, _mock_rls, client):
    """T-GOV-R35-008-06: save draft 后 preview-execute 联合 200。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        ref = str(uuid.uuid4())
        save = client.put(
            "/api/v1/gov/query-design", headers=AUTH, json=_valid_visual_query_design(ref)
        )
        assert save.status_code == 200
        preview = client.post(
            "/api/v1/gov/query-design/preview-execute",
            headers=AUTH,
            json={"dataSourceId": None},
        )
        assert preview.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _valid_compute_rules_embedded(ref_id: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "rules": [
            {
                "id": "total_amount",
                "name": "合计",
                "ruleType": "sum",
                "targetField": "order_amount",
                "expression": "sum(order_amount)",
                "dependsOn": [],
            }
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }


def test_gov_validate_empty_conditions_r35(client):
    """T-GOV-R35-004-01: conditions:[] → 422 DESIGN_EMPTY_CONDITIONS + fields。"""
    body = _valid_visual_query_design()
    body["conditions"]["conditions"] = []
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_CONDITIONS"
    assert resp.json()["detail"]["fields"]


def test_gov_validate_invalid_aggregate_r35(client):
    """T-GOV-R35-004-02: computeRules median(x) → 422 DESIGN_INVALID_AGGREGATE。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    rules = _valid_compute_rules_embedded(ref)
    rules["rules"][0]["expression"] = "median(order_amount)"
    body["computeRules"] = rules
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"
    assert resp.json()["detail"]["fields"]


def test_gov_validate_blank_title_r35(client):
    """T-GOV-R35-004-03: blank title → 422 GOV_QUERY_DESIGN_INVALID。"""
    body = _valid_visual_query_design()
    body["title"] = "   "
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_INVALID"
    assert resp.json()["detail"]["fields"][0]["field"] == "title"


def test_gov_validate_unknown_datasource_r35(client):
    """T-GOV-R35-004-04: 随机 dataSourceId → 422 GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE。"""
    body = _valid_visual_query_design()
    body["dataSourceId"] = str(uuid.uuid4())
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_UNKNOWN_DATASOURCE"
    assert resp.json()["detail"]["fields"][0]["field"] == "dataSourceId"


def test_gov_get_not_found_r35(client):
    """T-GOV-R35-004-05: 随机 ref → 404 GOV_QUERY_DESIGN_NOT_FOUND。"""
    resp = client.get(
        "/api/v1/gov/query-design",
        headers=AUTH,
        params={"refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "GOV_QUERY_DESIGN_NOT_FOUND"


def test_gov_revision_conflict_r35(client):
    """T-GOV-R35-004-06: expectedRevision 冲突 → 409 CONFIG_VERSION_CONFLICT。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    first = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert first.status_code == 200
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"


def test_gov_save_get_roundtrip_r35(client):
    """T-GOV-R35-004-07: 合法 save + get revision 一致。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    save = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert save.status_code == 200
    rev = save.json()["revision"]
    got = client.get("/api/v1/gov/query-design", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["revision"] == rev


from app.datasources.dialects.elasticsearch import ElasticsearchConnector, _build_client
from jwt_auth import AUTH, jwt_auth_headers


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_auth_failed_r35(mock_es_cls):
    """T-CONN-R35-015-01: mock 401 → ES_AUTH_FAILED。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.side_effect = Exception("authentication failed 401")
    result = ElasticsearchConnector().test_connection(
        host="127.0.0.1", port=9200, database="", username="u", password="p"
    )
    assert result.ok is False
    assert result.code == "ES_AUTH_FAILED"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_connection_refused_r35(mock_es_cls):
    """T-CONN-R35-015-02: connection refused → ES_CONNECTION_REFUSED。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.side_effect = Exception("Connection refused")
    result = ElasticsearchConnector().test_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    assert result.ok is False
    assert result.code == "ES_CONNECTION_REFUSED"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_timeout_r35(mock_es_cls):
    """T-CONN-R35-015-03: timeout → ES_TIMEOUT。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.side_effect = Exception("Connection timed out")
    result = ElasticsearchConnector().test_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    assert result.ok is False
    assert result.code == "ES_TIMEOUT"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_multi_index_schemas_r35(mock_es_cls):
    """T-CONN-R35-015-04: 多索引 list_schemas 含 2 个非系统 index。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.cat.indices.return_value = [
        {"index": "orders"},
        {"index": "events"},
        {"index": ".system"},
    ]
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    names = [s.name for s in ElasticsearchConnector().list_schemas(conn)]
    assert names == ["events", "orders"]


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_empty_mapping_columns_r35(mock_es_cls):
    """T-CONN-R35-015-05: 空 mapping → list_columns []。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": {}}}}
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    assert ElasticsearchConnector().list_columns(conn, "idx", "_doc") == []


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_type_normalization_r35(mock_es_cls):
    """T-CONN-R35-015-06: keyword/long → string/number。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.indices.get_mapping.return_value = {
        "idx": {"mappings": {"properties": {"status": {"type": "keyword"}, "amount": {"type": "long"}}}}
    }
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    cols = {c.name: c.data_type for c in ElasticsearchConnector().list_columns(conn, "idx", "_doc")}
    assert cols["status"] == "string"
    assert cols["amount"] == "number"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_columns_limit_r35(mock_es_cls):
    """T-CONN-R35-015-07: 600 fields → 返回 500。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    props = {f"f{i}": {"type": "keyword"} for i in range(600)}
    client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    conn = ElasticsearchConnector().open_connection(
        host="127.0.0.1", port=9200, database="", username="", password=""
    )
    cols = ElasticsearchConnector().list_columns(conn, "idx", "_doc")
    assert len(cols) == 500


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_es_https_port_443_r35(mock_es_cls):
    """T-CONN-R35-015-08: port 443 → hosts 含 https://。"""
    mock_es_cls.return_value = MagicMock()
    _build_client(host="es.example.com", port=443, username="", password="", timeout_sec=5.0)
    kwargs = mock_es_cls.call_args.kwargs
    assert kwargs["hosts"][0].startswith("https://")


def test_registry_core_types_r35():
    """T-REG-R35-001: mysql/postgresql/tidb/starrocks/elasticsearch 均在 catalog。"""
    types = {item["type"] for item in export_type_catalog()}
    assert {"mysql", "postgresql", "tidb", "starrocks", "elasticsearch"}.issubset(types)


def test_meta_design_r33_regression_r35():
    """T-REG-R35-002: r33 套件可导入（完整回归在本 Task）。"""
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "test_meta_design_r33",
        Path(__file__).resolve().parent / "test_meta_design_r33.py",
    )
    assert spec is not None and spec.loader is not None
    r33 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r33)
    assert hasattr(r33, "test_design_invalid_aggregate_r33")
