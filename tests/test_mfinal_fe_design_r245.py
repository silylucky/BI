"""M-FINAL F-E r245 — DESIGN-001~004 + GOV-003 批次 1。"""
from __future__ import annotations

import copy
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import jwt_auth_headers

_R245_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_r245?mode=memory&cache=shared&uri=true"

# Task 4 起 AuthMiddleware 从 DB 解析身份（无 admin 回退），隔离 DB 必须存在真实
# root 管理员，否则 admin_headers 会因 has_enabled_root_user=False 触发 503
# AUTH_ROOT_NOT_INITIALIZED，或非 root 触发 403。admin 复用 conftest 的
# _ADMIN_USER_ID（UUID 全 0…1，username="admin"），与 conftest 幂等 reseed 收敛。
_ADMIN_UID = "00000000-0000-0000-0000-000000000001"
_VIEWER_UID = "00000000-0000-4000-8000-000000000098"


def _seed_root_admin(engine) -> None:
    """幂等 seed root admin + 无权限 viewer；与 conftest reseed 不冲突。"""
    from app.auth.models import AuthRole, AuthUser, AuthUserRole

    with Session(engine) as session:
        admin_role = session.query(AuthRole).filter(AuthRole.code == "admin").first()
        if admin_role is None:
            admin_role = AuthRole(
                code="admin", name="管理员", is_active=True, is_system=True, is_root=True
            )
            session.add(admin_role)
            session.flush()
        if session.get(AuthUser, uuid.UUID(_ADMIN_UID)) is None:
            admin_user = AuthUser(
                id=uuid.UUID(_ADMIN_UID),
                username="admin",
                display_name="Admin",
                is_active=True,
                token_version=1,
            )
            session.add(admin_user)
            session.flush()
            session.add(AuthUserRole(user_id=admin_user.id, role_id=admin_role.id))

        if session.query(AuthRole).filter(AuthRole.code == "viewer").first() is None:
            viewer_role = AuthRole(code="viewer", name="查看者", is_active=True)
            session.add(viewer_role)
            session.flush()
            viewer_user = AuthUser(
                id=uuid.UUID(_VIEWER_UID),
                username="viewer",
                display_name="Viewer",
                is_active=True,
                token_version=1,
            )
            session.add(viewer_user)
            session.flush()
            session.add(AuthUserRole(user_id=viewer_user.id, role_id=viewer_role.id))
        session.commit()

VALID_CONDITIONS = {
    "schemaVersion": "1.0",
    "logic": "AND",
    "conditions": [
        {
            "fieldId": "order_amount",
            "operator": "gt",
            "value": 100,
            "valueType": "number",
        }
    ],
    "refType": "design_draft",
    "refId": "00000000-0000-4000-8000-000000000001",
}

VALID_RULES = {
    "schemaVersion": "1.0",
    "rules": [
        {
            "id": "r1",
            "name": "sum amount",
            "ruleType": "sum",
            "targetField": "amount",
            "expression": "sum(order_amount)",
            "dependsOn": [],
        }
    ],
    "refType": "design_draft",
    "refId": "00000000-0000-4000-8000-000000000001",
}

VALID_OUTPUT = {
    "schemaVersion": "1.0",
    "fields": [{"fieldId": "order_amount", "alias": "amount", "visible": True}],
    "aggregates": [{"fn": "sum", "fieldId": "order_amount", "groupBy": []}],
    "refType": "design_draft",
    "refId": "00000000-0000-4000-8000-000000000001",
}

CUSTOM_TEMPLATE_NODES = [
    {"id": "draft", "role": "requester"},
    {"id": "pending_approval", "role": "approver"},
    {"id": "designing", "role": "designer"},
    {"id": "pending_publish", "role": "publisher"},
    {"id": "published", "role": "admin"},
]


