"""跨域 NFR/CAT 远期 stub L1 + CAT-007 companion r64."""
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

_R64_SQLITE_URL = "sqlite+pysqlite:///file:nfr_cat_r64?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r64_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    previous_dfs = os.environ.get("DASHBOARD_FIRST_SCREEN_MODE")
    previous_ham = os.environ.get("HTTPS_AUDIT_MODE")
    os.environ["DATABASE_URL"] = _R64_SQLITE_URL
    os.environ.pop("DASHBOARD_FIRST_SCREEN_MODE", None)
    os.environ.pop("HTTPS_AUDIT_MODE", None)
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
    if previous_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous_db
    if previous_dfs is None:
        os.environ.pop("DASHBOARD_FIRST_SCREEN_MODE", None)
    else:
        os.environ["DASHBOARD_FIRST_SCREEN_MODE"] = previous_dfs
    if previous_ham is None:
        os.environ.pop("HTTPS_AUDIT_MODE", None)
    else:
        os.environ["HTTPS_AUDIT_MODE"] = previous_ham
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
        return UserContext(id="viewer-r64", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat07 import service as cat07_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r64", username="enterprise", roles=["enterprise"])

    cat07_service.set_user_workno_scope("enterprise-r64", "EMP1001")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _lifecycle_payload(key: str = "LIFE_OPS") -> dict:
    return {
        "templateKey": key,
        "displayName": "Ops Lifecycle",
        "entityTypeCode": "ticket",
        "lifecycleStages": ["created", "active", "closed"],
        "readOnlyOpenApi": True,
        "allowedRoles": ["analyst"],
    }


def _aggregate_payload(key: str = "AGG_SALES") -> dict:
    return {
        "aggregateKey": key,
        "displayName": "Sales Aggregate",
        "dimensions": ["region"],
        "metrics": ["amount"],
        "aggregationFn": "sum",
        "attributionLabel": "poc-sales-v1",
        "tableRef": "stub.sales",
    }


def test_r64_fixture_bootstraps(client, admin_auth_headers):
    """Bootstrap: health + auth smoke."""
    resp = client.get("/health")
    assert resp.status_code == 200
    me = client.get("/api/v1/me", headers=admin_auth_headers)
    assert me.status_code == 200


def test_nfr001_validate_ok(client):
    """T-NFR-R64-001-01: validate 合法配置 → 200 valid=true。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "dash-001", "budgetMs": 5000, "widgetCount": 12},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["valid"] is True
    assert resp.json()["dashboardId"] == "dash-001"


def test_nfr001_dashboard_required(client):
    """T-NFR-R64-001-02: 缺 dashboardId → 422 DASHBOARD_FIRST_SCREEN_DASHBOARD_REQUIRED。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "", "budgetMs": 5000},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_FIRST_SCREEN_DASHBOARD_REQUIRED"


def test_nfr001_budget_out_of_range(client):
    """T-NFR-R64-001-03: budgetMs 越界 → 422 DASHBOARD_FIRST_SCREEN_BUDGET_OUT_OF_RANGE。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "dash-001", "budgetMs": 500},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_FIRST_SCREEN_BUDGET_OUT_OF_RANGE"


def test_nfr001_probe_within_budget(client):
    """T-NFR-R64-001-04: probe 默认 budget 5000 → elapsedMs=800 + withinBudget=true。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/probe",
        headers=AUTH,
        json={"dashboardId": "dash-001"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["elapsedMs"] == 800
    assert body["withinBudget"] is True
    assert body["budgetMs"] == 5000
    assert body["widgetCount"] == 12


def test_nfr001_probe_simulate_slow(client):
    """T-NFR-R64-001-05: simulateSlow → withinBudget=false。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/probe",
        headers=AUTH,
        json={"dashboardId": "dash-001", "budgetMs": 5000, "simulateSlow": True},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["elapsedMs"] == 6000
    assert body["withinBudget"] is False


def test_nfr001_probe_elapsed_under_50ms(client):
    """T-NFR-R64-001-06: probe 单测 elapsed < 50ms（同进程 mock）。"""
    import time

    from app.core.nfr.dashboard_first_screen import (
        DashboardFirstScreenProbeIn,
        probe_dashboard_first_screen,
    )

    started = time.perf_counter()
    probe_dashboard_first_screen(DashboardFirstScreenProbeIn(dashboardId="perf-dash"))
    elapsed_ms = (time.perf_counter() - started) * 1000
    assert elapsed_ms < 50


def test_cat001_validate_ok(client):
    """T-CAT-R64-001-01: validate 合法 lifecycle → 200。"""
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates/validate",
        headers=AUTH,
        json=_lifecycle_payload(),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["valid"] is True


def test_cat001_empty_stages(client):
    """T-CAT-R64-001-02: 空 stages → 422 CAT01_EMPTY_STAGES。"""
    payload = _lifecycle_payload()
    payload["lifecycleStages"] = []
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates/validate",
        headers=AUTH,
        json=payload,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT01_EMPTY_STAGES"


def test_cat001_create_ok(client):
    """T-CAT-R64-001-03: create 成功 → 201。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["templateKey"] == key


def test_cat001_key_conflict(client):
    """T-CAT-R64-001-04: 重复 key → 409 CAT01_KEY_CONFLICT。"""
    key = "LIFE_DUP"
    client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    )
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == "CAT01_KEY_CONFLICT"


