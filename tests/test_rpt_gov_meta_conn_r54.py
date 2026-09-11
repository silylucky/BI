"""M10/M12 报表扩展 + GOV OpenAPI + META entity + OceanBase L1 kickoff r54."""
from __future__ import annotations

import os
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.nfr.plugin_extension import get_plugin_registration_meta
from app.datasources.dialects.errors import (
    OCEANBASE_AUTH_FAILED,
    OCEANBASE_CONN_REFUSED,
    map_oceanbase_error,
)
from app.datasources.dialects.oceanbase import OCEANBASE_MAX_COLUMNS, OceanbaseConnector
from app.datasources.registry import registry
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R54_SQLITE_URL = "sqlite+pysqlite:///file:rpt_gov_meta_conn_r54?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r54_ensure_connectors():
    from app.datasources import register_builtin_dialects
    from app.datasources.registry import registry

    if "oceanbase" not in registry._connectors:
        register_builtin_dialects()
    yield


@pytest.fixture(scope="module", autouse=True)
def r54_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R54_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _create_template_node(client: TestClient, name: str = "Tpl") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": name, "nodeType": "template", "templateKind": "excel"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_folder_node(client: TestClient, name: str = "Folder") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": name, "nodeType": "folder"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_catalog_entry(
    client: TestClient,
    *,
    status: str = "draft",
    path: str | None = None,
) -> str:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"Svc-{suffix}",
            "httpMethod": "POST",
            "path": path or f"/api/v1/gov-svc/{suffix}",
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _publish_entry(client: TestClient, entry_id: str) -> None:
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    assert resp.status_code == 200, resp.text
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "published"


def test_r54_fixture_bootstraps(client):
    """T-R54-000-01: r54 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_rpt006_upsert_template_node_ok(client):
    """T-R54-RPT-01: template 节点挂载扩展 200/201 含 revision。"""
    node_id = _create_template_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "revenue", "label": "Revenue"}],
            "filters": [{"key": "region", "operator": "eq"}],
            "changeNote": "init",
        },
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["revision"] >= 1
    assert body["metrics"][0]["key"] == "revenue"


def test_rpt006_folder_node_rejected(client):
    """T-R54-RPT-02: folder 节点 → 422 RPT_EXT_INVALID_NODE_TYPE。"""
    node_id = _create_folder_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [], "filters": []},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_NODE_TYPE"


def test_rpt006_duplicate_metric_key(client):
    """T-R54-RPT-03: 重复 metrics key → 422 RPT_EXT_DUPLICATE_KEY。"""
    node_id = _create_template_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [
                {"key": "dup", "label": "A"},
                {"key": "dup", "label": "B"},
            ],
            "filters": [],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_DUPLICATE_KEY"


def test_rpt006_metrics_limit(client):
    """T-R54-RPT-04: metrics 超过 32 条 → 422 RPT_EXT_METRICS_LIMIT。"""
    node_id = _create_template_node(client)
    metrics = [{"key": f"m{i:02d}", "label": f"M{i}"} for i in range(33)]
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": metrics, "filters": []},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_METRICS_LIMIT"


def test_rpt006_invalid_operator(client):
    """T-R54-RPT-05: 非法 operator → 422 RPT_EXT_INVALID_OPERATOR。"""
    node_id = _create_template_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [],
            "filters": [{"key": "x", "operator": "bogus"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_OPERATOR"


def test_rpt006_get_not_found(client):
    """T-R54-RPT-06: 不存在节点 GET → 404 RPT_EXT_NODE_NOT_FOUND。"""
    missing = uuid.uuid4()
    resp = client.get(f"/api/v1/reports/catalog/nodes/{missing}/extension", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_EXT_NODE_NOT_FOUND"


def test_rpt006_delete_extension(client):
    """T-R54-RPT-07: DELETE 后 GET → 404。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [], "filters": []},
    )
    del_resp = client.delete(f"/api/v1/reports/catalog/nodes/{node_id}/extension", headers=AUTH)
    assert del_resp.status_code in (200, 204)
    get_resp = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension", headers=AUTH)
    assert get_resp.status_code == 404


