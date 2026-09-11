"""M13 设计器 + M11 OpenSearch + 治理/查询 L1 kickoff r49."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R49_SQLITE_URL = "sqlite+pysqlite:///file:design_conn_gov_query_r49?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r49_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R49_SQLITE_URL
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


def _ref_id() -> str:
    return str(uuid.uuid4())


def _designer_ref_payload(ref_id: str | None = None) -> dict:
    rid = ref_id or _ref_id()
    return {"refType": "design_draft", "refId": rid}


from app.query.config_store.schemas import ALLOWED_CONFIG_TYPES


def test_r49_fixture_bootstraps(client):
    """T-R49-000-01: r49 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r49_config_types_include_new_kinds():
    """T-R49-000-02: config_store 允许 sql_mode/output_fields/workflow_instance。"""
    assert {"sql_mode", "output_fields", "workflow_instance"}.issubset(ALLOWED_CONFIG_TYPES)


def test_design005_validate_select_ok_r49(client):
    """T-DESIGN-R49-005-01: 合法 SELECT 1 → validate 200。"""
    ref = _ref_id()
    ds_id = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": ds_id,
            "sql": "SELECT 1",
            **_designer_ref_payload(ref),
        },
    )
    assert resp.status_code == 200
    assert resp.json()["sql"] == "SELECT 1"


def test_design005_insert_not_readonly_r49(client):
    """T-DESIGN-R49-005-02: INSERT → 422 DESIGN_SQL_NOT_READONLY。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "INSERT INTO t VALUES(1)",
            **_designer_ref_payload(ref),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design005_empty_sql_r49(client):
    """T-DESIGN-R49-005-03: 空 SQL → 422 DESIGN_SQL_EMPTY。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "   ",
            **_designer_ref_payload(ref),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_EMPTY"


def test_design005_put_get_roundtrip_r49(client):
    """T-DESIGN-R49-005-04: PUT 合法 spec → GET 往返一致。"""
    ref = _ref_id()
    ds_id = str(uuid.uuid4())
    payload = {
        "dataSourceId": ds_id,
        "sql": "SELECT id FROM orders",
        **_designer_ref_payload(ref),
    }
    put = client.put("/api/v1/designer/sql-mode", headers=AUTH, json=payload)
    assert put.status_code == 200, put.text
    got = client.get(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        params={"refId": ref},
    )
    assert got.status_code == 200
    body = got.json()
    assert body["sql"] == payload["sql"]
    assert body["dataSourceId"] == ds_id


def test_design005_capabilities_r49(client):
    """T-DESIGN-R49-005-05: GET capabilities 含 maxSqlLength=65536。"""
    resp = client.get("/api/v1/designer/sql-mode/capabilities", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["maxSqlLength"] == 65536
    assert "SELECT" in body["allowedStatements"]


def _output_fields_payload(ref_id: str, fields: list[dict], aggregates: list[dict] | None = None) -> dict:
    return {
        "fields": fields,
        "aggregates": aggregates or [],
        **_designer_ref_payload(ref_id),
    }


def test_design003_put_get_roundtrip_r49(client):
    """T-DESIGN-R49-003-01: 合法 fields PUT → GET 往返。"""
    ref = _ref_id()
    payload = _output_fields_payload(
        ref,
        [{"fieldId": "order_amount", "alias": "amt", "visible": True}],
    )
    put = client.put("/api/v1/designer/output-fields", headers=AUTH, json=payload)
    assert put.status_code == 200, put.text
    got = client.get("/api/v1/designer/output-fields", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["fields"][0]["fieldId"] == "order_amount"


def test_design003_empty_fields_r49(client):
    """T-DESIGN-R49-003-02: 空 fields → 422 DESIGN_EMPTY_OUTPUT_FIELDS。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(ref, []),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_OUTPUT_FIELDS"


def test_design003_unknown_field_r49(client):
    """T-DESIGN-R49-003-03: 未知 fieldId → 422 DESIGN_UNKNOWN_FIELD。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(ref, [{"fieldId": "not_a_field"}]),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"


def test_design003_invalid_aggregate_r49(client):
    """T-DESIGN-R49-003-04: 非法聚合 fn median → 422 DESIGN_INVALID_AGGREGATE。"""
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(
            ref,
            [{"fieldId": "order_amount"}],
            [{"fn": "median", "fieldId": "order_amount", "groupBy": []}],
        ),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design003_meta_field_ref_glossary_r49(client):
    """T-DESIGN-R49-003-05: metaFieldRef=order_amount（glossary 存在）→ 200。"""
    client.post(
        "/api/v1/metadata/glossary",
        headers=AUTH,
        json={"code": "order_amount", "name": "订单金额"},
    )
    ref = _ref_id()
    resp = client.post(
        "/api/v1/designer/output-fields/validate",
        headers=AUTH,
        json=_output_fields_payload(
            ref,
            [{"fieldId": "order_amount", "metaFieldRef": "order_amount"}],
        ),
    )
    assert resp.status_code == 200


def test_design003_coexist_with_sql_mode_r49(client):
    """T-DESIGN-R49-003-06: 同 ref_id 可并存读取 conditions + output-fields + sql-mode。"""
    ref = _ref_id()
    client.put(
        "/api/v1/designer/conditions",
        headers=AUTH,
        json={
            "logic": "AND",
            "conditions": [
                {
                    "fieldId": "order_amount",
                    "operator": "gt",
                    "value": 0,
                    "valueType": "number",
                }
            ],
            **_designer_ref_payload(ref),
        },
    )
    client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json=_output_fields_payload(ref, [{"fieldId": "order_amount"}]),
    )
    client.put(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1",
            **_designer_ref_payload(ref),
        },
    )
    assert client.get("/api/v1/designer/conditions", headers=AUTH, params={"refId": ref}).status_code == 200
    assert client.get("/api/v1/designer/output-fields", headers=AUTH, params={"refId": ref}).status_code == 200
    assert client.get("/api/v1/designer/sql-mode", headers=AUTH, params={"refId": ref}).status_code == 200


