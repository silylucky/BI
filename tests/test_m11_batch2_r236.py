"""M11 三期 batch2 r236 — CONN-014~016 + QUERY-003 集成验收。"""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from jwt_auth import jwt_auth_headers

from app.auth.deps import UserContext
from app.auth.resources.service import VisibilityError
from app.core.config import get_settings
from app.datasources.dialects.elasticsearch import ElasticsearchConnector, probe_readonly_search
from app.datasources.dialects.mongodb import MongodbConnector, probe_readonly_find
from app.datasources.dialects.opensearch import OpensearchConnector, probe_readonly_search as os_probe
from app.datasources.models import get_meta_session
from app.datasources.registry import export_type_catalog, registry
from app.datasources.schemas import DataSourceCreate
from app.datasources.service import create_data_source
from app.main import app
from app.query import service as query_service
from app.query.native.guard import probe_list_routing_modes
from app.query.schemas import ExecuteRequest, QueryError

_R236_SQLITE_URL = "sqlite+pysqlite:///file:connectors_m11_r236?mode=memory&cache=shared&uri=true"
AUTH = jwt_auth_headers()


@pytest.fixture(scope="module", autouse=True)
def r236_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R236_SQLITE_URL
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


def test_r236_scaffold_imports():
    assert app is not None


def _create_typed_ds(ds_type: str):
    session = get_meta_session()
    try:
        defaults = {
            "mongodb": dict(port=27017, database="app", username="x", password="x"),
            "mysql": dict(port=3306, database="app", username="root", password="x"),
            "opensearch": dict(port=9200, database="_default", username="u", password="x"),
            "elasticsearch": dict(port=9200, database="_default", username="u", password="x"),
        }[ds_type]
        suffix = uuid.uuid4().hex[:8]
        row = create_data_source(
            session,
            DataSourceCreate(
                name=f"r236-{ds_type}-{suffix}",
                code=f"r236-{ds_type}-{suffix}",
                type=ds_type,
                host="127.0.0.1",
                **defaults,
            ),
        )
        return row.id
    finally:
        session.close()


# --- CONN-014 MongoDB ---


def test_conn_r236_014_01_types_catalog_mongodb():
    types = {item["type"]: item for item in export_type_catalog()}
    assert "mongodb" in types
    assert types["mongodb"]["category"] == "document"


@patch("app.datasources.dialects.mongodb._get_client")
def test_conn_r236_014_02_probe_readonly_find_true(mock_get_client):
    coll = MagicMock()
    coll.find.return_value.limit.return_value = [{"_id": "1"}]
    db = MagicMock()
    db.__getitem__.return_value = coll
    conn = MagicMock()
    conn.__getitem__.return_value = db
    assert probe_readonly_find(conn, database="app", collection="users") is True


def test_conn_r236_014_03_probe_readonly_find_empty_collection_false():
    assert probe_readonly_find(MagicMock(), database="", collection="") is False


@patch("app.datasources.dialects.mongodb.guard_native_injection")
def test_conn_r236_014_04_execute_native_query_returns_columns_rows(mock_guard):
    coll = MagicMock()
    coll.find.return_value.skip.return_value.limit.return_value = [{"name": "a", "age": 1}]
    db = MagicMock()
    db.__getitem__.return_value = coll
    conn = MagicMock()
    conn.__getitem__.return_value = db
    cols, rows, truncated = MongodbConnector().execute_native_query(
        conn,
        body={"collection": "users", "database": "app"},
        limit=10,
    )
    assert cols == ["age", "name"]
    assert rows == [[1, "a"]]
    assert truncated is False


def test_conn_r236_014_05_execute_rejects_where_body():
    conn = MagicMock()
    with pytest.raises(QueryError) as exc:
        MongodbConnector().execute_native_query(
            conn, body={"collection": "u", "$where": "1==1"}, limit=1,
        )
    assert exc.value.code == "QUERY_NATIVE_INJECTION_SUSPECT"


# --- CONN-015 Elasticsearch ---


