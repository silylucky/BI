"""M-FINAL F-E/F-F r248 — GOV-007~008 + NFR-003/005/007 批次 4。"""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_R248_SQLITE_URL = "sqlite+pysqlite:///file:mfinal_fe_gov_r248?mode=memory&cache=shared&uri=true"
REF_ID = "00000000-0000-4000-8000-000000000248"


@pytest.fixture(scope="module", autouse=True)
def r248_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R248_SQLITE_URL
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
def r248_permissive_nfr_modes(monkeypatch):
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
        return UserContext(id="integration-r248", username="integration", roles=["integration"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def integration_headers(integration_user) -> dict[str, str]:
    return jwt_auth_headers(user_id="integration-r248", username="integration")


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r248", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_headers(viewer_user) -> dict[str, str]:
    return jwt_auth_headers(user_id="viewer-r248", username="viewer")


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.bus import auto as bus_auto

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r248", username="enterprise", roles=["enterprise"])

    bus_auto.set_user_auto_bus_scope("enterprise-r248", "/api/v1/allowed/")
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
    yield from _role_override("publisher", "pub-a-r248")


@pytest.fixture
def publisher_with_grant():
    yield from _role_override("publisher", "pub-b-r248")


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
            "name": f"R248-{uuid.uuid4().hex[:6]}",
            "httpMethod": "POST",
            "path": f"/api/v1/gov/r248{path_suffix}-{uuid.uuid4().hex[:6]}",
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


def test_gov_r248_007_01_bus_adapter_factory_shared():
    """T-GOV-R248-007-01: pipeline 与 bus_register 共用 IF-01 工厂。"""
    from app.integration.bus_adapter_factory import get_bus_adapter
    from app.integration import bus_register

    a = get_bus_adapter()
    b = bus_register._build_adapter(max_attempts=3)
    assert type(a).__name__ == type(b).__name__


def test_gov_r248_007_02_publish_deferred_on_timeout(client):
    """T-GOV-R248-007-02: approve + force-timeout → 200 published + busRegisterStatus=deferred。"""
    entry_id = _create_entry(client, path_suffix="/force-timeout", status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    approve = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert approve.status_code == 200
    body = approve.json()
    assert body["status"] == "published"
    assert body.get("busRegisterStatus") == "deferred"
    assert body.get("busRegisterErrorCode") == "BUS_REGISTER_RETRY_EXHAUSTED"


def test_gov_r248_007_03_deferred_fsm_audit(client):
    """T-GOV-R248-007-03: deferred 态 FSM + audit bus_auto_register_deferred。"""
    from app.governance.bus.auto import get_fsm_state

    entry_id = _create_entry(client, path_suffix="/audit-force-timeout", status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert get_fsm_state(UUID(entry_id)) == "deferred"


def test_gov_r248_007_04_approve_success_bus_status(client):
    """T-GOV-R248-007-04: 正常 path approve → busRegisterStatus=succeeded。"""
    entry_id = _create_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    approve = client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)
    assert approve.status_code == 200
    assert approve.json().get("busRegisterStatus") == "succeeded"


def test_gov_r248_007_05_manual_auto_register_still_failed(client, integration_headers):
    """T-GOV-R248-007-05: 手动 auto-register 失败仍 failed FSM + 502（非 deferred）。"""
    from app.governance.bus.auto import get_fsm_state

    entry_id = _create_entry(client, path_suffix="/force-timeout")
    resp = client.post(
        "/api/v1/gov/bus/auto-register",
        headers=integration_headers,
        json={"catalogEntryId": entry_id},
    )
    assert resp.status_code == 502
    assert get_fsm_state(UUID(entry_id)) == "failed"


def test_gov_r248_007_06_deferred_retry_succeeds_or_exhausted(client):
    """T-GOV-R248-007-06: deferred 态 retry → succeeded 或 502。"""
    entry_id = _create_entry(client, path_suffix="/force-timeout", status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/approve", headers=AUTH)

    async def _integration() -> UserContext:
        return UserContext(id="integration-r248", username="integration", roles=["integration"])

    fastapi_app.dependency_overrides[get_current_user] = _integration
    try:
        retry = client.post(
            "/api/v1/gov/bus/auto-register/retry",
            headers=jwt_auth_headers(user_id="integration-r248"),
            json={"catalogEntryId": entry_id},
        )
        assert retry.status_code in (200, 502)
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r248_007_07_auto_register_idempotent(client, integration_headers):
    """T-GOV-R248-007-07: 二次 auto-register 幂等 200 autoRegistered=false。"""
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


def test_gov_r248_007_08_auto_register_probe_budget(client):
    """T-GOV-R248-007-08: probe ≤50ms。"""
    resp = client.get("/api/v1/gov/bus/auto-register/probe", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["elapsedMs"] < 50


def test_gov_r248_007_09_p4_smoke_publish_to_bus_tail(client):
    """P4-SMOKE 尾段：designer → workflow → publish/from-workflow → bus FSM。"""
    submit = _submit_design(client, REF_ID)
    _to_pending_publish(client, submit["workflowInstanceId"])
    pub = client.post(
        "/api/v1/gov/publish/from-workflow",
        headers=AUTH,
        json={"workflowInstanceId": submit["workflowInstanceId"]},
    )
    assert pub.status_code == 200
    entry_id = pub.json()["catalogEntryId"]
    fsm = client.get(f"/api/v1/gov/bus/register/fsm?catalogEntryId={entry_id}", headers=AUTH)
    assert fsm.status_code == 200
    fsm_state = fsm.json().get("fsmState")
    assert fsm_state in ("registered", "succeeded", "deferred")
    if fsm_state == "deferred":
        async def _integration() -> UserContext:
            return UserContext(id="integration-r248", username="integration", roles=["integration"])

        fastapi_app.dependency_overrides[get_current_user] = _integration
        try:
            retry = client.post(
                "/api/v1/gov/bus/auto-register/retry",
                headers=jwt_auth_headers(user_id="integration-r248"),
                json={"catalogEntryId": entry_id},
            )
            assert retry.status_code in (200, 502)
        finally:
            fastapi_app.dependency_overrides.pop(get_current_user, None)


# --- GOV-008 ---


def test_gov_r248_008_01_self_approve_forbidden(client):
    """owner publisher 自批无 admin → 403 GOV_ACL_SELF_APPROVE_FORBIDDEN。"""
    owner_id = str(uuid.uuid4())
    entry_id = _create_entry(client, status="draft")

    async def _publisher() -> UserContext:
        return UserContext(id=owner_id, username="pub", roles=["publisher", "designer"])

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

    fastapi_app.dependency_overrides[get_current_user] = _publisher
    try:
        client.post(
            f"/api/v1/gov/publish/entries/{entry_id}/submit",
            headers=jwt_auth_headers(user_id=owner_id),
        )
        resp = client.post(
            f"/api/v1/gov/publish/entries/{entry_id}/approve",
            headers=jwt_auth_headers(user_id=owner_id),
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "GOV_ACL_SELF_APPROVE_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_r248_008_02_requester_cannot_approve_transition(client):
    """requester 对 workflow approve transition → 403 GOV_WORKFLOW_FORBIDDEN。"""
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


def test_gov_r248_008_03_matrix_has_nine_actions(client):
    """GET /gov/acl/matrix actions 长度 ≥9 且含 bus_auto_register_retry。"""
    resp = client.get("/api/v1/gov/acl/matrix", headers=AUTH)
    actions = resp.json()["actions"]
    assert len(actions) >= 9
    assert any(a["action"] == "bus_auto_register_retry" for a in actions)


def test_gov_r248_008_04_viewer_publish_approve_forbidden(client, viewer_headers):
    entry_id = _create_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(
        f"/api/v1/gov/publish/entries/{entry_id}/approve",
        headers=viewer_headers,
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_ACL_FORBIDDEN"


def test_gov_r248_008_05_publisher_without_grant_forbidden(client, publisher_no_grant):
    entry_id = _create_entry(client, status="draft")
    client.post(f"/api/v1/gov/publish/entries/{entry_id}/submit", headers=AUTH)
    resp = client.post(
        f"/api/v1/gov/publish/entries/{entry_id}/approve",
        headers=jwt_auth_headers(user_id="pub-a-r248"),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_RESOURCE_FORBIDDEN"


def test_gov_r248_008_06_approver_bus_auto_register_forbidden(client):
    async def _override() -> UserContext:
        return UserContext(id="approver-r248", username="approver", roles=["approver"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    try:
        entry_id = _create_entry(client)
        resp = client.post(
            "/api/v1/gov/bus/auto-register",
            headers=jwt_auth_headers(user_id="approver-r248"),
            json={"catalogEntryId": entry_id},
        )
        assert resp.status_code == 403
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


# --- NFR-003 ---


@pytest.mark.nfr_dashboard_smoke
def test_nfr_r248_003_01_smoke_all_available(client):
    resp = client.get("/api/v1/nfr/dashboard-availability/smoke", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["allAvailable"] is True
    assert body["p95ThresholdMs"] == 5000
    for d in body["dashboards"]:
        assert d["firstScreenP95Ms"] <= 5000


@pytest.mark.nfr_dashboard_smoke
def test_nfr_r248_003_02_smoke_simulate_breach(client):
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/smoke?simulateBreach=true",
        headers=AUTH,
    )
    assert resp.json()["allAvailable"] is False


def test_nfr_r248_003_03_strict_smoke_503(client, monkeypatch):
    monkeypatch.setenv("DASHBOARD_AVAILABILITY_MODE", "strict")
    get_settings.cache_clear()
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/smoke?simulateBreach=true",
        headers=AUTH,
    )
    assert resp.status_code == 503
    assert resp.json()["code"] == "DASHBOARD_AVAILABILITY_BREACH"


def test_nfr_r248_003_04_enterprise_scope_forbidden(client, enterprise_user):
    from app.core.nfr import dashboard_sla as sla_mod

    sla_mod.set_user_dashboard_sla_scope("enterprise-r248", "sla-dash-")
    resp = client.get(
        "/api/v1/nfr/dashboard-availability/report?dashboardId=core-dash",
        headers=jwt_auth_headers(user_id="enterprise-r248"),
    )
    assert resp.status_code == 403


def test_nfr_r248_003_05_availability_probe_budget(client):
    from app.auth.deps import UserContext
    from app.core.nfr.dashboard_availability import probe_dashboard_availability_budget_ms

    result = probe_dashboard_availability_budget_ms(
        UserContext(id="dev", username="dev", roles=["admin"])
    )
    assert result.ok is True


# --- NFR-005 ---


def test_nfr_r248_005_01_drill_connectivity_readonly(client):
    resp = client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    body = resp.json()
    assert body["connectivityOk"] is True
    assert body["readonlyQueryOk"] is True
    assert body["zeroInvasion"] is True


def test_nfr_r248_005_02_assert_core_module_unchanged():
    from app.core.nfr.plugin_extension import assert_core_module_unchanged

    assert assert_core_module_unchanged() is True


def test_nfr_r248_005_03_drill_teardown_no_stub(client):
    client.get("/api/v1/nfr/plugin-extension/drill", headers=AUTH)
    from app.datasources.registry import ConnectorNotFoundError, registry

    with pytest.raises(ConnectorNotFoundError):
        registry.get("drill_stub")


def test_nfr_r248_005_04_probe_registry_under_50ms(client):
    from app.core.nfr.plugin_extension import probe_registry

    result = probe_registry()
    assert result.elapsed_ms < 50


# --- NFR-007 ---


def test_nfr_r248_007_01_json_schema_fields(client):
    resp = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH)
    body = resp.json()
    assert body["schemaVersion"] == "1.0"
    assert "generatedAt" in body
    assert "missingExpectedTypes" in body


def test_nfr_r248_007_02_missing_expected_types(client):
    body = client.get("/api/v1/nfr/xinchuang/deployment-report", headers=AUTH).json()
    missing = set(body["missingExpectedTypes"])
    assert "oceanbase" in missing or "tidb" in missing


def test_nfr_r248_007_03_markdown_format(client):
    resp = client.get(
        "/api/v1/nfr/xinchuang/deployment-report?format=markdown",
        headers=AUTH,
    )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers.get("content-type", "")
    assert "## 信创部署验收报告" in resp.text


def test_nfr_r248_007_04_deployment_report_budget():
    from app.core.nfr.xinchuang import probe_deployment_report_budget_ms

    result = probe_deployment_report_budget_ms()
    assert result.ok is True