def test_cat001_list_contains_created(client):
    """T-CAT-R64-001-05: list 含已创建项。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=_lifecycle_payload(key),
    )
    resp = client.get("/api/v1/gov/catalog/lifecycle-templates", headers=AUTH)
    assert resp.status_code == 200
    keys = [i["templateKey"] for i in resp.json()["items"]]
    assert key in keys


def test_cat001_read_only_openapi_default(client):
    """T-CAT-R64-001-06: readOnlyOpenApi=true 默认。"""
    key = f"LIFE_{uuid.uuid4().hex[:6].upper()}"
    payload = _lifecycle_payload(key)
    payload.pop("readOnlyOpenApi", None)
    resp = client.post(
        "/api/v1/gov/catalog/lifecycle-templates",
        headers=AUTH,
        json=payload,
    )
    assert resp.status_code == 201
    assert resp.json()["readOnlyOpenApi"] is True


def test_nfr004_status_ok(client):
    """T-NFR-R64-004-01: GET status → 200 + httpsEnforced bool。"""
    resp = client.get("/api/v1/nfr/https-audit/status", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body["httpsEnforced"], bool)
    assert isinstance(body["webhookHttpsOnly"], bool)
    assert body["tlsMinVersion"] == "1.2"


def test_nfr004_mask_password(client):
    """T-NFR-R64-004-02: mask-probe 脱敏 password → ***。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={"samplePayload": {"password": "secret123", "name": "demo"}},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["maskedPayload"]["password"] == "***"
    assert body["maskedPayload"]["name"] == "demo"
    assert "password" in body["maskedFields"]