def test_conn_r236_015_01_types_catalog_elasticsearch():
    types = {item["type"]: item for item in export_type_catalog()}
    assert "elasticsearch" in types
    assert types["elasticsearch"]["category"] == "search"


def test_conn_r236_015_02_probe_readonly_search_true():
    client = MagicMock()
    client.search.return_value = {"hits": {"hits": [{"_source": {"a": 1}}]}}
    assert probe_readonly_search(client, index="logs") is True


def test_conn_r236_015_03_probe_empty_index_false():
    assert probe_readonly_search(MagicMock(), index="") is False


@patch("app.datasources.dialects.elasticsearch.guard_native_injection")
def test_conn_r236_015_04_execute_native_query_hits(mock_guard):
    client = MagicMock()
    client.search.return_value = {
        "hits": {"hits": [{"_source": {"region": "east", "count": 3}}]},
    }
    cols, rows, truncated = ElasticsearchConnector().execute_native_query(
        client,
        body={"query": {"match_all": {}}},
        index="logs",
        limit=10,
    )
    assert cols == ["count", "region"]
    assert rows == [[3, "east"]]
    assert truncated is False


@patch("app.datasources.dialects.elasticsearch.Elasticsearch")
def test_conn_r236_015_05_http_no_password_in_response(mock_es_cls, client):
    mock_es_cls.return_value.info.side_effect = Exception("authentication failed 401")
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "elasticsearch",
            "name": "es-r236",
            "code": f"es-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 9200,
            "database": "_default",
            "username": "u",
            "password": "secret-pw",
        },
    )
    assert resp.status_code == 200
    assert "secret-pw" not in resp.text


# --- CONN-016 OpenSearch ---


def test_conn_r236_016_01_types_catalog_opensearch():
    types = {item["type"]: item for item in export_type_catalog()}
    assert "opensearch" in types
    assert types["opensearch"]["category"] == "search"
    assert "elasticsearch" in types


def test_conn_r236_016_02_probe_readonly_search_true():
    client = MagicMock()
    client.search.return_value = {"hits": {"hits": [{"_source": {"a": 1}}]}}
    assert os_probe(client, index="logs") is True


def test_conn_r236_016_03_probe_empty_index_false():
    assert os_probe(MagicMock(), index="") is False


@patch("app.datasources.dialects.opensearch.guard_native_injection")
def test_conn_r236_016_04_execute_symmetric(mock_guard):
    client = MagicMock()
    client.search.return_value = {"hits": {"hits": [{"_source": {"k": "v"}}]}}
    cols, rows, _ = OpensearchConnector().execute_native_query(
        client, body={"query": {"match_all": {}}}, index="idx", limit=5,
    )
    assert cols == ["k"]
    assert rows == [["v"]]


@patch("app.datasources.dialects.opensearch.guard_native_injection")
def test_conn_r236_016_05_map_opensearch_index_not_found(mock_guard):
    client = MagicMock()
    client.search.side_effect = Exception("index_not_found_exception")
    with pytest.raises(QueryError) as exc:
        OpensearchConnector().execute_native_query(
            client, body={"query": {"match_all": {}}}, index="missing", limit=5,
        )
    assert exc.value.code == "QUERY_TABLE_NOT_FOUND"


def test_conn_r236_016_06_independent_connector_type():
    assert registry.get("opensearch").type == "opensearch"
    assert registry.get("elasticsearch").type == "elasticsearch"


# --- QUERY-003 ---


@patch("app.query.native.executor.pool_manager.pooled_connection")
def test_query_r236_003_01_opensearch_native_execute_mock(mock_pool):
    mock_conn = MagicMock()
    mock_conn.search.return_value = {"hits": {"hits": [{"_source": {"a": 1}}]}}
    mock_pool.return_value.__enter__.return_value = mock_conn
    ds_id = _create_typed_ds("opensearch")
    session = get_meta_session()
    try:
        user = UserContext(id="dev", username="dev", roles=["admin"])
        payload = ExecuteRequest(
            data_source_id=ds_id,
            mode="native",
            native_body={"query": {"match_all": {}}},
            index="logs",
            limit=10,
        )
        result = query_service.execute_query(session, user, payload)
        assert result.columns == ["a"]
        assert result.rows == [[1]]
    finally:
        session.close()