from unittest.mock import MagicMock, patch

from app.core.nfr.plugin_extension import get_plugin_registration_meta
from app.datasources.dialects.opensearch import OpensearchConnector
from app.datasources.registry import export_type_catalog
from jwt_auth import AUTH, jwt_auth_headers


def test_conn016_opensearch_in_catalog_r49():
    """T-CONN-R49-016-01: export_type_catalog 含 opensearch category=search。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "opensearch" in types
    assert types["opensearch"]["category"] == "search"


def test_conn016_plugin_registration_meta_r49():
    """T-CONN-R49-016-02: get_plugin_registration_meta(opensearch) registered_via=plugin。"""
    meta = get_plugin_registration_meta("opensearch")
    assert meta is not None
    assert meta["registered_via"] == "plugin"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn016_test_connection_ok_r49(mock_os_cls):
    """T-CONN-R49-016-03: mock client.info 成功 → ok=True。"""
    mock_os_cls.return_value.info.return_value = {"version": {"number": "2.11.0"}}
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="", password="")
    assert result.ok is True


def test_conn016_empty_host_r49():
    """T-CONN-R49-016-04: 空 host → OPENSEARCH_INVALID_HOST。"""
    conn = OpensearchConnector()
    result = conn.test_connection(host="  ", port=9200, database="", username="", password="")
    assert result.ok is False
    assert result.code == "OPENSEARCH_INVALID_HOST"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn016_auth_failed_r49(mock_os_cls):
    """T-CONN-R49-016-05: mock 401 → OPENSEARCH_AUTH_FAILED。"""
    mock_os_cls.return_value.info.side_effect = Exception("authentication failed 401")
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="u", password="p")
    assert result.ok is False
    assert result.code == "OPENSEARCH_AUTH_FAILED"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn016_list_columns_truncate_r49(mock_os_cls):
    """T-CONN-R49-016-06: list_columns 超 500 字段 truncate。"""
    props = {f"f{i}": {"type": "keyword"} for i in range(510)}
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    mock_os_cls.return_value = mock_client
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    cols = conn.list_columns(client, "idx", "_doc")
    assert len(cols) == 500


def test_gov003_list_templates_r49(client):
    """T-GOV-R49-003-01: GET templates 含 standard_query_release。"""
    resp = client.get("/api/v1/gov/workflow/templates", headers=AUTH)
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()["items"]]
    assert "standard_query_release" in ids


def test_gov003_create_instance_draft_r49(client):
    """T-GOV-R49-003-02: POST instance → status=draft。"""
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "draft"


def test_gov003_happy_path_fsm_r49(client):
    """T-GOV-R49-003-03..06: 五态迁移 happy path。"""
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    iid = inst["id"]

    def trans(action: str, role: str) -> str:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text
        return r.json()["status"]

    assert trans("submit", "requester") == "pending_approval"
    assert trans("approve", "approver") == "designing"
    assert trans("complete_design", "designer") == "pending_publish"
    assert trans("publish", "publisher") == "published"


def test_gov003_invalid_transition_r49(client):
    """T-GOV-R49-003-07: draft + publish → 400 GOV_WORKFLOW_INVALID_TRANSITION。"""
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{inst['id']}/transition",
        headers=AUTH,
        json={"action": "publish", "actorRole": "publisher"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "GOV_WORKFLOW_INVALID_TRANSITION"


def test_gov003_forbidden_role_r49(client):
    """T-GOV-R49-003-08: pending_approval + approve + requester → 403 GOV_WORKFLOW_FORBIDDEN_ROLE。"""
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    client.post(
        f"/api/v1/gov/workflow/instances/{inst['id']}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{inst['id']}/transition",
        headers=AUTH,
        json={"action": "approve", "actorRole": "requester"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_WORKFLOW_FORBIDDEN_ROLE"


def test_query003_routing_modes_r49(client):
    """T-QUERY-R49-003-01: opensearch→native，mysql→sql。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    assert resp.status_code == 200
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes["opensearch"] == "native"
    assert modes["mysql"] == "sql"


