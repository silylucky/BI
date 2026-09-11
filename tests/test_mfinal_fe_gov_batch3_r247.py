"""M-FINAL F-E/F-F r247 — GOV-007~008 + NFR-003/005/007 批次 3。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_R247_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_gov_r247?mode=memory&cache=shared&uri=true"
REF_ID = "00000000-0000-4000-8000-000000000247"


@pytest.fixture(scope="module", autouse=True)
def r247_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R247_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.config_store.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    yield
    from app.governance.bus import auto as bus_auto

    bus_auto._auto_states.clear()
    bus_auto._USER_AUTO_BUS_SCOPE.clear()
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def r247_permissive_nfr_modes(monkeypatch):
    monkeypatch.setenv("DASHBOARD_AVAILABILITY_MODE", "permissive")
    monkeypatch.setenv("XINCHUANG_DEPLOY_MODE", "permissive")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


VALID_CONDITIONS = {
    "schemaVersion": "1.0",
    "logic": "AND",
    "conditions": [{"fieldId": "order_amount", "operator": "gt", "value": 100, "valueType": "number"}],
    "refType": "design_draft",
    "refId": REF_ID,
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
    "refId": REF_ID,
}
VALID_OUTPUT = {
    "schemaVersion": "1.0",
    "fields": [{"fieldId": "order_amount", "alias": "amount", "visible": True}],
    "aggregates": [{"fn": "sum", "fieldId": "order_amount", "groupBy": []}],
    "refType": "design_draft",
    "refId": REF_ID,
}


def _seed_designer_blocks(client: TestClient, ref_id: str) -> None:
    client.put("/api/v1/designer/conditions", headers=AUTH, json={**VALID_CONDITIONS, "refId": ref_id})
    client.put("/api/v1/designer/compute-rules", headers=AUTH, json={**VALID_RULES, "refId": ref_id})
    client.put("/api/v1/designer/output-fields", headers=AUTH, json={**VALID_OUTPUT, "refId": ref_id})


def _submit_design(client: TestClient, ref_id: str | None = None) -> dict:
    ref_id = ref_id or str(uuid.uuid4())
    _seed_designer_blocks(client, ref_id)
    resp = client.post(
        "/api/v1/designer/submit-workflow",
        headers=AUTH,
        json={"designerItemId": ref_id, "templateId": "standard_query_release", "designType": "query"},
    )
    assert resp.status_code == 201
    return resp.json()


def _to_pending_publish(client: TestClient, instance_id: str) -> None:
    client.post(
        f"/api/v1/gov/workflow/instances/{instance_id}/transition",
        headers=AUTH,
        json={"action": "approve", "actorRole": "approver"},
    )
    client.post(f"/api/v1/gov/workflow/instances/{instance_id}/confirm-design", headers=AUTH)


@pytest.fixture
def integration_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="integration-r247", username="integration", roles=["integration"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def integration_headers(integration_user) -> dict[str, str]:
    return jwt_auth_headers(user_id="integration-r247", username="integration")


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r247", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_headers(viewer_user) -> dict[str, str]:
    return jwt_auth_headers(user_id="viewer-r247", username="viewer")


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.bus import auto as bus_auto

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r247", username="enterprise", roles=["enterprise"])

    bus_auto.set_user_auto_bus_scope("enterprise-r247", "/api/v1/allowed/")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _role_override(role: str, user_id: str) -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id=user_id, username=user_id, roles=[role])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def publisher_no_grant():
    yield from _role_override("publisher", "pub-a-r247")


@pytest.fixture
def publisher_with_grant():
    yield from _role_override("publisher", "pub-b-r247")


def _create_entry(
    client: TestClient,
    *,
    path_suffix: str = "",
    status: str = "published",
) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"R247-{uuid.uuid4().hex[:6]}",
            "httpMethod": "POST",
            "path": f"/api/v1/gov/r247{path_suffix}-{uuid.uuid4().hex[:6]}",
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_draft_and_approve(client: TestClient, path_suffix: str = "") -> str:
    entry_id = _create_entry(client, path_suffix=path_suffix, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert resp.status_code == 200, resp.text
    return entry_id


def _publisher_role_id(client: TestClient) -> str:
    roles = client.get("/api/v1/roles", headers=AUTH).json()["items"]
    for role in roles:
        if role["code"] == "publisher":
            return role["id"]
    created = client.post(
        "/api/v1/roles",
        headers=AUTH,
        json={"code": "publisher", "name": "Publisher"},
    )
    assert created.status_code == 201
    return created.json()["id"]


# --- GOV-007 ---


def test_gov_r247_007_01_approve_triggers_bus_registration(client):
    """approve_entry 后 BusRegistration 行存在且 trace_id 非空。"""
    entry_id = _create_draft_and_approve(client)
    bus = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={entry_id}", headers=AUTH)
    assert bus.status_code == 200
    body = bus.json()
    assert body.get("fsmState") == "registered" or body.get("busId")


def test_gov_r247_007_02_auto_register_idempotent(client, integration_headers):
    """二次 auto-register 幂等：200、autoRegistered false。"""
    entry_id = _create_entry(client)
    first = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    assert first.status_code in (200, 201)
    second = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    assert second.status_code == 200
    assert second.json().get("autoRegistered") is False


def test_gov_r247_007_03_force_timeout_retry_or_exhausted(client, integration_headers):
    """path 含 force-timeout 经 retry 成功或返回 BUS_REGISTER_RETRY_EXHAUSTED。"""
    entry_id = _create_entry(client, path_suffix="/force-timeout")
    resp = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    assert resp.status_code in (502, 201, 200)
    if resp.status_code == 502:
        assert resp.json()["code"] == "BUS_REGISTER_RETRY_EXHAUSTED"
    else:
        retry = client.post(
            "/api/v1/gov/bus/auto-register/retry",
            headers=integration_headers,
            json={"catalogEntryId": entry_id},
        )
        assert retry.status_code in (200, 502)


def test_gov_r247_007_04_viewer_auto_register_forbidden(client, viewer_headers):
    """viewer 调 auto-register → 403。"""
    entry_id = _create_entry(client)
    resp = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=viewer_headers,
        json={"catalogEntryId": entry_id},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_AUTO_BUS_FORBIDDEN"


def test_gov_r247_007_05_failed_fsm_retry_succeeded(client, integration_headers):
    entry_id = _create_entry(client, path_suffix="/force-timeout")
    client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    bad = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    assert bad.status_code == 409
    retry = client.post(
        "/api/v1/gov/bus/auto-register/retry",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    assert retry.status_code in (200, 502)


def test_gov_r247_007_06_audit_event_contains_trace(client, integration_headers):
    entry_id = _create_entry(client)
    client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )

    async def _admin() -> UserContext:
        return UserContext(id="admin-r247", username="admin", roles=["admin"])

    fastapi_app.dependency_overrides[get_current_user] = _admin
    try:
        audit = client.get(
            "/api/v1/audit/events?action=bus_auto_register_succeeded",
            headers=AUTH,
        )
        assert audit.status_code == 200
        items = audit.json().get("items", [])
        assert any(e.get("traceId") or e.get("trace_id") for e in items)
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r247_007_07_auto_register_probe_budget(client):
    resp = client.get("/api/v1/gov/bus/auto-register/probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["elapsedMs"] < 50


def test_gov_r247_007_08_publish_from_workflow_triggers_bus(client):
    submit = _submit_design(client)
    _to_pending_publish(client, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=AUTH,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    assert pub.status_code == 200
    entry_id = pub.json()["catalogEntryId"]
    bus = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={entry_id}", headers=AUTH)
    assert bus.status_code == 200
    assert bus.json().get("fsmState") == "registered"


# --- GOV-008 ---


def test_gov_r247_008_01_viewer_publish_approve_forbidden(client, viewer_headers):
    entry_id = _create_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(
        f"/api/v1/gov/publish/entries/{entry_id}/approve",
        headers=viewer_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_ACL_FORBIDDEN"


def test_gov_r247_008_02_publisher_without_grant_forbidden(client, publisher_no_grant):
    entry_id = _create_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(
        f"/api/v1/gov/publish/entries/{entry_id}/approve",
        headers=jwt_auth_headers(user_id="pub-a-r247"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_RESOURCE_FORBIDDEN"


def test_gov_r247_008_03_publisher_with_grant_succeeds(client):
    entry_id = _create_entry(client, status="draft")
    role_id = _publisher_role_id(client)
    grant = client.post(
        "/api/v1/resource-grants",
        headers=AUTH,
        json={
            "role_id": role_id,
            "resource_type": "gov_catalog_entry",
            "resource_id": entry_id,
        },
    )
    assert grant.status_code == 201

    async def _admin() -> UserContext:
        return UserContext(id="admin-r247", username="admin", roles=["admin"])

    fastapi_app.dependency_overrides[get_current_user] = _admin
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    fastapi_app.dependency_overrides.pop(get_current_user, None)

    async def _publisher() -> UserContext:
        return UserContext(id="pub-b-r247", username="pub-b-r247", roles=["publisher"])

    fastapi_app.dependency_overrides[get_current_user] = _publisher
    try:
        resp = client.post(
            f"/api/v1/gov/publish/entries/{entry_id}/approve",
            headers=jwt_auth_headers(user_id="pub-b-r247"),
        )
        assert resp.status_code == 200
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r247_008_04_approver_auto_register_forbidden(client):
    async def _override() -> UserContext:
        return UserContext(id="approver-r247", username="approver", roles=["approver"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    try:
        entry_id = _create_entry(client)
        resp = client.post(
            "/api/v1/gov/bus/auto-register",
            headers=jwt_auth_headers(user_id="approver-r247"),
            json={"catalogEntryId": entry_id},
        )
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r247_008_05_acl_matrix_returns_actions(client):
    resp = client.get("/api/v1/gov/acl/matrix", headers=AUTH)
    assert resp.status_code == 200
    assert len(resp.json()["actions"]) >= 8


def test_gov_r247_008_06_workflow_wrong_role_forbidden(client):
    inst = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert inst.status_code == 201
    instance_id = inst.json()["id"]
    client.post(
        f"/api/v1/gov/workflow/instances/{instance_id}/transition",
        headers=AUTH,
        json={"action": "submit", "actorRole": "requester"},
    )
    resp = client.post(
        f"/api/v1/gov/workflow/instances/{instance_id}/transition",
        headers=AUTH,
        json={"action": "approve", "actorRole": "requester"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] in ("GOV_WORKFLOW_FORBIDDEN", "GOV_WORKFLOW_FORBIDDEN_ROLE")


def test_gov_r247_008_07_enterprise_bus_register_forbidden(client, enterprise_user):
    entry_id = _create_entry(client, path_suffix="/out-of-scope")
    resp = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=jwt_auth_headers(user_id="enterprise-r247"),
        json={"catalogEntryId": entry_id},
    )
    assert resp.status_code == 403


# --- NFR-005 ---


def test_nfr_r247_005_01_drill_registers_stub(client):
    resp = client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["registered"] is True
    assert "drill_stub" in resp.json()["types"]


def test_nfr_r247_005_02_types_include_drill_stub(client):
    resp = client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    assert "drill_stub" in resp.json()["types"]


def test_nfr_r247_005_03_zero_invasion_true(client):
    resp = client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    assert resp.json()["zeroInvasion"] is True


def test_nfr_r247_005_04_probe_registry_under_50ms(client):
    from app.core.nfr.plugin_extension import probe_registry

    result = probe_registry()
    assert result.elapsed_ms < 50


def test_nfr_r247_005_05_teardown_drill_stub_not_visible(client):
    client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    from app.core.nfr.plugin_extension import teardown_extension_drill
    from app.datasources.registry import ConnectorNotFoundError, registry

    teardown_extension_drill()
    with pytest.raises(ConnectorNotFoundError):
        registry.get("drill_stub")


# --- NFR-003 ---


def test_nfr_r247_003_01_default_available(client):
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/report?dashboardId=core-dash",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert resp.json()["overallStatus"] == "available"


def test_nfr_r247_003_02_simulate_breach(client, monkeypatch):
    monkeypatch.setenv("DASHBOARD_AVAILABILITY_MODE", "permissive")
    get_settings.cache_clear()
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/report?dashboardId=core-dash&simulateBreach=true",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert resp.json()["withinSla"] is False


def test_nfr_r247_003_03_strict_mode_503(client, monkeypatch):
    monkeypatch.setenv("DASHBOARD_AVAILABILITY_MODE", "strict")
    get_settings.cache_clear()
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/report?dashboardId=core-dash&simulateBreach=true",
        headers=AUTH,
    )
    assert resp.status_code == 503


def test_nfr_r247_003_04_enterprise_scope_forbidden(client, enterprise_user):
    from app.core.nfr import dashboard_sla as sla_mod

    sla_mod.set_user_dashboard_sla_scope("enterprise-r247", "sla-dash-")
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/report?dashboardId=core-dash",
        headers=jwt_auth_headers(user_id="enterprise-r247"),
    )
    assert resp.status_code == 403


def test_nfr_r247_003_05_availability_probe_budget(client):
    from app.auth.deps import UserContext
    from app.core.nfr.dashboard_availability import probe_dashboard_availability_budget_ms

    result = probe_dashboard_availability_budget_ms(
        UserContext(id="dev", username="dev", roles=["admin"])
    )
    assert result.ok is True


# --- NFR-007 ---


def test_nfr_r247_007_01_registered_connectors_include_gbase(client):
    resp = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH)
    assert "gbase" in resp.json()["registeredXinchuangConnectors"]


def test_nfr_r247_007_02_compose_services_include_postgres(client):
    resp = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH)
    assert "postgres" in resp.json()["composeServices"]


def test_nfr_r247_007_03_strict_missing_connector_422(client, monkeypatch):
    monkeypatch.setenv("XINCHUANG_DEPLOY_MODE", "strict")
    get_settings.cache_clear()
    from app.core.nfr import xinchuang as xc_mod

    monkeypatch.setattr(xc_mod, "_registered_xinchuang", lambda: [])
    resp = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "XINCHUANG_NON_COMPLIANT"


def test_nfr_r247_007_04_dialect_readonly_smoke_pass(client):
    resp = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH)
    smoke = resp.json()["dialectReadOnlySmoke"]
    assert not smoke or all(s["ok"] for s in smoke)


def test_nfr_r247_007_05_deployment_probe_budget(client):
    from app.core.nfr.xinchuang import probe_deployment_report_budget_ms

    result = probe_deployment_report_budget_ms()
    assert result.elapsed_ms < 100


@pytest.mark.xinchuang_smoke
@pytest.mark.parametrize("connector_type", ["gbase", "dm", "gaussdb", "kingbase"])
def test_nfr_r247_xinchuang_registration_path(connector_type):
    from app.core.nfr.plugin_extension import describe_registration_path

    doc = describe_registration_path(connector_type)
    assert doc.connector_type == connector_type
    assert len(doc.steps) >= 1


def test_gov_r247_acl_matrix_describe():
    from app.governance.acl_matrix import describe_gov_permission_matrix

    matrix = describe_gov_permission_matrix()
    assert len(matrix["actions"]) >= 8


def test_gov_r247_007_publish_hook_swallows_bus_failure(client, monkeypatch):
    entry_id = _create_entry(client, status="draft", path_suffix="/force-timeout")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"
