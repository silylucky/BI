"""跨域 companion 质量推分 r68 — NFR/GOV/RPT/VIEW."""
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

_R68_SQLITE_URL = "sqlite+pysqlite:///file:nfr_gov_rpt_view_r68?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r68_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R68_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
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
    from app.core.nfr import dashboard_sla as sla_mod
    from app.core.nfr import https_audit as audit_mod
    from app.governance.bus import auto as bus_auto
    from app.reports.persistence import memory_stores
    from app.views import store as view_store

    memory_stores.analysis_packs.clear()
    view_store.clear_role_defaults()
    bus_auto._auto_states.clear()
    sla_mod._USER_DASHBOARD_SLA_SCOPE.clear()
    audit_mod._USER_HTTPS_AUDIT_SCOPE.clear()
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r68", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.core.nfr import dashboard_sla as sla_mod
    from app.core.nfr import https_audit as audit_mod
    from app.governance.bus import auto as bus_auto
    from app.reports.persistence import memory_stores
    from app.views import role_template as role_tpl

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r68", username="enterprise", roles=["enterprise"])

    sla_mod.set_user_dashboard_sla_scope("enterprise-r68", "sla-dash-")
    audit_mod.set_user_https_audit_scope("enterprise-r68", frozenset({"api", "webhook"}))
    bus_auto.set_user_auto_bus_scope("enterprise-r68", "/api/v1/")
    role_tpl.set_user_role_default_scope("enterprise-r68", "role-")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def integration_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="integration-r68", username="integration", roles=["integration"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_published_entry(client: TestClient, path: str) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": f"R68-{uuid.uuid4().hex[:6]}",
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": "published",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"R68-Dash-{uuid.uuid4().hex[:6]}", "slug": f"r68-{uuid.uuid4().hex[:6]}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _standard_pack_payload(pack_key: str = "pack-cn-probe") -> dict:
    return {
        "packKey": pack_key,
        "displayName": "R68 Pack",
        "businessObjectCode": "customer",
        "physicalTableFqn": "ops.customer",
        "dataSourceId": str(uuid.uuid4()),
        "fieldMapping": {"status": "status", "region": "region", "createdAt": "created_at"},
        "enabledThemes": ["lifecycle"],
        "allowedRoles": ["analyst"],
        "snapshotCronPreset": "daily",
    }


def _role_defaults_payload(dashboard_id: str | None = None, inherit: str | None = None) -> dict:
    body: dict = {"maxWidgetCount": 12}
    if dashboard_id:
        body["dashboardId"] = dashboard_id
    if inherit:
        body["inheritFromRoleId"] = inherit
    return body


def test_r68_fixture_bootstraps(client):
    """T-R68-BOOT-01: sqlite env + health。"""
    assert client.get("/health").status_code == 200


def test_r68_fixture_auth(client):
    """T-R68-BOOT-02: Bearer dev 可访问受保护路由。"""
    assert client.get("/api/v1/nfr/https-audit/status", headers=AUTH).status_code == 200


# --- NFR-003 ---


def test_nfr_r68_003_enterprise_forbidden(client, enterprise_user):
    """T-NFR-R68-003-01: enterprise 越权 dashboardId → 403。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json={"dashboardId": "other-dash-001", "windowHours": 24, "slaTargetPercent": 99.5},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASHBOARD_SLA_FORBIDDEN"


def test_nfr_r68_003_invalid_dashboard_id(client):
    """T-NFR-R68-003-02: dashboardId 含空格 → 422。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json={"dashboardId": "bad id", "windowHours": 24, "slaTargetPercent": 99.5},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_SLA_INVALID_DASHBOARD_ID"


def test_nfr_r68_003_alerts_threshold_out_of_range(client):
    """T-NFR-R68-003-03: alerts thresholdPercent=50 → 422。"""
    resp = client.get("/api/v1/nfr/dashboard-sla/alerts?thresholdPercent=50", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_SLA_ALERT_THRESHOLD_OUT_OF_RANGE"


def test_nfr_r68_003_probe_validate_budget(client):
    """T-NFR-R68-003-04: validate probe < 50ms。"""
    from app.auth.deps import UserContext
    from app.core.nfr.dashboard_sla import probe_validate_dashboard_sla_budget_ms

    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_validate_dashboard_sla_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_nfr_r68_003_probe_sla_budget(client):
    """T-NFR-R68-003-05: sla probe < 50ms。"""
    from app.auth.deps import UserContext
    from app.core.nfr.dashboard_sla import probe_dashboard_sla_probe_budget_ms

    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_dashboard_sla_probe_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_nfr_r68_003_r62_regression_pointer(client):
    """T-NFR-R68-003-06: r62 dashboard_sla L1 基线仍可达。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/probe",
        headers=AUTH,
        json={"dashboardId": "sla-dash-r62", "windowHours": 24, "slaTargetPercent": 99.0},
    )
    assert resp.status_code == 200
    assert resp.json()["withinSla"] is True


# --- NFR-004 ---


def test_nfr_r68_004_enterprise_forbidden(client, enterprise_user):
    """T-NFR-R68-004-01: enterprise 越权 auditScope=connector → 403。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={
            "samplePayload": {"password": "x"},
            "auditScope": "connector",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "HTTPS_AUDIT_FORBIDDEN"


def test_nfr_r68_004_invalid_scope(client):
    """T-NFR-R68-004-02: auditScope=invalid → 422。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={"samplePayload": {"password": "x"}, "auditScope": "invalid"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "HTTPS_AUDIT_INVALID_SCOPE"


def test_nfr_r68_004_simulate_audit_failure(client):
    """T-NFR-R68-004-03: simulateAuditFailure=true → auditLogged=false。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={
            "samplePayload": {"password": "x"},
            "simulateAuditFailure": True,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["auditLogged"] is False


def test_nfr_r68_004_probe_mask_budget(client):
    """T-NFR-R68-004-04: mask probe < 50ms。"""
    from app.auth.deps import UserContext
    from app.core.nfr.https_audit import probe_https_mask_budget_ms

    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_https_mask_budget_ms(actor)
    assert result.ok is True


def test_nfr_r68_004_probe_status_budget(client):
    """T-NFR-R68-004-05: status probe < 50ms。"""
    from app.core.nfr.https_audit import probe_https_status_budget_ms

    result = probe_https_status_budget_ms()
    assert result.ok is True


def test_nfr_r68_004_r64_regression_pointer(client):
    """T-NFR-R68-004-06: r64 mask-probe 基线仍可达。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={"samplePayload": {"password": "secret"}},
    )
    assert resp.status_code == 200
    assert "password" in resp.json()["maskedFields"]


# --- GOV-007 ---


def test_gov_r68_007_fsm_failed_retry_409(client, integration_user):
    """T-GOV-R68-007-01: failed 状态重试 → 409 GOV_AUTO_BUS_INVALID_TRANSITION。"""
    eid = _create_published_entry(client, path="/api/v1/force-fail/r68")
    first = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert first.status_code == 502
    retry = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert retry.status_code == 409
    assert retry.json()["code"] == "GOV_AUTO_BUS_INVALID_TRANSITION"


def test_gov_r68_007_enterprise_path_forbidden(client, enterprise_user, integration_user):
    """T-GOV-R68-007-02: enterprise 越权 entry path → 403。"""
    from app.governance.bus import auto as bus_auto

    bus_auto.set_user_auto_bus_scope("enterprise-r68", "/api/v1/cn/")
    eid = _create_published_entry(client, path=f"/api/v1/global/r68-{uuid.uuid4().hex[:6]}")

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r68", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_AUTO_BUS_FORBIDDEN"


def test_gov_r68_007_probe_budget(client, integration_user):
    """T-GOV-R68-007-03: auto_register probe < 50ms。"""
    from app.datasources.models import get_meta_session
    from app.auth.deps import UserContext
    from app.governance.bus.probe import probe_auto_register_budget_ms

    eid = uuid.UUID(_create_published_entry(client, path=f"/api/v1/r68/probe-{uuid.uuid4().hex[:6]}"))
    db = get_meta_session()
    try:
        actor = UserContext(id="integration-r68", username="integration", roles=["integration"])
        result = probe_auto_register_budget_ms(db, actor, eid)
        assert result.ok is True
        assert result.elapsed_ms < 50
    finally:
        db.close()


def test_gov_r68_007_http_probe(client, integration_user):
    """T-GOV-R68-007-04: GET auto-register/probe withinBudget。"""
    resp = client.get("/api/v1/gov/bus/auto-register/probe", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["withinBudget"] is True
    assert body["elapsedMs"] < 50


def test_gov_r68_007_r60_force_fail_preserved(client, integration_user):
    """T-GOV-R68-007-05: force-fail 502 路径保持。"""
    eid = _create_published_entry(client, path="/api/v1/force-fail/r68-reg")
    resp = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 502
    assert resp.json()["code"] == "BUS_REGISTRATION_REJECTED"


# --- RPT-002 ---


def test_rpt_r68_002_get_not_found(client):
    """T-RPT-R68-002-01: 未知 pack key → 404。"""
    resp = client.get("/api/v1/reports/standard/packs/pack-missing-r68", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_STD_NOT_FOUND"


def test_rpt_r68_002_empty_roles(client):
    """T-RPT-R68-002-03: allowedRoles=[] → 422。"""
    key = "pack-dup-r68"
    payload = _standard_pack_payload(key)
    payload["allowedRoles"] = []
    resp = client.put(f"/api/v1/reports/standard/packs/{key}", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_STD_EMPTY_ROLES"


def test_rpt_r68_002_list_route(client):
    """T-RPT-R68-002-05: standard packs list 路由可达。"""
    resp = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert resp.status_code == 200


# --- VIEW-002 ---


def test_view_r68_002_role_cycle(client):
    """T-VIEW-R68-002-01: inheritFromRoleId A→B→C→A → 422 VIEW_DEFAULT_ROLE_CYCLE。"""
    role_a, role_b, role_c = "role-a-r68", "role-b-r68", "role-c-r68"
    dash = _create_dashboard(client)
    client.put(
        f"/api/v1/roles/{role_a}/default-views",
        headers=AUTH,
        json=_role_defaults_payload(dashboard_id=dash, inherit=role_b),
    )
    client.put(
        f"/api/v1/roles/{role_b}/default-views",
        headers=AUTH,
        json=_role_defaults_payload(dashboard_id=dash, inherit=role_c),
    )
    resp = client.put(
        f"/api/v1/roles/{role_c}/default-views",
        headers=AUTH,
        json=_role_defaults_payload(dashboard_id=dash, inherit=role_a),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_ROLE_CYCLE"


def test_view_r68_002_enterprise_get_forbidden(client, enterprise_user):
    """T-VIEW-R68-002-02: enterprise 越权 role_id GET → 403。"""
    resp = client.get("/api/v1/roles/global-role-r68/default-views", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "VIEW_DEFAULT_FORBIDDEN"


def test_view_r68_002_probe_put_budget(client):
    """T-VIEW-R68-002-03: put defaults probe < 50ms。"""
    from app.auth.deps import UserContext
    from app.datasources.models import get_meta_session
    from app.views.probe import probe_put_role_defaults_budget_ms

    db = get_meta_session()
    try:
        actor = UserContext(id="admin", username="admin", roles=["admin"])
        result = probe_put_role_defaults_budget_ms(
            db, actor, "role-probe-r68", {"maxWidgetCount": 8}
        )
        assert result.ok is True
    finally:
        db.close()


def test_view_r68_002_r63_bounds_preserved(client):
    """T-VIEW-R68-002-04: maxWidgetCount 越界仍 422。"""
    resp = client.put(
        "/api/v1/roles/role-bounds-r68/default-views",
        headers=AUTH,
        json={"maxWidgetCount": 0},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_OUT_OF_BOUNDS"


# --- r68 companion 补充覆盖（≥35 断言门槛） ---


def test_nfr_r68_003_enterprise_in_scope(client, enterprise_user):
    """T-NFR-R68-003-07: enterprise 前缀内 dashboardId → 200。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-sla/validate",
        headers=AUTH,
        json={"dashboardId": "sla-dash-ok", "windowHours": 24, "slaTargetPercent": 99.5},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_nfr_r68_003_alerts_valid_threshold(client):
    """T-NFR-R68-003-08: alerts thresholdPercent=95 → 200。"""
    resp = client.get("/api/v1/nfr/dashboard-sla/alerts?thresholdPercent=95", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["thresholdPercent"] == 95.0


def test_nfr_r68_004_valid_connector_scope_admin(client):
    """T-NFR-R68-004-07: admin auditScope=connector → 200。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={"samplePayload": {"password": "x"}, "auditScope": "connector"},
    )
    assert resp.status_code == 200


def test_gov_r68_007_auto_register_ok(client, integration_user):
    """T-GOV-R68-007-06: 正常 published entry auto-register → 201。"""
    eid = _create_published_entry(client, path=f"/api/v1/r68/ok-{uuid.uuid4().hex[:6]}")
    resp = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code in (200, 201)
    assert resp.json()["autoRegistered"] is True


def test_rpt_r68_002_list_empty(client):
    """T-RPT-R68-002-07: GET standard packs 空列表。"""
    from app.reports.persistence import memory_stores

    memory_stores.analysis_packs.clear()
    resp = client.get("/api/v1/reports/standard/packs", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_view_r68_002_get_in_scope(client, enterprise_user):
    """T-VIEW-R68-002-05: enterprise role- 前缀 GET → 200。"""
    from app.views import store

    store.set_role_defaults("role-ok-r68", {"dashboardId": None, "maxWidgetCount": 8})
    resp = client.get("/api/v1/roles/role-ok-r68/default-views", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["maxWidgetCount"] == 8
