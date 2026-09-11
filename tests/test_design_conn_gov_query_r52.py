"""M13 设计器 + M11 OpenSearch + 治理/查询 companion 质量推分 r52."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

_R52_SQLITE_URL = "sqlite+pysqlite:///file:design_conn_gov_query_r52?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r52_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R52_SQLITE_URL
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


def _create_workflow_instance(client: TestClient) -> dict:
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()

from app.governance.workflow.node_roles import probe_transition_path, resolve_required_role


def test_r52_fixture_bootstraps(client):
    """T-R52-000-01: r52 sqlite 环境 health 可达。"""
    assert client.get("/health").status_code == 200


def test_gov_r52_node_roles_standard_template(client):
    """T-GOV-R52-003-01: GET node-roles standard_query_release → 5 项含 requester/approver/designer/publisher。"""
    resp = client.get(
        "/api/v1/gov/workflow/templates/standard_query_release/node-roles",
        headers=AUTH,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) == 5
    roles = {i["role"] for i in items}
    assert {"requester", "approver", "designer", "publisher"}.issubset(roles)


def test_gov_r52_resolve_required_role_pending_approval():
    """T-GOV-R52-003-02: resolve_required_role pending_approval == approver。"""
    from app.datasources.models import get_meta_session
    from app.governance.workflow.node_roles import resolve_required_role

    session = get_meta_session()
    try:
        assert resolve_required_role(session, "standard_query_release", "pending_approval") == "approver"
    finally:
        session.close()


def test_gov_r52_validate_template_missing_published_node(client):
    """T-GOV-R52-003-03: validate 模板缺 published 节点 → 422 GOV_WORKFLOW_INVALID_TEMPLATE。"""
    resp = client.post(
        "/api/v1/gov/workflow/templates/validate",
        headers=AUTH,
        json={
            "id": "bad_tpl",
            "name": "Bad",
            "nodes": [
                {"id": "draft", "role": "requester"},
                {"id": "pending_approval", "role": "approver"},
            ],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_WORKFLOW_INVALID_TEMPLATE"
    assert "missingNodes" in (resp.json().get("detail") or {})


def test_gov_r52_double_submit_conflict(client):
    """T-GOV-R52-003-04: draft 双 submit → 第二次 409 GOV_WORKFLOW_CONFLICT。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    first = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    assert second.status_code == 409
    assert second.json()["code"] == "GOV_WORKFLOW_CONFLICT"


def test_gov_r52_published_terminal_conflict(client):
    """T-GOV-R52-003-05: published 再 publish → 409 GOV_WORKFLOW_ALREADY_TERMINAL。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    path = [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]
    for action, role in path:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text
    again = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "publish", "actorRole": "publisher"},
    )
    assert again.status_code == 409
    assert again.json()["code"] == "GOV_WORKFLOW_ALREADY_TERMINAL"


def test_gov_r52_reject_path_regression(client):
    """T-GOV-R52-003-06: reject 路径 pending_approval → draft（r49 回归）。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    reject = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "reject", "actorRole": "approver"},
    )
    assert reject.status_code == 200
    assert reject.json()["status"] == "draft"


def test_gov_r52_probe_transition_path_budget():
    """T-GOV-R52-003-07: probe_transition_path elapsed < 50ms。"""
    result = probe_transition_path()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_gov_r52_node_roles_unknown_template(client):
    """T-GOV-R52-003-08: HTTP node-roles 404 未知模板。"""
    resp = client.get(
        "/api/v1/gov/workflow/templates/unknown_tpl/node-roles",
        headers=AUTH,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "GOV_WORKFLOW_TEMPLATE_NOT_FOUND"


def test_gov_r52_happy_path_fsm_regression(client):
    """T-GOV-R52-003-09: r49 happy path FSM 仍 200。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    for action, role in [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text
    assert r.json()["status"] == "published"


def test_gov_r52_forbidden_role_regression(client):
    """T-GOV-R52-003-10: forbidden role 仍 403 GOV_WORKFLOW_FORBIDDEN_ROLE。"""
    inst = _create_workflow_instance(client)
    iid = inst["id"]
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "approver"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_WORKFLOW_FORBIDDEN_ROLE"


from app.designer.sql_mode import probe_validate_sql_mode


def test_design_r52_005_select_ok_regression(client):
    """T-DESIGN-R52-005-01: SELECT 1 validate 200（r49 回归）。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1", **_designer_ref_payload()},
    )
    assert resp.status_code == 200


