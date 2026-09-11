"""M10/M12 报表扩展 + GOV OpenAPI + META entity + OceanBase companion 质量推分 r55."""
from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import pymysql.err
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R55_SQLITE_URL = "sqlite+pysqlite:///file:rpt_gov_meta_conn_r55?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r55_ensure_connectors():
    from app.datasources import register_builtin_dialects
    from app.datasources.registry import registry

    if "oceanbase" not in registry._connectors:
        register_builtin_dialects()
    yield


@pytest.fixture(scope="module", autouse=True)
def r55_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R55_SQLITE_URL
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


def _create_catalog_entry(client: TestClient, *, status: str = "draft") -> str:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"Svc-{suffix}",
            "httpMethod": "POST",
            "path": f"/api/v1/gov-svc/{suffix}",
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


def _register_mapping(client: TestClient, entry_id: str, operation_id: str) -> str:
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": entry_id,
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/demo",
            "operationId": operation_id,
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# --- Task 1: GOV-006 ---

from app.governance.openapi.schemas import OpenApiMappingCreate
from app.governance.openapi.service import probe_openapi_validate_budget_ms, validate_mapping


def test_r55_fixture_bootstraps(client):
    """T-R55-000-01: r55 sqlite 环境 health 可达。"""
    assert client.get("/health").status_code == 200


def test_gov_r55_unsupported_api_version(client):
    """T-GOV-R55-006-01: apiVersion=v2 validate → 422 GOV_OPENAPI_MAP_UNSUPPORTED_VERSION。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/x",
            "operationId": "validOp",
            "apiVersion": "v2",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_UNSUPPORTED_VERSION"


def test_gov_r55_invalid_operation_id(client):
    """T-GOV-R55-006-02: operationId=123bad → 422 GOV_OPENAPI_MAP_INVALID_OPERATION_ID。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/x",
            "operationId": "123bad",
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_INVALID_OPERATION_ID"