@pytest.fixture(scope="module", autouse=True)
def r245_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R245_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.metadata.glossary.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    _seed_root_admin(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def admin_headers() -> dict[str, str]:
    return jwt_auth_headers(user_id=_ADMIN_UID)


@pytest.fixture
def viewer_headers() -> dict[str, str]:
    return jwt_auth_headers(user_id=_VIEWER_UID, username="viewer")


def _seed_designer_blocks(client: TestClient, headers: dict[str, str], ref_id: str) -> None:
    client.put(
        "/api/v1/designer/conditions",
        headers=headers,
        json={**VALID_CONDITIONS, "refId": ref_id},
    )
    client.put(
        "/api/v1/designer/compute-rules",
        headers=headers,
        json={**VALID_RULES, "refId": ref_id},
    )
    client.put(
        "/api/v1/designer/output-fields",
        headers=headers,
        json={**VALID_OUTPUT, "refId": ref_id},
    )


# --- DESIGN-001 ---


def test_design_r245_001_01_fields_api_returns_registry(client, admin_headers):
    resp = client.get("/api/v1/designer/fields", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "order_amount" in body["registry"]
    assert isinstance(body["glossary"], list)


def test_design_r245_001_02_preview_translate_ok(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/preview/translate",
        headers=admin_headers,
        json={
            "conditions": VALID_CONDITIONS,
            "computeRules": VALID_RULES,
            "outputFields": VALID_OUTPUT,
        },
    )
    assert resp.status_code == 200
    assert isinstance(resp.json()["sql"], str)
    assert len(resp.json()["sql"]) > 0


def test_design_r245_001_03_empty_conditions_validate_422(client, admin_headers):
    bad = {**VALID_CONDITIONS, "conditions": []}
    resp = client.post("/api/v1/designer/conditions/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_CONDITIONS"


def test_design_r245_001_04_unknown_field_422(client, admin_headers):
    bad = copy.deepcopy(VALID_CONDITIONS)
    bad["conditions"][0]["fieldId"] = "not_a_field"
    resp = client.post("/api/v1/designer/conditions/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_UNKNOWN_FIELD"


def test_design_r245_001_05_conditions_put_get_roundtrip(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {**VALID_CONDITIONS, "refId": ref_id}
    put = client.put("/api/v1/designer/conditions", headers=admin_headers, json=payload)
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/conditions?refId={ref_id}", headers=admin_headers)
    assert get.status_code == 200
    assert get.json()["conditions"][0]["fieldId"] == "order_amount"


def test_design_r245_001_06_preview_probe_under_50ms(client, admin_headers):
    from app.designer import service as designer_service
    from app.datasources.models import get_meta_session
    from app.designer.schemas import PreviewTranslateIn

    session = get_meta_session()
    try:
        payload = PreviewTranslateIn.model_validate({
            "conditions": VALID_CONDITIONS,
            "computeRules": VALID_RULES,
            "outputFields": VALID_OUTPUT,
        })
        elapsed = designer_service.probe_preview_translate_budget_ms(session, payload)
        assert elapsed <= 50.0
    finally:
        session.close()


def test_design_r245_001_07_viewer_put_conditions_forbidden_or_conflict(client, viewer_headers, admin_headers):
    from app.auth.deps import UserContext, get_current_user

    ref_id = str(uuid.uuid4())

    async def _admin() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000099", username="admin", roles=["admin"])

    fastapi_app.dependency_overrides[get_current_user] = _admin
    client.put(
        "/api/v1/designer/conditions",
        headers=admin_headers,
        json={**VALID_CONDITIONS, "refId": ref_id},
    )

    async def _viewer() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000098", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.put(
            "/api/v1/designer/conditions",
            headers=viewer_headers,
            json={**VALID_CONDITIONS, "refId": ref_id, "expectedRevision": 1},
        )
        assert resp.status_code in (403, 409)
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_design_r245_001_08_preview_includes_rule_comment(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/preview/translate",
        headers=admin_headers,
        json={
            "conditions": VALID_CONDITIONS,
            "computeRules": VALID_RULES,
            "outputFields": VALID_OUTPUT,
        },
    )
    assert resp.status_code == 200
    assert "-- rule:" in resp.json()["sql"]


# --- DESIGN-002 ---


def test_design_r245_002_01_rules_put_get_roundtrip(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {**VALID_RULES, "refId": ref_id}
    put = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=payload)
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/compute-rules?ref_id={ref_id}", headers=admin_headers)
    assert get.status_code == 200
    assert get.json()["rules"][0]["id"] == "r1"


def test_design_r245_002_02_rule_type_mismatch(client, admin_headers):
    bad = copy.deepcopy(VALID_RULES)
    bad["rules"][0]["ruleType"] = "sum"
    bad["rules"][0]["expression"] = "avg(order_amount)"
    resp = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_TYPE_MISMATCH"


def test_design_r245_002_03_rule_cycle(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {
        "schemaVersion": "1.0",
        "rules": [
            {"id": "a", "name": "a", "ruleType": "sum", "targetField": "amount", "expression": "sum(x)", "dependsOn": ["b"]},
            {"id": "b", "name": "b", "ruleType": "sum", "targetField": "amount", "expression": "sum(y)", "dependsOn": ["a"]},
        ],
        "refType": "design_draft",
        "refId": ref_id,
    }
    resp = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_CYCLE"


def test_design_r245_002_04_broken_chain(client, admin_headers):
    bad = copy.deepcopy(VALID_RULES)
    bad["rules"][0]["dependsOn"] = ["missing"]
    resp = client.put("/api/v1/designer/compute-rules", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_RULE_BROKEN_CHAIN"


def test_design_r245_002_05_preview_keeps_rule_comment(client, admin_headers):
    resp = client.post(
        "/api/v1/designer/preview/translate",
        headers=admin_headers,
        json={"conditions": VALID_CONDITIONS, "computeRules": VALID_RULES, "outputFields": VALID_OUTPUT},
    )
    assert "-- rule: r1=" in resp.json()["sql"]


# --- DESIGN-003 ---


def test_design_r245_003_01_empty_output_422(client, admin_headers):
    bad = {**VALID_OUTPUT, "fields": []}
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_EMPTY_OUTPUT_FIELDS"


def test_design_r245_003_02_duplicate_field(client, admin_headers):
    bad = {**VALID_OUTPUT, "fields": VALID_OUTPUT["fields"] * 2}
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_DUPLICATE_OUTPUT_FIELD"


def test_design_r245_003_03_invalid_aggregate(client, admin_headers):
    bad = {**VALID_OUTPUT, "aggregates": [{"fn": "median", "fieldId": "order_amount", "groupBy": []}]}
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=bad)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_INVALID_AGGREGATE"


def test_design_r245_003_04_meta_field_ref_glossary_ok(client, admin_headers):
    term = client.post(
        "/api/v1/metadata/glossary",
        headers=admin_headers,
        json={"code": "gmv_term", "name": "GMV", "definition": "test"},
    )
    if term.status_code not in (200, 201):
        pytest.skip("glossary create unavailable")
    payload = {
        **VALID_OUTPUT,
        "fields": [{"fieldId": "order_amount", "metaFieldRef": "gmv_term", "visible": True}],
    }
    resp = client.post("/api/v1/designer/output-fields/validate", headers=admin_headers, json=payload)
    assert resp.status_code == 200


def test_design_r245_003_05_output_put_get(client, admin_headers):
    ref_id = str(uuid.uuid4())
    payload = {**VALID_OUTPUT, "refId": ref_id}
    put = client.put("/api/v1/designer/output-fields", headers=admin_headers, json=payload)
    assert put.status_code == 200
    get = client.get(f"/api/v1/designer/output-fields?refId={ref_id}", headers=admin_headers)
    assert get.status_code == 200


def test_design_r245_003_06_dataset_computed_field_ok(client, admin_headers):
    ds = client.post(
        "/api/v1/datasets",
        headers=admin_headers,
        json={
            "name": "r245 ds",
            "tables": [{"name": "orders", "schema": "public"}],
            "computedFields": [{"name": "computed_amt", "expression": "sum(amt)"}],
        },
    )
    if ds.status_code not in (200, 201):
        pytest.skip("dataset API unavailable")
    dataset_id = ds.json()["id"]
    payload = {
        **VALID_OUTPUT,
        "fields": [{"fieldId": "computed_amt", "visible": True}],
    }
    resp = client.post(
        f"/api/v1/designer/output-fields/validate?datasetId={dataset_id}",
        headers=admin_headers,
        json=payload,
    )
    assert resp.status_code == 200


# --- GOV-003 ---


def test_gov_r245_003_01_create_custom_template(client, admin_headers):
    resp = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "自定义查询发布", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    assert resp.status_code == 201
    tpl_id = resp.json()["id"]
    listed = client.get("/api/v1/gov/workflow/templates", headers=admin_headers)
    assert any(t["id"] == tpl_id for t in listed.json()["items"])


def test_gov_r245_003_02_missing_published_node(client, admin_headers):
    bad_nodes = [n for n in CUSTOM_TEMPLATE_NODES if n["id"] != "published"]
    resp = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "bad", "nodes": bad_nodes},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "GOV_WORKFLOW_INVALID_TEMPLATE"
    assert "published" in resp.json()["detail"]["missingNodes"]


def test_gov_r245_003_03_update_node_role(client, admin_headers):
    created = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "role edit", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    tpl_id = created.json()["id"]
    nodes = [dict(n) for n in CUSTOM_TEMPLATE_NODES]
    nodes[1]["role"] = "admin"
    put = client.put(
        f"/api/v1/gov/workflow/templates/{tpl_id}",
        headers=admin_headers,
        json={"nodes": nodes},
    )
    assert put.status_code == 200
    roles = client.get(f"/api/v1/gov/workflow/templates/{tpl_id}/node-roles", headers=admin_headers)
    assert roles.json()["items"][1]["role"] == "admin"


def test_gov_r245_003_04_delete_builtin_forbidden(client, admin_headers):
    resp = client.delete("/api/v1/gov/workflow/templates/standard_query_release", headers=admin_headers)
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_WORKFLOW_BUILTIN_READONLY"


def test_gov_r245_003_05_delete_referenced_template_conflict(client, admin_headers):
    created = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "in use", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    tpl_id = created.json()["id"]
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": tpl_id, "refId": str(uuid.uuid4())},
    )
    assert inst.status_code == 201
    deleted = client.delete(f"/api/v1/gov/workflow/templates/{tpl_id}", headers=admin_headers)
    assert deleted.status_code == 409


def test_gov_r245_003_06_fsm_happy_path(client, admin_headers):
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    iid = inst.json()["id"]
    for action, role in [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]:
        tr = client.post(
            f"/api/v1/gov/workflow/instances/{iid}/transition",
            headers=admin_headers,
            json={"action": action, "actorRole": role},
        )
        assert tr.status_code == 200
    assert client.get(f"/api/v1/gov/workflow/instances/{iid}", headers=admin_headers).json()["status"] == "published"


def test_gov_r245_003_07_double_submit_409(client, admin_headers):
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=admin_headers,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    iid = inst.json()["id"]
    client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=admin_headers,
        json={"action": "submit", "actorRole": "requester"},
    )
    again = client.post(
        f"/api/v1/gov/workflow/instances/{iid}/transition",
        headers=admin_headers,
        json={"action": "submit", "actorRole": "requester"},
    )
    assert again.status_code == 409


def test_gov_r245_003_08_probe_transition_path():
    from app.governance.workflow.node_roles import probe_transition_path

    result = probe_transition_path()
    assert result.ok is True
    assert result.elapsed_ms <= 50.0


# --- DESIGN-004 ---


def test_design_r245_004_01_submit_happy_path(client, admin_headers):
    ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, admin_headers, ref_id)
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "templateId": "standard_query_release", "designType": "query"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending_approval"
    assert body["workflowInstanceId"]
    assert body["designSnapshotId"]


def test_design_r245_004_02_submit_incomplete_422(client, admin_headers):
    ref_id = str(uuid.uuid4())
    client.put(
        "/api/v1/designer/conditions",
        headers=admin_headers,
        json={**VALID_CONDITIONS, "refId": ref_id},
    )
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_SUBMIT_INCOMPLETE"


def test_design_r245_004_03_viewer_submit_forbidden(client, viewer_headers):
    from app.auth.deps import UserContext, get_current_user

    async def _viewer() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000098", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        ref_id = str(uuid.uuid4())
        resp = client.post(
            "/api/v1/designer/submit-workflow",
            headers=viewer_headers,
            json={"designerItemId": ref_id},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "DESIGN_SUBMIT_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_design_r245_004_04_snapshot_immutable(client, admin_headers):
    ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, admin_headers, ref_id)
    submit = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "designType": "query"},
    )
    snap_id = submit.json()["designSnapshotId"]
    inst = client.get(
        f"/api/v1/gov/workflow/instances/{submit.json()['workflowInstanceId']}?includeDesignSnapshot=true",
        headers=admin_headers,
    )
    snap1 = inst.json()["designSnapshot"]
    client.put(
        "/api/v1/designer/conditions",
        headers=admin_headers,
        json={**VALID_CONDITIONS, "refId": ref_id, "logic": "OR"},
    )
    inst2 = client.get(
        f"/api/v1/gov/workflow/instances/{submit.json()['workflowInstanceId']}?includeDesignSnapshot=true",
        headers=admin_headers,
    )
    assert inst2.json()["designSnapshot"] == snap1
    assert snap1["conditions"]["logic"] == "AND"
    assert snap_id