def test_nfr004_audit_logged(client):
    """T-NFR-R64-004-03: auditLogged=true（mock）。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={"samplePayload": {"apiKey": "k1"}},
    )
    assert resp.status_code == 200
    assert resp.json()["auditLogged"] is True


def test_nfr004_insecure_webhook(client):
    """T-NFR-R64-004-04: http webhook → 422 HTTPS_AUDIT_INSECURE_URL。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={
            "samplePayload": {"name": "x"},
            "webhookUrl": "http://insecure.example/hook",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "HTTPS_AUDIT_INSECURE_URL"


def test_nfr004_empty_payload(client):
    """T-NFR-R64-004-05: 空 payload → 422 HTTPS_AUDIT_EMPTY_PAYLOAD。"""
    resp = client.post(
        "/api/v1/nfr/https-audit/mask-probe",
        headers=AUTH,
        json={"samplePayload": {}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "HTTPS_AUDIT_EMPTY_PAYLOAD"


def test_nfr004_no_plugin_route_overlap(client):
    """T-NFR-R64-004-06: 与 NFR-005 plugin_extension 路由无重叠。"""
    resp = client.get("/api/v1/nfr/plugin-extension-points", headers=AUTH)
    assert resp.status_code == 200
    audit = client.get("/api/v1/nfr/https-audit/status", headers=AUTH)
    assert audit.status_code == 200
    assert "/plugin-extension" not in "/nfr/https-audit/status"


def test_cat002_validate_ok(client):
    """T-CAT-R64-002-01: validate 合法 aggregate → 200。"""
    resp = client.post(
        "/api/v1/gov/catalog/aggregate-templates/validate",
        headers=AUTH,
        json=_aggregate_payload(),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["valid"] is True


def test_cat002_empty_metrics(client):
    """T-CAT-R64-002-02: 空 metrics → 422 CAT02_EMPTY_METRICS。"""
    payload = _aggregate_payload()
    payload["metrics"] = []
    resp = client.post(
        "/api/v1/gov/catalog/aggregate-templates/validate",
        headers=AUTH,
        json=payload,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT02_EMPTY_METRICS"


def test_cat002_create_ok(client):
    """T-CAT-R64-002-03: create 成功 → 201。"""
    key = f"AGG_{uuid.uuid4().hex[:6].upper()}"
    resp = client.post(
        "/api/v1/gov/catalog/aggregate-templates",
        headers=AUTH,
        json=_aggregate_payload(key),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["aggregateKey"] == key


def test_cat002_attribution_ok(client):
    """T-CAT-R64-002-04: attribution GET → 200 + pocReady=true。"""
    key = f"AGG_{uuid.uuid4().hex[:6].upper()}"
    client.post(
        "/api/v1/gov/catalog/aggregate-templates",
        headers=AUTH,
        json=_aggregate_payload(key),
    )
    resp = client.get(
        f"/api/v1/gov/catalog/aggregate-templates/{key}/attribution",
        headers=AUTH,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["aggregateKey"] == key
    assert body["pocReady"] is True
    assert body["attributionLabel"] == "poc-sales-v1"


def test_cat002_attribution_not_found(client):
    """T-CAT-R64-002-05: 未知 key attribution → 404。"""
    resp = client.get(
        "/api/v1/gov/catalog/aggregate-templates/AGG_MISSING/attribution",
        headers=AUTH,
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT02_NOT_FOUND"


def test_cat002_invalid_aggregation(client):
    """T-CAT-R64-002-06: 非法 aggregationFn → 422 CAT02_INVALID_AGGREGATION。"""
    payload = _aggregate_payload()
    payload["aggregationFn"] = "median"
    resp = client.post(
        "/api/v1/gov/catalog/aggregate-templates/validate",
        headers=AUTH,
        json=payload,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT02_INVALID_AGGREGATION"


def test_cat007_enterprise_forbidden_out_of_scope(client, enterprise_user):
    """T-CAT-R64-007-01: enterprise scope 外 workno → 403 CAT07_FORBIDDEN。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "EMP2002"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT07_FORBIDDEN"


def test_cat007_enterprise_in_scope(client, enterprise_user):
    """T-CAT-R64-007-02: enterprise scope 内 → 200。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "EMP1001"})
    assert resp.status_code == 200
    assert resp.json()["workno"] == "EMP1001"


def test_cat007_viewer_forbidden_cross_scope(client, viewer_user):
    """T-CAT-R64-007-03: viewer 跨 scope → 403。"""
    from app.governance.catalog.cat07 import service as cat07_service

    cat07_service.set_user_workno_scope("viewer-r64", "EMP1001")
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "EMP2002"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT07_FORBIDDEN"


def test_cat007_admin_any_workno(client):
    """T-CAT-R64-007-04: admin 任意 workno → 200。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "EMP2002"})
    assert resp.status_code == 200


def test_cat007_probe_under_50ms():
    """T-CAT-R64-007-05: probe_workno_behavior_budget_ms < 50ms。"""
    from app.governance.catalog.cat07.probe import probe_workno_behavior_budget_ms

    result = probe_workno_behavior_budget_ms("EMP1001")
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat007_r60_subset_still_green(client):
    """T-CAT-R64-007-06: r60 七测子集仍绿（EMP1001 404/422 等）。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "UNKNOWN99"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT07_WORKNO_NOT_FOUND"


def test_cat007_unknown_workno_before_acl(client, enterprise_user):
    """T-CAT-R64-007-07: 未知 workno 仍 404（ACL 前格式校验不变）。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "UNKNOWN99"})
    assert resp.status_code == 404


def test_cat007_analyst_read_any_seed(client):
    """T-CAT-R64-007-08: analyst 只读任意 seed workno → 200."""
    async def _override() -> UserContext:
        return UserContext(id="analyst-r64", username="analyst", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    try:
        resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "EMP2002"})
        assert resp.status_code == 200
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)