def test_query003_native_validate_ok_r49(client):
    """T-QUERY-R49-003-02: opensearch + 合法 body 无 sql → 200。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": {"match_all": {}}},
            "index": "logs",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["resolvedMode"] == "native"


def test_query003_sql_disguise_r49(client):
    """T-QUERY-R49-003-03: native + sql 字段 → 422 QUERY_NATIVE_SQL_DISGUISE。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": {"match_all": {}}},
            "sql": "SELECT 1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_SQL_DISGUISE"


def test_query003_wrong_mode_mysql_body_r49(client):
    """T-QUERY-R49-003-04: mysql + body 无 sql → 422 QUERY_NATIVE_WRONG_MODE。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "mysql", "body": {"x": 1}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_WRONG_MODE"


def test_query003_empty_body_r49(client):
    """T-QUERY-R49-003-05: native + 空 body → 422 QUERY_NATIVE_EMPTY_BODY。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "opensearch", "body": {}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_EMPTY_BODY"


def test_query003_unsupported_connector_r49(client):
    """T-QUERY-R49-003-06: 未知 connectorType → 422 QUERY_NATIVE_UNSUPPORTED_CONNECTOR。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "not_a_connector", "body": {"q": 1}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_UNSUPPORTED_CONNECTOR"


def test_r49_link_same_ref_three_designer_configs_r49(client):
    """T-R49-LINK-01: 同 ref 读取 conditions + output-fields + sql-mode（复用 design003 用例逻辑）。"""
    ref = _ref_id()
    assert client.put(
        "/api/v1/designer/compute-rules",
        headers=AUTH,
        json={
            "rules": [
                {
                    "id": "r1",
                    "name": "sum",
                    "ruleType": "sum",
                    "targetField": "amount",
                    "expression": "sum(order_amount)",
                    "dependsOn": [],
                }
            ],
            **_designer_ref_payload(ref),
        },
    ).status_code == 200
    test_design003_coexist_with_sql_mode_r49(client)


def test_r49_link_health_r49(client):
    """T-R49-LINK-02: /health 200。"""
    assert client.get("/health").status_code == 200


def test_gov003_get_instance_r49(client):
    """T-GOV-R49-003-09: GET instance 返回 draft 状态。"""
    created = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    ).json()
    resp = client.get(f"/api/v1/gov/workflow/instances/{created['id']}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_gov003_validate_template_ok_r49(client):
    """T-GOV-R49-003-10: POST templates/validate 合法模板 → 200。"""
    resp = client.post(
        "/api/v1/gov/workflow/templates/validate",
        headers=AUTH,
        json={
            "id": "custom_flow",
            "name": "Custom",
            "nodes": [
                {"id": "draft", "role": "requester"},
                {"id": "published", "role": "publisher"},
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == "custom_flow"


def test_r49_suite_has_minimum_tests():
    """T-R49-META-01: r49 套件 ≥35 条测试函数。"""
    import inspect

    import test_design_conn_gov_query_r49 as mod

    count = len([n for n, o in inspect.getmembers(mod) if n.startswith("test_") and callable(o)])
    assert count >= 35