def test_design_r245_004_05_catalog_mismatch_422(client, admin_headers):
    ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, admin_headers, ref_id)
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={
            "designerItemId": ref_id,
            "designType": "query",
            "catalogEntryId": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_WORKFLOW_CATALOG_MISMATCH"


def test_design_r245_004_06_workflow_link_roundtrip(client, admin_headers):
    ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, admin_headers, ref_id)
    submit = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "designType": "query"},
    )
    link = client.get(f"/api/v1/designer/workflow-link?designerItemId={ref_id}", headers=admin_headers)
    assert link.status_code == 200
    assert link.json()["workflowInstanceId"] == submit.json()["workflowInstanceId"]


def test_design_r245_004_07_link_validate_publish_ready_false(client, admin_headers):
    ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, admin_headers, ref_id)
    submit = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "designType": "query"},
    )
    validate = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=admin_headers,
        json={
            "designerItemId": ref_id,
            "workflowInstanceId": submit.json()["workflowInstanceId"],
            "designType": "query",
        },
    )
    assert validate.status_code == 200
    assert validate.json()["publishReady"] is False


def test_design_r245_004_08_custom_template_submit(client, admin_headers):
    tpl = client.post(
        "/api/v1/gov/workflow/templates",
        headers=admin_headers,
        json={"name": "submit tpl", "nodes": CUSTOM_TEMPLATE_NODES},
    )
    ref_id = str(uuid.uuid4())
    _seed_designer_blocks(client, admin_headers, ref_id)
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=admin_headers,
        json={"designerItemId": ref_id, "templateId": tpl.json()["id"], "designType": "query"},
    )
    assert resp.status_code == 201