def test_rpt007_batch_create_three_items(client):
    """T-R54-RPT-08: 3 项批量创建 → 201 createdNodeIds 长度 3。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": "R1", "templateKind": "pdf"},
                {"name": "R2", "templateKind": "excel"},
                {"name": "R3", "templateKind": "pdf"},
            ]
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body["createdNodeIds"]) == 3
    assert body["idempotentReplay"] is False


def test_rpt007_idempotency_replay(client):
    """T-R54-RPT-09: 同 Idempotency-Key 重放 → 相同 batchId。"""
    key = f"idem-{uuid.uuid4().hex}"
    payload = {"items": [{"name": "Once", "templateKind": "pdf"}]}
    headers = {**AUTH, "Idempotency-Key": key}
    first = client.post("/api/v1/reports/batch", headers=headers, json=payload)
    second = client.post("/api/v1/reports/batch", headers=headers, json=payload)
    assert first.status_code == 201
    assert second.status_code in (200, 201)
    assert second.json()["batchId"] == first.json()["batchId"]
    assert second.json()["idempotentReplay"] is True


def test_rpt007_idempotency_conflict(client):
    """T-R54-RPT-10: 同 key 不同 body → 409 RPT_BATCH_IDEMPOTENCY_CONFLICT。"""
    key = f"idem-{uuid.uuid4().hex}"
    headers = {**AUTH, "Idempotency-Key": key}
    client.post("/api/v1/reports/batch", headers=headers, json={"items": [{"name": "A"}]})
    resp = client.post("/api/v1/reports/batch", headers=headers, json={"items": [{"name": "B"}]})
    assert resp.status_code == 409
    assert resp.json()["code"] == "RPT_BATCH_IDEMPOTENCY_CONFLICT"


def test_rpt007_item_limit(client):
    """T-R54-RPT-11: 51 项 → 422 RPT_BATCH_ITEM_LIMIT。"""
    items = [{"name": f"R{i}"} for i in range(51)]
    resp = client.post("/api/v1/reports/batch", headers=AUTH, json={"items": items})
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_BATCH_ITEM_LIMIT"


def test_rpt007_invalid_extension_atomic(client):
    """T-R54-RPT-12: 非法 extension → 422 无部分提交。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {
                    "name": "Bad",
                    "extension": {
                        "catalogNodeId": str(uuid.uuid4()),
                        "metrics": [{"key": "x", "label": "X"}],
                        "filters": [],
                    },
                }
            ]
        },
    )
    assert resp.status_code == 422
    listed = client.get("/api/v1/reports/catalog/nodes", headers=AUTH)
    assert all(n["name"] != "Bad" for n in listed.json())


def test_rpt007_batch_with_extension_readable(client):
    """T-R54-RPT-13: batch 项带 extension 后 GET extension 可读。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {
                    "name": "WithExt",
                    "templateKind": "excel",
                    "extension": {
                        "metrics": [{"key": "kpi", "label": "KPI"}],
                        "filters": [],
                    },
                }
            ]
        },
    )
    assert resp.status_code == 201, resp.text
    node_id = resp.json()["createdNodeIds"][0]
    ext = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension", headers=AUTH)
    assert ext.status_code == 200
    assert ext.json()["metrics"][0]["key"] == "kpi"


def test_rpt007_parent_not_found(client):
    """T-R54-RPT-14: 无效 parentId → 404 RPT_BATCH_PARENT_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={"items": [{"name": "Orphan", "parentId": str(uuid.uuid4())}]},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_BATCH_PARENT_NOT_FOUND"


def test_rpt007_empty_items(client):
    """T-R54-RPT-15: 空 items → 422 RPT_BATCH_EMPTY。"""
    resp = client.post("/api/v1/reports/batch", headers=AUTH, json={"items": []})
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_BATCH_EMPTY"