def test_query_r236_003_02_mysql_native_wrong_mode(client):
    ds_id = _create_typed_ds("mysql")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "mode": "native",
            "nativeBody": {"collection": "x"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_WRONG_MODE"


def test_query_r236_003_03_empty_native_body_422(client):
    ds_id = _create_typed_ds("opensearch")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(ds_id), "mode": "native", "nativeBody": {}},
    )
    assert resp.status_code == 422


def test_query_r236_003_04_sql_plus_native_body_422(client):
    ds_id = _create_typed_ds("opensearch")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "mode": "native",
            "sql": "SELECT 1",
            "nativeBody": {"query": {"match_all": {}}},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_SQL_DISGUISE"


@patch("app.query.service.assert_visible")
def test_query_r236_003_05_acl_forbidden(mock_visible, client):
    mock_visible.side_effect = VisibilityError("DATASOURCE_FORBIDDEN", "out of scope", 403)
    ds_id = _create_typed_ds("opensearch")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "mode": "native",
            "nativeBody": {"query": {"match_all": {}}},
            "index": "logs",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DATASOURCE_FORBIDDEN"


def test_query_r236_003_06_routing_under_50ms():
    result = probe_list_routing_modes()
    assert result.ok
    assert result.elapsed_ms < 50


@patch("app.query.native.executor.pool_manager.pooled_connection")
def test_query_r236_003_07_mongodb_native_execute_mock(mock_pool):
    mock_conn = MagicMock()
    coll = MagicMock()
    coll.find.return_value.skip.return_value.limit.return_value = [{"name": "x", "v": 2}]
    db = MagicMock()
    db.__getitem__.return_value = coll
    mock_conn.__getitem__.return_value = db
    mock_pool.return_value.__enter__.return_value = mock_conn
    ds_id = _create_typed_ds("mongodb")
    session = get_meta_session()
    try:
        user = UserContext(id="dev", username="dev", roles=["admin"])
        payload = ExecuteRequest(
            data_source_id=ds_id,
            mode="native",
            native_body={"collection": "users", "database": "app"},
            limit=10,
        )
        result = query_service.execute_query(session, user, payload)
        assert "name" in result.columns
        assert result.rows
    finally:
        session.close()


@patch("app.query.native.executor.pool_manager.pooled_connection")
def test_query_r236_003_08_elasticsearch_native_execute_mock(mock_pool):
    mock_conn = MagicMock()
    mock_conn.search.return_value = {"hits": {"hits": [{"_source": {"z": 9}}]}}
    mock_pool.return_value.__enter__.return_value = mock_conn
    ds_id = _create_typed_ds("elasticsearch")
    session = get_meta_session()
    try:
        user = UserContext(id="dev", username="dev", roles=["admin"])
        payload = ExecuteRequest(
            data_source_id=ds_id,
            mode="native",
            native_body={"query": {"match_all": {}}},
            index="idx",
            limit=10,
        )
        result = query_service.execute_query(session, user, payload)
        assert result.columns == ["z"]
        assert result.rows == [[9]]
    finally:
        session.close()


def test_query_r236_003_09_es_offset_unsupported(client):
    ds_id = _create_typed_ds("elasticsearch")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={
            "dataSourceId": str(ds_id),
            "mode": "native",
            "nativeBody": {"query": {"match_all": {}}},
            "index": "logs",
            "offset": 10,
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_OFFSET_UNSUPPORTED"


def test_conn_r236_014_06_probe_readonly_find_exception_false():
    conn = MagicMock()
    conn.__getitem__.side_effect = Exception("connection failed")
    assert probe_readonly_find(conn, database="app", collection="users") is False


def test_conn_r236_015_06_execute_empty_hits():
    client = MagicMock()
    client.search.return_value = {"hits": {"hits": []}}
    cols, rows, truncated = ElasticsearchConnector().execute_native_query(
        client, body={"query": {"match_all": {}}}, index="logs", limit=10,
    )
    assert cols == []
    assert rows == []
    assert truncated is False