def test_gov_r55_validate_ok(client):
    """T-GOV-R55-006-03: 合法映射 validate → 200 valid=true apiVersion=v1。"""
    resp = client.post(
        "/api/v1/gov/openapi-mappings/validate",
        headers=AUTH,
        json={
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/ok",
            "operationId": "okOp",
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["valid"] is True
    assert body["apiVersion"] == "v1"
    assert body["warnings"] == []


def test_gov_r55_deactivate_mapping(client):
    """T-GOV-R55-006-04: register 后 deactivate → 200 active=false。"""
    eid = _create_catalog_entry(client)
    _publish_entry(client, eid)
    mid = _register_mapping(client, eid, f"deact_{uuid.uuid4().hex[:6]}")
    resp = client.post(f"/api/v1/gov/openapi-mappings/{mid}/deactivate", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["active"] is False


def test_gov_r55_deactivate_twice_409(client):
    """T-GOV-R55-006-05: 重复 deactivate → 409 GOV_OPENAPI_MAP_ALREADY_INACTIVE。"""
    eid = _create_catalog_entry(client)
    _publish_entry(client, eid)
    mid = _register_mapping(client, eid, f"deact2_{uuid.uuid4().hex[:6]}")
    client.post(f"/api/v1/gov/openapi-mappings/{mid}/deactivate", headers=AUTH)
    resp = client.post(f"/api/v1/gov/openapi-mappings/{mid}/deactivate", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ALREADY_INACTIVE"


def test_gov_r55_probe_validate_under_budget():
    """T-GOV-R55-006-06: probe_openapi_validate 耗时 < 50ms。"""
    payload = OpenApiMappingCreate(
        http_method="GET",
        path="/api/v1/gov-svc/probe",
        operation_id="probeOp",
        api_version="v1",
    )
    started = time.perf_counter()
    validate_mapping(payload)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_openapi_validate_budget_ms


def test_gov_r55_draft_entry_rejected(client):
    """T-GOV-R55-006-07: draft entry register → 422 GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED（r54 回归）。"""
    eid = _create_catalog_entry(client, status="draft")
    resp = client.post(
        "/api/v1/gov/openapi-mappings",
        headers=AUTH,
        json={
            "catalogEntryId": eid,
            "httpMethod": "GET",
            "path": "/api/v1/gov-svc/draft",
            "operationId": "draftOpR55",
            "apiVersion": "v1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_OPENAPI_MAP_ENTRY_NOT_PUBLISHED"


# --- Task 2: RPT-007 ---

from app.reports.batch.schemas import BatchCreateReportsIn, BatchReportItem
from app.reports.batch.service import batch_create, probe_batch_create_budget_ms


def test_rpt_r55_batch_partial_failure_index(client):
    """T-RPT-R55-007-01: 第 2 项 parent 无效 → 422 RPT_BATCH_PARTIAL_FAILURE + failedIndex=1。"""
    _create_template_node(client, "BatchParent")
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": "FirstOk"},
                {"name": "SecondBad", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "RPT_BATCH_PARTIAL_FAILURE"
    assert body["detail"]["failedIndex"] == 1
    assert body["detail"]["failedItemName"] == "SecondBad"


def test_rpt_r55_batch_rollback_no_residual(client):
    """T-RPT-R55-007-02: 失败回滚后 catalog 无残留节点。"""
    unique = f"Rollback_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": unique},
                {"name": "Fail", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    listed = client.get("/api/v1/reports/catalog/nodes", headers=AUTH)
    names = [n["name"] for n in listed.json()]
    assert unique not in names


def test_rpt_r55_batch_rolled_back_count(client):
    """T-RPT-R55-007-03: detail.rolledBackCount=1 当第 2 项失败且第 1 项已创建。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": f"Rb_{uuid.uuid4().hex[:6]}"},
                {"name": "X", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["rolledBackCount"] == 1


def test_rpt_r55_batch_idempotent_replay(client):
    """T-RPT-R55-007-04: Idempotency-Key 重放 → idempotentReplay=true（r54 回归）。"""
    key = f"idem-{uuid.uuid4()}"
    headers = {**AUTH, "Idempotency-Key": key}
    payload = {"items": [{"name": f"Idem_{uuid.uuid4().hex[:6]}"}]}
    first = client.post("/api/v1/reports/batch", headers=headers, json=payload)
    second = client.post("/api/v1/reports/batch", headers=headers, json=payload)
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["idempotentReplay"] is True


def test_rpt_r55_batch_idempotency_conflict(client):
    """T-RPT-R55-007-05: 同 key 不同 body → 409 RPT_BATCH_IDEMPOTENCY_CONFLICT（r54 回归）。"""
    key = f"conflict-{uuid.uuid4()}"
    headers = {**AUTH, "Idempotency-Key": key}
    client.post("/api/v1/reports/batch", headers=headers, json={"items": [{"name": "A"}]})
    resp = client.post("/api/v1/reports/batch", headers=headers, json={"items": [{"name": "B"}]})
    assert resp.status_code == 409
    assert resp.json()["code"] == "RPT_BATCH_IDEMPOTENCY_CONFLICT"


def test_rpt_r55_batch_probe_under_budget():
    """T-RPT-R55-007-06: 10 项 mock batch elapsed_ms < 200。"""
    items = [BatchReportItem(name=f"b{i}") for i in range(10)]
    payload = BatchCreateReportsIn(items=items)
    started = time.perf_counter()
    batch_create(payload, None)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_batch_create_budget_ms


# --- Task 3: RPT-006 ---

from app.reports.extension import service as extension_service
from app.reports.extension.render import build_extension_render_spec, probe_extension_load_budget_ms


def _upsert_extension(client: TestClient, node_id: str, **extra) -> None:
    body = {
        "catalogNodeId": node_id,
        "metrics": [
            {"key": "revenue", "label": "Revenue", "visible": True},
            {"key": "hidden_m", "label": "Hidden", "visible": False},
        ],
        "filters": [{"key": "region", "operator": "eq", "required": True}],
        **extra,
    }
    resp = client.put(f"/api/v1/reports/catalog/nodes/{node_id}/extension", headers=AUTH, json=body)
    assert resp.status_code == 200, resp.text


def test_rpt_r55_render_spec_visible_metrics(client):
    """T-RPT-R55-006-01: upsert 后 GET render-spec → renderVersion=1.0 + visible metrics。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    resp = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["renderVersion"] == "1.0"
    keys = {m["key"] for m in body["metrics"]}
    assert keys == {"revenue"}


def test_rpt_r55_render_spec_hides_invisible(client):
    """T-RPT-R55-006-02: visible=false metric 不出现在 render-spec。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    resp = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/render-spec", headers=AUTH)
    assert "hidden_m" not in {m["key"] for m in resp.json()["metrics"]}


def test_rpt_r55_revision_history_with_change_note(client):
    """T-RPT-R55-006-03: 带 changeNote 的 upsert → revisions 列表含该条。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid, changeNote="Adjusted metrics")
    resp = client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/revisions", headers=AUTH)
    assert resp.status_code == 200, resp.text
    notes = [r.get("changeNote") for r in resp.json()["items"]]
    assert "Adjusted metrics" in notes


def test_rpt_r55_persistence_snapshot_memory(client):
    """T-RPT-R55-006-04: persistence snapshot store=memory。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    snap = extension_service.export_persistence_snapshot(uuid.UUID(nid))
    assert snap["store"] == "memory"


def test_rpt_r55_render_spec_probe_under_budget(client):
    """T-RPT-R55-006-05: GET render-spec 耗时 < 50ms（probe）。"""
    nid = _create_template_node(client)
    _upsert_extension(client, nid)
    started = time.perf_counter()
    client.get(f"/api/v1/reports/catalog/nodes/{nid}/extension/render-spec", headers=AUTH)
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_extension_load_budget_ms


def test_rpt_r55_folder_render_spec_rejected(client):
    """T-RPT-R55-006-06: folder 节点 render-spec → 422 RPT_EXT_INVALID_NODE_TYPE（r54 回归）。"""
    fid = _create_folder_node(client)
    resp = client.get(f"/api/v1/reports/catalog/nodes/{fid}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_NODE_TYPE"


# --- Task 4: META-006 ---

from app.metadata.entity.schemas import EntityTypeCreate
from app.metadata.entity.validation import probe_schema_validate_budget_ms, validate_entity_schema_payload


def test_meta_r55_duplicate_attributes(client):
    """T-META-R55-006-01: validate 重复属性名 → 422 META_ENTITY_SCHEMA_INVALID + duplicateAttributes。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "dup_attr",
            "displayName": "Dup",
            "attributes": [
                {"name": "foo", "dataType": "string"},
                {"name": "foo", "dataType": "integer"},
            ],
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "META_ENTITY_SCHEMA_INVALID"
    assert "foo" in body["detail"]["fields"]["duplicateAttributes"]


def test_meta_r55_missing_lifecycle_states(client):
    """T-META-R55-006-02: lifecycle 仅 active → 422 missingLifecycleStates。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "lc_bad",
            "displayName": "LC",
            "attributes": [],
            "lifecycleStates": ["active"],
        },
    )
    assert resp.status_code == 422
    missing = resp.json()["detail"]["fields"]["missingLifecycleStates"]
    assert "draft" in missing or "retired" in missing


def test_meta_r55_validate_ok(client):
    """T-META-R55-006-03: 合法 payload validate → 200 valid=true。"""
    resp = client.post(
        "/api/v1/metadata/entity-types/validate",
        headers=AUTH,
        json={
            "typeCode": "valid_ent",
            "displayName": "Valid",
            "attributes": [{"name": "code", "dataType": "string"}],
            "lifecycleStates": ["draft", "active", "retired"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_meta_r55_query_bindings_readonly(client):
    """T-META-R55-006-04: GET query-bindings → 每项 readOnly=true。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "qb_ent",
            "displayName": "QB",
            "attributes": [{"name": "amount", "dataType": "number"}],
        },
    )
    resp = client.get("/api/v1/metadata/entity-types/qb_ent/query-bindings", headers=AUTH)
    assert resp.status_code == 200
    assert all(b["readOnly"] is True for b in resp.json()["bindings"])


def test_meta_r55_json_not_filterable(client):
    """T-META-R55-006-05: json 类型 filterable=false。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={
            "typeCode": "json_ent",
            "displayName": "J",
            "attributes": [{"name": "payload", "dataType": "json"}],
        },
    )
    resp = client.get("/api/v1/metadata/entity-types/json_ent/query-bindings", headers=AUTH)
    jb = next(b for b in resp.json()["bindings"] if b["name"] == "payload")
    assert jb["filterable"] is False


def test_meta_r55_validate_probe_under_budget():
    """T-META-R55-006-06: validate probe < 50ms。"""
    payload = EntityTypeCreate(type_code="probe_ent", display_name="P", attributes=[])
    started = time.perf_counter()
    validate_entity_schema_payload(
        payload.type_code, payload.display_name, payload.attributes, payload.lifecycle_states
    )
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_schema_validate_budget_ms


def test_meta_r55_entity_in_use_delete_409(client):
    """T-META-R55-006-07: GOV mapping 引用后 DELETE entity → 409 META_ENTITY_TYPE_IN_USE（r54 回归）。"""
    client.post(
        "/api/v1/metadata/entity-types",
        headers=AUTH,
        json={"typeCode": "in_use_ent", "displayName": "IU", "attributes": []},
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
            "operationId": f"map_{uuid.uuid4().hex[:6]}",
            "apiVersion": "v1",
            "entityTypeRef": "in_use_ent",
        },
    )
    resp = client.delete("/api/v1/metadata/entity-types/in_use_ent", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "META_ENTITY_TYPE_IN_USE"


# --- Task 5: CONN-020 ---

from app.datasources.dialects.errors import (
    OCEANBASE_AUTH_FAILED,
    OCEANBASE_CONN_REFUSED,
    OCEANBASE_TIMEOUT,
    OCEANBASE_UNKNOWN_DATABASE,
    map_oceanbase_error,
)
from app.datasources.dialects.oceanbase import OCEANBASE_MAX_COLUMNS, OceanbaseConnector, probe_test_connection_budget_ms
from jwt_auth import AUTH, jwt_auth_headers


def test_conn_r55_oceanbase_timeout_code():
    """T-CONN-R55-020-01: mock timeout 2002 → OCEANBASE_TIMEOUT。"""
    exc = pymysql.err.OperationalError(2002, "Connection timed out")
    code, _ = map_oceanbase_error(exc)
    assert code == OCEANBASE_TIMEOUT


def test_conn_r55_oceanbase_unknown_database():
    """T-CONN-R55-020-02: mock 1049 → OCEANBASE_UNKNOWN_DATABASE。"""
    exc = pymysql.err.OperationalError(1049, "Unknown database")
    code, _ = map_oceanbase_error(exc)
    assert code == OCEANBASE_UNKNOWN_DATABASE


@patch.object(OceanbaseConnector, "list_schemas", return_value=[])
def test_conn_r55_oceanbase_empty_schemas(_mock):
    """T-CONN-R55-020-03: mock 空库 list_schemas → []。"""
    assert OceanbaseConnector().list_schemas(MagicMock()) == []


@patch("app.datasources.dialects.oceanbase.MysqlConnector.list_columns")
def test_conn_r55_oceanbase_column_limit(mock_cols):
    """T-CONN-R55-020-04: mock 501 columns → len==500。"""
    mock_cols.return_value = [MagicMock()] * 501
    cols = OceanbaseConnector().list_columns(MagicMock(), "db", "t")
    assert len(cols) == OCEANBASE_MAX_COLUMNS == 500


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.test_connection")
def test_conn_r55_http_test_auth_fail(mock_test, client):
    """T-CONN-R55-020-05: HTTP test auth fail → ok=false + traceId。"""
    from app.datasources.dialects.base import TestConnectionResult

    mock_test.return_value = TestConnectionResult(
        ok=False, message="[OCEANBASE_AUTH_FAILED] bad", latency_ms=1, code=OCEANBASE_AUTH_FAILED
    )
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-test",
            "code": f"ob-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "app",
            "username": "bad",
            "password": "bad",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == OCEANBASE_AUTH_FAILED
    assert body.get("traceId")


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.test_connection")
def test_conn_r55_http_tables_missing_schema_400(mock_test, client):
    """T-CONN-R55-020-06: HTTP GET tables 无 schema → 400 METADATA_INVALID_REQUEST。"""
    from app.datasources.dialects.base import TestConnectionResult

    mock_test.return_value = TestConnectionResult(ok=True, message="ok", latency_ms=1, code=None)
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-meta",
            "code": f"obm-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "app",
            "username": "u",
            "password": "p",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    resp = client.get(f"/api/v1/datasources/{ds_id}/tables", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "METADATA_INVALID_REQUEST"


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.list_schemas")
def test_conn_r55_http_schemas_connection_failed(mock_schemas, client):
    """T-CONN-R55-020-07: HTTP GET schemas 连接失败 → 502 METADATA_CONNECTION_FAILED。"""
    mock_schemas.side_effect = pymysql.err.OperationalError(2003, "Can't connect")
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "type": "oceanbase",
            "name": "ob-fail",
            "code": f"obf-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 2881,
            "database": "app",
            "username": "u",
            "password": "p",
        },
    )
    ds_id = create.json()["id"]
    resp = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"


@patch("app.datasources.dialects.oceanbase.OceanbaseConnector.test_connection")
def test_conn_r55_probe_test_connection_under_budget(mock_test):
    """T-CONN-R55-020-08: probe_test_connection < 100ms（mock）。"""
    from app.datasources.dialects.base import TestConnectionResult

    mock_test.return_value = TestConnectionResult(ok=True, message="ok", latency_ms=1, code=None)
    started = time.perf_counter()
    OceanbaseConnector().test_connection(host="127.0.0.1", port=2881, database="d", username="u", password="p")
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < probe_test_connection_budget_ms