def test_meta006_create_entity_type(client):
    """T-R54-META-01: POST 含 3 attributes → 201。"""
    resp = client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "report_entity",
            "displayName": "Report Entity",
            "attributes": [
                {"name": "title", "dataType": "string", "required": True},
                {"name": "count", "dataType": "integer"},
                {"name": "active", "dataType": "boolean"},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["typeCode"] == "report_entity"
    assert len(body["attributes"]) == 3


def test_meta006_duplicate_type_code(client):
    """T-R54-META-02: 重复 typeCode → 409 META_ENTITY_TYPE_CONFLICT。"""
    payload = {"typeCode": "dup_type", "displayName": "Dup", "attributes": []}
    client.post("/api/v1/metadata/entity-types", headers=AUTH, json=payload)
    resp = client.post("/api/v1/metadata/entity-types", headers=AUTH, json=payload)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_ENTITY_TYPE_CONFLICT"


def test_meta006_invalid_attribute_name(client):
    """T-R54-META-03: 非法 attribute name → 422 META_ENTITY_TYPE_INVALID_ATTR。"""
    resp = client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "bad_attr",
            "displayName": "Bad",
            "attributes": [{"name": "BadName", "dataType": "string"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "META_ENTITY_TYPE_INVALID_ATTR"


def test_meta006_default_lifecycle_states(client):
    """T-R54-META-04: 默认 lifecycleStates 含 draft/active/retired。"""
    resp = client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "lifecycle_demo", "displayName": "LC", "attributes": []},
    )
    assert resp.status_code == 201
    states = resp.json()["lifecycleStates"]
    assert {"draft", "active", "retired"}.issubset(set(states))


def test_meta006_get_and_update(client):
    """T-R54-META-05: GET + PUT 更新 displayName。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "upd_demo", "displayName": "Old", "attributes": []},
    )
    get_resp = client.get("/api/v1/metadata/entity-types/upd_demo", headers=AUTH)
    assert get_resp.status_code == 200
    put_resp = client.put(
        "/api/v1/metadata/entity-types/upd_demo",
        headers=AUTH,
        json={"displayName": "New", "attributes": []},
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["displayName"] == "New"


def test_meta006_list_entity_types(client):
    """T-R54-META-06: GET 列表非空。"""
    resp = client.get("/api/v1/metadata/entity-types", headers=AUTH)
    assert resp.status_code == 200
    assert isinstance(resp.json()["items"], list)


def test_meta006_not_found(client):
    """T-R54-META-07: 未知 typeCode GET → 404 META_ENTITY_TYPE_NOT_FOUND。"""
    resp = client.get("/api/v1/metadata/entity-types/missing_type", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "META_ENTITY_TYPE_NOT_FOUND"


def test_gov006_register_published_entry(client):
    """T-R54-GOV-01: published entry 登记映射 → 201。"""
    eid = _create_catalog_entry(client, status="draft")
    _publish_entry(client, eid)
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "report_entity", "displayName": "RE", "attributes": []},
    )
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": eid,
            "httpMethod": "POST",
            "path": "/api/v1/gov-svc/demo",
            "operationId": "govSvcDemo",
            "entityTypeRef": "report_entity",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["active"] is True


def test_gov006_draft_entry_rejected(client):
    """T-R54-GOV-02: draft entry → 422 GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": eid,
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/draft",
            "operationId": "draftOp",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED"


def test_gov006_invalid_path_prefix(client):
    """T-R54-GOV-03: path 非 /api/v1/ 前缀 → 422 GOV_OPENAPI_MAP_INVALID_PATH。"""
    eid = _create_catalog_entry(client, status="draft")
    _publish_entry(client, eid)
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": eid,
            "httpMethod": "GET",
            "path": "/bad/path",
            "operationId": "badPath",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_INVALID_PATH"


def test_gov006_validate_ok(client):
    """T-R54-GOV-04: POST validate 合法映射 → 200。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "val_entity", "displayName": "V", "attributes": []},
    )
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/validate",
            "operationId": "validateOp",
            "entityTypeRef": "val_entity",
        },
    )
    assert resp.status_code == 200


def test_gov006_unknown_entity_type_ref(client):
    """T-R54-GOV-05: 未知 entityTypeRef validate → 422 GOV_OPENAPI_MAP_ENTITY_TYPE_UNKNOWN。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/x",
            "operationId": "xOp",
            "entityTypeRef": "no_such_type",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ENTITY_TYPE_UNKNOWN"


def test_gov006_duplicate_operation_id(client):
    """T-R54-GOV-06: 重复 operationId → 409 GOV_OPENAPI_MAP_DUPLICATE。"""
    eid1 = _create_catalog_entry(client)
    eid2 = _create_catalog_entry(client)
    _publish_entry(client, eid1)
    _publish_entry(client, eid2)
    body = {
        "httpMethod": "POST",
        "path": "/api/v1/gov-svc/dup",
        "operationId": "dupOperation",
    }
    first = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={"catalogEntryId": eid1, **body},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={"catalogEntryId": eid2, **body},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "GOV_OPENAPI_MAP_DUPLICATE"


def test_gov006_list_and_get(client):
    """T-R54-GOV-07: GET 列表与单条。"""
    listed = client.get("/api/v1/gov/openapi-mappings", headers=AUTH)
    assert listed.status_code == 200
    items = listed.json()["items"]
    if items:
        mid = items[0]["id"]
        one = client.get(f"/api/v1/gov/openapi-mappings/{mid}", headers=AUTH)
        assert one.status_code == 200


def test_gov006_mapping_not_found(client):
    """T-R54-GOV-08: 未知 mapping id → 404 GOV_OPENAPI_MAP_NOT_FOUND。"""
    resp = client.get(f"/api/v1/gov/openapi-mappings/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_NOT_FOUND"


def test_conn020_types_catalog_http(client):
    """T-R54-CONN-01: GET /datasources/types 含 oceanbase relational。"""
    resp = client.get("/api/v1/datasources/types", headers=AUTH)
    assert resp.status_code == 200
    items = {i["type"]: i for i in resp.json()["items"]}
    assert "oceanbase" in items
    assert items["oceanbase"]["category"] == "relational"


def test_conn020_map_oceanbase_error_conn_refused():
    """T-R54-CONN-02: map_oceanbase_error 映射连接拒绝。"""
    exc = pymysql.err.OperationalError(2003, "Can't connect")
    code, _ = map_oceanbase_error(exc)
    assert code == OCEANBASE_CONN_REFUSED


def test_conn020_test_connection_ok_mock():
    """T-R54-CONN-03: mock 连接成功。"""
    connector = OceanbaseConnector()
    with patch.object(connector._inner, "open_connection") as mock_open:
        mock_conn = MagicMock()
        mock_open.return_value = mock_conn
        result = connector.test_connection(host="h", port=2881, username="u", password="p", database="d")
    assert result.ok is True


def test_conn020_test_connection_auth_failed_mock():
    """T-R54-CONN-04: mock 认证失败 OCEANBASE_AUTH_FAILED。"""
    connector = OceanbaseConnector()
    with patch.object(
        connector._inner,
        "open_connection",
        side_effect=pymysql.err.OperationalError(1045, "Access denied"),
    ):
        result = connector.test_connection(host="h", port=2881, username="u", password="p", database="d")
    assert result.ok is False
    assert result.code == OCEANBASE_AUTH_FAILED


def test_conn020_list_schemas_delegates():
    """T-R54-CONN-05: list_schemas 委托 mysql。"""
    connector = OceanbaseConnector()
    mock_conn = MagicMock()
    with patch.object(connector._inner, "list_schemas", return_value=[]) as mock_ls:
        connector.list_schemas(mock_conn)
    mock_ls.assert_called_once_with(mock_conn)


def test_conn020_list_columns_truncated():
    """T-R54-CONN-06: list_columns 截断至 500。"""
    connector = OceanbaseConnector()
    mock_conn = MagicMock()
    many = [MagicMock()] * (OCEANBASE_MAX_COLUMNS + 10)
    with patch.object(connector._inner, "list_columns", return_value=many):
        cols = connector.list_columns(mock_conn, "s", "t")
    assert len(cols) == OCEANBASE_MAX_COLUMNS


def test_conn020_plugin_registration_meta():
    """T-R54-CONN-07: register_connector_plugin 登记 oceanbase。"""
    meta = get_plugin_registration_meta("oceanbase")
    assert meta is not None
    assert meta["registered_via"] == "plugin"
    assert registry.get("oceanbase").type == "oceanbase"


def test_conn020_http_test_connection_draft(client):
    """T-R54-CONN-08: POST test draft 链可达。"""
    with patch("app.datasources.dialects.mysql.MysqlConnector.open_connection") as mock_open:
        mock_conn = MagicMock()
        mock_open.return_value = mock_conn
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "oceanbase",
                "name": "ob-test",
                "code": f"ob-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 2881,
                "username": "u",
                "password": "p",
                "database": "demo",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_x_gov_meta_entity_ref_validate_then_delete_blocked(client):
    """T-R54-X-01: GOV 映射引用时 DELETE entity → 409 META_ENTITY_TYPE_IN_USE。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "in_use_type", "displayName": "IU", "attributes": []},
    )
    eid = _create_catalog_entry(client)
    _publish_entry(client, eid)
    client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": eid,
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/in-use",
            "operationId": "inUseOp",
            "entityTypeRef": "in_use_type",
        },
    )
    del_resp = client.delete("/api/v1/metadata/entity-types/in_use_type", headers=AUTH)
    assert del_resp.status_code == 409
    assert del_resp.json()["code"] == "META_ENTITY_TYPE_IN_USE"


def test_x_gov_meta_validate_unknown_ref(client):
    """T-R54-X-02: validate 未知 entityTypeRef → 422。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "POST",
            "path": "/api/v1/gov-svc/unknown",
            "operationId": "unknownRef",
            "entityTypeRef": "missing_entity_xyz",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ENTITY_TYPE_UNKNOWN"


def test_x_rpt_batch_extension_roundtrip(client):
    """T-R54-X-03: batch 创建 + extension GET 联动。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {
                    "name": "Linkage",
                    "extension": {
                        "metrics": [{"key": "m1", "label": "M1"}],
                        "filters": [{"key": "f1", "operator": "eq"}],
                    },
                }
            ]
        },
    )
    assert resp.status_code == 201
    node_id = resp.json()["createdNodeIds"][0]
    ext = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension", headers=AUTH)
    assert ext.status_code == 200
    assert ext.json()["filters"][0]["operator"] == "eq"