def test_design_r52_005_insert_remediation(client):
    """T-DESIGN-R52-005-02: INSERT → 422 + detail.remediation 非空。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "INSERT INTO t VALUES(1)",
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "DESIGN_SQL_NOT_READONLY"
    assert body.get("detail", {}).get("remediation")


def test_design_r52_005_comment_hidden_dml(client):
    """T-DESIGN-R52-005-03: 注释隐藏 DML 多语句 → 422 DESIGN_SQL_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1; INSERT INTO t VALUES(1)",
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design_r52_005_for_update_clause(client):
    """T-DESIGN-R52-005-04: FOR UPDATE 子句 → 422 只读拦截。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT * FROM t FOR UPDATE",
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"


def test_design_r52_005_sql_too_long(client):
    """T-DESIGN-R52-005-05: SQL 长度 65537 → DESIGN_SQL_TOO_LONG。"""
    resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT " + "x" * 65530,
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SQL_TOO_LONG"


def test_design_r52_005_probe_budget():
    """T-DESIGN-R52-005-06: probe_validate_sql_mode < 50ms。"""
    result = probe_validate_sql_mode()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_design_r52_005_chart_render_spec_insert(client):
    """T-DESIGN-R52-005-07: POST /charts/render-spec sql 模式 + INSERT → 422 CHART_SQL_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/charts/render-spec",
        headers=AUTH,
        json={
            "chartType": "table",
            "mode": "sql",
            "dataSourceId": str(uuid.uuid4()),
            "sql": "INSERT INTO t VALUES(1)",
            "dimensions": [{"field": "id"}],
            "metrics": [{"field": "amount"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CHART_SQL_NOT_READONLY"


def test_design_r52_005_chart_render_spec_select_ok(client):
    """T-DESIGN-R52-005-08: POST /charts/render-spec sql 模式 + SELECT 1 → 200。"""
    resp = client.post(
        "/api/v1/charts/render-spec",
        headers=AUTH,
        json={
            "chartType": "table",
            "mode": "sql",
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1",
            "dimensions": [{"field": "id"}],
            "metrics": [{"field": "amount"}],
        },
    )
    assert resp.status_code == 200


def test_design_r52_005_put_get_roundtrip_regression(client):
    """T-DESIGN-R52-005-09: PUT sql-mode + GET 往返（r49 回归）。"""
    ref = _ref_id()
    payload = {
        "dataSourceId": str(uuid.uuid4()),
        "sql": "SELECT id FROM orders",
        **_designer_ref_payload(ref),
    }
    assert client.put("/api/v1/designer/sql-mode", headers=AUTH, json=payload).status_code == 200
    got = client.get("/api/v1/designer/sql-mode", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200
    assert got.json()["sql"] == payload["sql"]


def test_design_r52_005_capabilities_regression(client):
    """T-DESIGN-R52-005-10: capabilities maxSqlLength=65536（r49 回归）。"""
    resp = client.get("/api/v1/designer/sql-mode/capabilities", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["maxSqlLength"] == 65536


from app.query.native.guard import probe_list_routing_modes


def test_query_r52_003_opensearch_validate_regression(client):
    """T-QUERY-R52-003-01: opensearch validate 200（r49 回归）。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "opensearch", "body": {"query": {"match_all": {}}}},
    )
    assert resp.status_code == 200
    assert resp.json()["resolvedMode"] == "native"


def test_query_r52_003_mysql_wrong_mode_regression(client):
    """T-QUERY-R52-003-02: mysql + body 无 sql → QUERY_NATIVE_WRONG_MODE（回归）。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={"connectorType": "mysql", "body": {"q": 1}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_WRONG_MODE"


def test_query_r52_003_native_body_injection(client):
    """T-QUERY-R52-003-03: native body 含 DROP → QUERY_NATIVE_INJECTION_SUSPECT。"""
    resp = client.post(
        "/api/v1/query/native/validate",
        headers=AUTH,
        json={
            "connectorType": "opensearch",
            "body": {"query": "1; DROP TABLE users"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_INJECTION_SUSPECT"


def test_query_r52_003_parameters_injection(client):
    """T-QUERY-R52-003-04: parameters id=1; DROP → QUERY_PARAM_INJECTION_SUSPECT。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={
            "connectorType": "mysql",
            "sql": "SELECT :id",
            "parameters": {"id": "1; DROP"},
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_PARAM_INJECTION_SUSPECT"


def test_query_r52_003_readonly_guard_mysql_select(client):
    """T-QUERY-R52-003-05: readonly-guard mysql + SELECT 1 → ok=true mode=sql。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "mysql", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["mode"] == "sql"


def test_query_r52_003_readonly_guard_delete(client):
    """T-QUERY-R52-003-06: readonly-guard mysql + DELETE → 422 QUERY_NOT_READONLY。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "mysql", "sql": "DELETE FROM t"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_query_r52_003_readonly_guard_opensearch_sql_disguise(client):
    """T-QUERY-R52-003-07: readonly-guard opensearch + sql → QUERY_NATIVE_SQL_DISGUISE。"""
    resp = client.post(
        "/api/v1/query/readonly-guard",
        headers=AUTH,
        json={"connectorType": "opensearch", "sql": "SELECT 1"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_NATIVE_SQL_DISGUISE"


def test_query_r52_003_probe_routing_budget():
    """T-QUERY-R52-003-08: probe_list_routing_modes < 50ms。"""
    result = probe_list_routing_modes()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_query_r52_003_routing_modes_regression(client):
    """T-QUERY-R52-003-09: routing modes opensearch=native mysql=sql（回归）。"""
    resp = client.get("/api/v1/query/routing/modes", headers=AUTH)
    modes = {m["connectorType"]: m["mode"] for m in resp.json()["modes"]}
    assert modes["opensearch"] == "native"
    assert modes["mysql"] == "sql"


def test_query_r52_003_binding_insert_regression(client):
    """T-QUERY-R52-003-10: binding sql 模式 INSERT 仍 400（QUERY-001 对齐）。"""
    resp = client.post(
        "/api/v1/query/bindings",
        headers=AUTH,
        json={
            "name": "r52-binding",
            "dataSourceId": str(uuid.uuid4()),
            "mode": "sql",
            "sql": "INSERT INTO t VALUES(1)",
        },
    )
    assert resp.status_code in (400, 422)
    assert resp.json()["code"] in ("QUERY_NOT_READONLY", "QUERY_BINDING_INVALID")


from app.designer.output_fields import probe_validate_output_fields
from app.designer.schemas import OutputFieldItem, OutputFieldsConfig, AggregateItem


def _valid_output_fields(n_fields: int = 1, n_aggs: int = 0) -> OutputFieldsConfig:
    fields = [
        OutputFieldItem(fieldId="order_amount") for _ in range(n_fields)
    ]
  # 重复 fieldId 测试用自定义列表
    return OutputFieldsConfig(
        fields=fields,
        aggregates=[
            AggregateItem(fn="sum", fieldId="order_amount", groupBy=[])
            for _ in range(n_aggs)
        ],
        refId=uuid.uuid4(),
    )


def test_design_r52_003_put_get_regression(client):
    """T-DESIGN-R52-003-01: 合法 PUT/GET 往返（r49 回归）。"""
    ref = _ref_id()
    payload = {
        "fields": [{"fieldId": "order_amount"}],
        "aggregates": [],
        **_designer_ref_payload(ref),
    }
    assert client.put("/api/v1/designer/output-fields", headers=AUTH, json=payload).status_code == 200
    got = client.get("/api/v1/designer/output-fields", headers=AUTH, params={"refId": ref})
    assert got.status_code == 200


def test_design_r52_003_empty_fields_regression(client):
    """T-DESIGN-R52-003-02: 空 fields → DESIGN_EMPTY_OUTPUT_FIELDS（回归）。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={"fields": [], "aggregates": [], **_designer_ref_payload()},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_OUTPUT_FIELDS"


def test_design_r52_003_too_many_fields(client):
    """T-DESIGN-R52-003-03: 65 个 fields → DESIGN_TOO_MANY_OUTPUT_FIELDS。"""
    fields = [{"fieldId": "order_amount", "alias": f"f{i}"} for i in range(65)]
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={"fields": fields, "aggregates": [], **_designer_ref_payload()},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_TOO_MANY_OUTPUT_FIELDS"


def test_design_r52_003_duplicate_field_id(client):
    """T-DESIGN-R52-003-04: 重复 fieldId → DESIGN_DUPLICATE_OUTPUT_FIELD。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "order_amount"}, {"fieldId": "order_amount"}],
            "aggregates": [],
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_DUPLICATE_OUTPUT_FIELD"


def test_design_r52_003_too_many_aggregates(client):
    """T-DESIGN-R52-003-05: 17 aggregates → DESIGN_TOO_MANY_AGGREGATES。"""
    aggs = [{"fn": "sum", "fieldId": "order_amount", "groupBy": []} for _ in range(17)]
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "order_amount"}],
            "aggregates": aggs,
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_TOO_MANY_AGGREGATES"


def test_design_r52_003_unknown_field_regression(client):
    """T-DESIGN-R52-003-06: 未知 fieldId（回归）。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "not_in_registry"}],
            "aggregates": [],
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"


def test_design_r52_003_invalid_aggregate_regression(client):
    """T-DESIGN-R52-003-07: 非法 aggregate fn（回归）。"""
    resp = client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={
            "fields": [{"fieldId": "order_amount"}],
            "aggregates": [{"fn": "median", "fieldId": "order_amount", "groupBy": []}],
            **_designer_ref_payload(),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design_r52_003_probe_budget(client):
    """T-DESIGN-R52-003-08: probe_validate_output_fields < 50ms。"""
    from app.datasources.models import get_meta_engine
    from sqlalchemy.orm import Session

    engine = get_meta_engine()
    with Session(engine) as session:
        result = probe_validate_output_fields(session)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_design_r52_003_sql_mode_coexist_regression(client):
    """T-DESIGN-R52-003-09: 同 ref sql_mode + output_fields 并存（回归）。"""
    ref = _ref_id()
    base = _designer_ref_payload(ref)
    assert client.put(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "sql": "SELECT 1", **base},
    ).status_code == 200
    assert client.put(
        "/api/v1/designer/output-fields",
        headers=AUTH,
        json={"fields": [{"fieldId": "order_amount"}], "aggregates": [], **base},
    ).status_code == 200


from unittest.mock import MagicMock, patch

from app.datasources.dialects.opensearch import OpensearchConnector, probe_list_columns_mock
from app.datasources.registry import export_type_catalog
from jwt_auth import AUTH, jwt_auth_headers


def test_conn_r52_016_catalog_regression():
    """T-CONN-R52-016-01: catalog 含 opensearch（回归）。"""
    types = {item["type"]: item for item in export_type_catalog()}
    assert "opensearch" in types


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_mock_info_ok(mock_os_cls):
    """T-CONN-R52-016-02: mock info 成功（回归）。"""
    mock_os_cls.return_value.info.return_value = {"version": {"number": "2.11.0"}}
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="", password="")
    assert result.ok is True


def test_conn_r52_016_empty_host_regression():
    """T-CONN-R52-016-03: 空 host OPENSEARCH_INVALID_HOST（回归）。"""
    conn = OpensearchConnector()
    result = conn.test_connection(host="  ", port=9200, database="", username="", password="")
    assert result.ok is False
    assert result.code == "OPENSEARCH_INVALID_HOST"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_auth_failed_regression(mock_os_cls):
    """T-CONN-R52-016-04: mock 401 OPENSEARCH_AUTH_FAILED（回归）。"""
    mock_os_cls.return_value.info.side_effect = Exception("authentication failed 401")
    conn = OpensearchConnector()
    result = conn.test_connection(host="localhost", port=9200, database="", username="u", password="p")
    assert result.ok is False
    assert result.code == "OPENSEARCH_AUTH_FAILED"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_empty_indices(mock_os_cls):
    """T-CONN-R52-016-05: mock 空 indices list_schemas → []。"""
    mock_os_cls.return_value.cat.indices.return_value = []
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    assert conn.list_schemas(client) == []


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_empty_properties(mock_os_cls):
    """T-CONN-R52-016-06: mock 空 properties list_columns → []。"""
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {}}}
    mock_os_cls.return_value = mock_client
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    assert conn.list_columns(client, "idx", "_doc") == []


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_truncate_500_regression(mock_os_cls):
    """T-CONN-R52-016-07: 501 字段 truncate 500（回归）。"""
    props = {f"f{i}": {"type": "keyword"} for i in range(510)}
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    mock_os_cls.return_value = mock_client
    conn = OpensearchConnector()
    client = conn.open_connection(host="h", port=9200, database="", username="", password="")
    assert len(conn.list_columns(client, "idx", "_doc")) == 500


def test_conn_r52_016_http_test_auth_fail_trace(client):
    """T-CONN-R52-016-08: HTTP POST test auth fail → code + traceId。"""
    with patch("app.datasources.dialects.opensearch.OpenSearch") as mock_os_cls:
        mock_os_cls.return_value.info.side_effect = Exception("authentication failed 401")
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "name": "os-r52-test",
                "code": f"os-t-{uuid.uuid4().hex[:8]}",
                "type": "opensearch",
                "host": "localhost",
                "port": 9200,
                "database": "demo",
                "username": "u",
                "password": "p",
            },
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["code"] == "OPENSEARCH_AUTH_FAILED"
    assert body.get("traceId")


def test_conn_r52_016_http_schemas_connection_failed(client):
    """T-CONN-R52-016-09: HTTP GET schemas 连接失败 → 502 METADATA_CONNECTION_FAILED。"""
    slug = uuid.uuid4().hex[:8]
    create = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": f"os-r52-{slug}",
            "code": f"os-r52-{slug}",
            "type": "opensearch",
            "host": "localhost",
            "port": 9200,
            "database": "demo",
            "username": "u",
            "password": "p",
        },
    )
    assert create.status_code == 201, create.text
    ds_id = create.json()["id"]
    with patch("app.datasources.dialects.opensearch.OpenSearch") as mock_os:
        mock_os.return_value.cat.indices.side_effect = Exception("connection refused")
        resp = client.get(f"/api/v1/datasources/{ds_id}/schemas", headers=AUTH)
    assert resp.status_code == 502
    assert resp.json()["code"] == "METADATA_CONNECTION_FAILED"


@patch("app.datasources.dialects.opensearch.OpenSearch")
def test_conn_r52_016_probe_budget(mock_os_cls):
    """T-CONN-R52-016-10: probe_list_columns_mock < 100ms。"""
    props = {f"f{i}": {"type": "keyword"} for i in range(510)}
    mock_client = MagicMock()
    mock_client.indices.get_mapping.return_value = {"idx": {"mappings": {"properties": props}}}
    conn = OpensearchConnector()
    result = probe_list_columns_mock(mock_client, "idx")
    assert result.ok is True
    assert result.elapsed_ms < 100


def test_r52_cross_designer_sql_and_chart_readonly_aligned(client):
    """T-R52-X-01: designer validate 与 chart render-spec 对同一 INSERT SQL 均拒绝。"""
    bad_sql = "INSERT INTO t VALUES(1)"
    ds = str(uuid.uuid4())
    ref = _designer_ref_payload()
    d_resp = client.post(
        "/api/v1/designer/sql-mode/validate",
        headers=AUTH,
        json={"dataSourceId": ds, "sql": bad_sql, **ref},
    )
    c_resp = client.post(
        "/api/v1/charts/render-spec",
        headers=AUTH,
        json={
            "chartType": "table",
            "mode": "sql",
            "dataSourceId": ds,
            "sql": bad_sql,
            "dimensions": [{"field": "id"}],
            "metrics": [{"field": "amount"}],
        },
    )
    assert d_resp.status_code == 422
    assert c_resp.status_code == 422
    assert d_resp.json()["code"] == "DESIGN_SQL_NOT_READONLY"
    assert c_resp.json()["code"] == "CHART_SQL_NOT_READONLY"


def test_r52_cross_gov_workflow_and_designer_same_ref(client):
    """T-R52-X-02: 同一 design_draft ref 可并存 workflow instance + sql_mode。"""
    ref = str(uuid.uuid4())
    wf = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": ref},
    )
    sql = client.put(
        "/api/v1/designer/sql-mode",
        headers=AUTH,
        json={
            "refType": "design_draft",
            "refId": ref,
            "dataSourceId": str(uuid.uuid4()),
            "sql": "SELECT 1",
        },
    )
    assert wf.status_code == 201
    assert sql.status_code == 200
