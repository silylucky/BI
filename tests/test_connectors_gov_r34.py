"""M11 连接器 + M13 治理 L1 kickoff r34 — CONN-021/009/015 + GOV-004/008."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings

from app.datasources.dialects.tidb import TidbConnector
from app.datasources.registry import export_type_catalog
from app.main import app

_R34_SQLITE_URL = "sqlite+pysqlite:///file:connectors_gov_r34?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r34_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R34_SQLITE_URL
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


def test_tidb_in_types_catalog_r34():
    """T-CONN-R34-021-01: types 含 tidb relational。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "tidb" in types
    assert types["tidb"]["category"] == "relational"
    assert "schema_browser" in types["tidb"]["capabilities"]


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_tidb_test_connection_ok_r34(mock_connect):
    """T-CONN-R34-021-02: mock pymysql 成功 → ok=True。"""
    conn = MagicMock()
    mock_connect.return_value = conn
    result = TidbConnector().test_connection(
        host="127.0.0.1", port=4000, database="test", username="root", password=""
    )
    assert result.ok is True
    conn.ping.assert_called_once_with(reconnect=False)
    conn.close.assert_called_once()


import pymysql.err

from app.datasources.dialects.starrocks import StarrocksConnector


def test_starrocks_in_types_catalog_r34():
    """T-CONN-R34-009-01: types 含 starrocks category olap。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "starrocks" in types
    assert types["starrocks"]["category"] == "olap"


@patch("app.datasources.dialects.mysql.pymysql.connect")
def test_starrocks_timeout_structured_r34(mock_connect):
    """T-CONN-R34-009-02: 超时 OperationalError → ok=False 且 message 含 timeout 语义。"""
    mock_connect.side_effect = pymysql.err.OperationalError(2013, "Lost connection: timeout expired")
    result = StarrocksConnector().test_connection(
        host="127.0.0.1", port=9030, database="test", username="root", password=""
    )
    assert result.ok is False
    assert result.code == "STARROCKS_TIMEOUT"
    assert "timeout" in result.message.lower()


from app.datasources.dialects.elasticsearch import ElasticsearchConnector
from jwt_auth import AUTH, jwt_auth_headers


def test_elasticsearch_in_types_catalog_r34():
    """T-CONN-R34-015-01: types 含 elasticsearch category search。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "elasticsearch" in types
    assert types["elasticsearch"]["category"] == "search"


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_elasticsearch_list_schemas_and_columns_r34(mock_es_cls):
    """T-CONN-R34-015-02: mock index list + mapping columns。"""
    client = MagicMock()
    mock_es_cls.return_value = client
    client.info.return_value = {"version": {"number": "8.11.0"}}
    client.cat.indices.return_value = [{"index": "orders"}, {"index": ".system"}]
    client.indices.get_mapping.return_value = {
        "orders": {"mappings": {"properties": {"amount": {"type": "long"}, "status": {"type": "keyword"}}}}
    }
    connector = ElasticsearchConnector()
    ok = connector.test_connection(host="127.0.0.1", port=9200, database="", username="", password="")
    assert ok.ok is True
    conn = connector.open_connection(host="127.0.0.1", port=9200, database="", username="", password="")
    schemas = connector.list_schemas(conn)
    assert [s.name for s in schemas] == ["orders"]
    tables = connector.list_tables(conn, "orders")
    assert tables[0].name == "_doc"
    cols = connector.list_columns(conn, "orders", "_doc")
    assert {c.name for c in cols} == {"amount", "status"}


def test_elasticsearch_invalid_host_r34():
    """T-CONN-R34-015-03: 空 host → ok=False 结构化。"""
    result = ElasticsearchConnector().test_connection(
        host="", port=9200, database="", username="", password=""
    )
    assert result.ok is False
    assert result.code == "ES_INVALID_HOST"


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


def test_gov_query_design_validate_ok_r34(client):
    """T-GOV-R34-004-01: 合法 conditions → validate 200。"""
    resp = client.post(
        "/api/v1/gov/query-design/validate", headers=AUTH, json=_valid_visual_query_design()
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "销售分析"


def test_gov_query_design_unknown_field_r34(client):
    """T-GOV-R34-004-02: 未知 fieldId → 422 + detail.fields。"""
    body = _valid_visual_query_design()
    body["conditions"]["conditions"][0]["fieldId"] = "bad_field"
    resp = client.post("/api/v1/gov/query-design/validate", headers=AUTH, json=body)
    assert resp.status_code == 422
    assert resp.json()["detail"]["fields"]


def test_gov_query_design_save_get_revision_r34(client):
    """T-GOV-R34-004-03: save + GET round-trip revision 递增。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    save = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert save.status_code == 200
    assert save.json()["revision"] == 1
    got = client.get("/api/v1/gov/query-design", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["revision"] == 1
    assert got.json()["title"] == "销售分析"


def test_gov_query_design_revision_conflict_r34(client):
    """T-GOV-R34-004-04: expectedRevision 冲突 → 409 CONFIG_VERSION_CONFLICT。"""
    ref = str(uuid.uuid4())
    body = _valid_visual_query_design(ref)
    first = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert first.status_code == 200
    body["expectedRevision"] = 0
    conflict = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "CONFIG_VERSION_CONFLICT"


def test_gov_acl_pending_publish_forbidden_r34(client):
    """T-GOV-R34-008-01: 普通用户 save pending_publish → 403 GOV_ACL_FORBIDDEN。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer-1", username="viewer", roles=["viewer"]
    )
    try:
        body = _valid_visual_query_design()
        body["status"] = "pending_publish"
        resp = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
        assert resp.status_code == 403
        assert resp.json()["code"] == "GOV_ACL_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.governance.acl.resolve_user_org_node_ids", return_value={uuid.uuid4()})
@patch("app.governance.acl.get_query_rls_fragment", return_value="1=1")
def test_gov_acl_admin_pending_publish_ok_r34(_mock_rls, _mock_org, client):
    """T-GOV-R34-008-02: admin save pending_publish 200。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="admin-1", username="admin", roles=["admin"]
    )
    try:
        body = _valid_visual_query_design()
        body["status"] = "pending_publish"
        resp = client.put("/api/v1/gov/query-design", headers=AUTH, json=body)
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_registry_mysql_postgresql_still_present_r34():
    """T-REG-R34-001: mysql/postgresql types 仍在。"""
    types = {item["type"] for item in export_type_catalog()}
    assert {"mysql", "postgresql", "tidb", "starrocks", "elasticsearch"}.issubset(types)


def test_meta_design_r33_regression_r34():
    """T-REG-R34-002: r33 套件仍可导入（完整回归在 Task 7）。"""
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "test_meta_design_r33",
        Path(__file__).resolve().parent / "test_meta_design_r33.py",
    )
    assert spec is not None and spec.loader is not None
    r33 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r33)
    assert hasattr(r33, "test_design_unknown_field_r33")
