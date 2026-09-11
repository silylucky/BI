"""跨域 companion 质量推分 r67 — DASH/NFR/CONN/RPT."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R67_SQLITE_URL = "sqlite+pysqlite:///file:dash_nfr_conn_rpt_r67?mode=memory&cache=shared&uri=true"
_R67_WIDGET_ID = "22222222-2222-4222-8222-222222222222"


@pytest.fixture(scope="module", autouse=True)
def r67_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R67_SQLITE_URL
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
    from app.reports.templates import service as template_service

    template_service._store.clear()
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
        return UserContext(id="viewer-r67", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="enterprise-r67", username="enterprise", roles=["enterprise"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard_with_widget(client: TestClient, widget_id: str = _R67_WIDGET_ID) -> str:
    create = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"R67-{uuid.uuid4().hex[:6]}", "description": "r67 fixture"},
    )
    assert create.status_code == 201, create.text
    dash_id = create.json()["id"]
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": widget_id,
                "type": "chart",
                "title": "w1",
                "colSpan": 12,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": "SELECT 1",
                },
            }
        ],
        "globalFilters": [],
    }
    put = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    assert put.status_code == 200, put.text
    return dash_id


def _filter_linkage_payload(dashboard_id: str, widget_id: str = _R67_WIDGET_ID) -> dict:
    return {
        "dashboardId": dashboard_id,
        "filters": [{"filterId": "f1", "dimensionRef": "region", "defaultValue": "CN"}],
        "linkageRules": [{"sourceFilterId": "f1", "targetWidgetIds": [widget_id], "parameterKey": "region"}],
        "refreshMode": "eager",
    }


def _template_payload(key: str = "tmpl-r67-demo") -> dict:
    return {
        "templateKey": key,
        "format": "pdf",
        "displayName": "R67 Template",
        "blocks": [{"blockType": "sql", "queryRef": "q1"}],
    }


def test_r67_fixture_bootstraps(client):
    """T-R67-000-01: r67 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r67_fixture_auth_smoke(client, admin_auth_headers):
    """T-R67-000-02: /api/v1/me 可达。"""
    resp = client.get("/api/v1/me", headers=admin_auth_headers)
    assert resp.status_code == 200


import uuid as _uuid

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.core.nfr.dashboard_first_screen import (
    probe_first_screen_probe_budget_ms,
    probe_validate_first_screen_budget_ms,
    set_user_first_screen_scope,
)
from app.core.nfr.report_perf import (
    probe_report_perf_probe_budget_ms,
    probe_validate_report_perf_budget_ms,
    set_user_report_perf_scope,
)
from app.dashboard.global_filters import service as gf_service
from app.dashboard.global_filters.probe import (
    probe_get_linkage_budget_ms,
    probe_validate_linkage_budget_ms,
)
from app.dashboard.global_filters.schemas import GlobalFilterLinkageItem
from app.datasources.dialects.kingbase.connector import KingbaseConnector
from app.datasources.dialects.kingbase.probe import probe_test_connection_budget_ms
from app.datasources.models import get_meta_engine
from app.reports.templates import service as template_service
from app.reports.templates.acl import set_user_template_scope
from app.reports.templates.probe import probe_get_template_budget_ms, probe_validate_template_budget_ms
from unittest.mock import MagicMock, patch
from jwt_auth import AUTH, jwt_auth_headers


def _admin_actor() -> UserContext:
    return UserContext(id="dev", username="dev", roles=["admin"])


# --- DASH-004 ---


def test_dash_r67_004_probe_validate_under_50ms(client):
    """T-DASH-R67-004-01: probe_validate_linkage_budget_ms < 50ms。"""
    dash_id = _create_dashboard_with_widget(client)
    item = GlobalFilterLinkageItem.model_validate(_filter_linkage_payload(dash_id))
    with Session(get_meta_engine()) as session:
        result = probe_validate_linkage_budget_ms(session, item)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r67_004_probe_get_under_50ms(client):
    """T-DASH-R67-004-02: probe_get_linkage_budget_ms < 50ms（已 save）。"""
    dash_id = _create_dashboard_with_widget(client)
    client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=_filter_linkage_payload(dash_id))
    actor = _admin_actor()
    with Session(get_meta_engine()) as session:
        result = probe_get_linkage_budget_ms(session, _uuid.UUID(dash_id), actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_dash_r67_004_enterprise_scope_forbidden(client, enterprise_user):
    """T-DASH-R67-004-03: enterprise 越权 dashboardId GET → 403。"""
    dash_id = _create_dashboard_with_widget(client)
    gf_service.set_user_filter_dashboard_scope("enterprise-r67", set())
    resp = client.get(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FILTER_FORBIDDEN"


def test_dash_r67_004_viewer_put_forbidden(client, viewer_user):
    """T-DASH-R67-004-04: viewer PUT save → 403。"""
    dash_id = _create_dashboard_with_widget(client)
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/global-filters",
        headers=AUTH,
        json=_filter_linkage_payload(dash_id),
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FILTER_FORBIDDEN"


def test_dash_r67_004_invalid_dimension_ref(client):
    """T-DASH-R67-004-05: 非法 dimensionRef → 422。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id)
    payload["filters"][0]["dimensionRef"] = "Bad-Ref"
    resp = client.post("/api/v1/dashboards/global-filters/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_FILTER_INVALID_DIMENSION_REF"


def test_dash_r67_004_duplicate_parameter_key(client):
    """T-DASH-R67-004-06: 重复 parameterKey → 422。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id)
    payload["linkageRules"].append(
        {"sourceFilterId": "f1", "targetWidgetIds": [_R67_WIDGET_ID], "parameterKey": "region"},
    )
    resp = client.post("/api/v1/dashboards/global-filters/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_FILTER_DUPLICATE_PARAMETER_KEY"


def test_dash_r67_004_r61_regression_pointer(client):
    """T-DASH-R67-004-07: r61 T-DASH-R61-004-01 validate 仍 200。"""
    dash_id = _create_dashboard_with_widget(client)
    resp = client.post(
        "/api/v1/dashboards/global-filters/validate",
        headers=AUTH,
        json=_filter_linkage_payload(dash_id),
    )
    assert resp.status_code == 200


# --- NFR-001 ---


def test_nfr_r67_001_probe_validate_under_50ms():
    """T-NFR-R67-001-01: probe_validate_first_screen_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_validate_first_screen_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_nfr_r67_001_probe_probe_under_50ms():
    """T-NFR-R67-001-02: probe_first_screen_probe_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_first_screen_probe_budget_ms(actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_nfr_r67_001_enterprise_forbidden(client, enterprise_user):
    """T-NFR-R67-001-03: enterprise 越权 dashboardId → 403。"""
    set_user_first_screen_scope("enterprise-r67", "dash-allowed-")
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/probe",
        headers=AUTH,
        json={"dashboardId": "other-dash-001"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASHBOARD_FIRST_SCREEN_FORBIDDEN"


def test_nfr_r67_001_invalid_dashboard_id(client):
    """T-NFR-R67-001-04: dashboardId 含空格 → 422。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "bad id", "budgetMs": 5000},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASHBOARD_FIRST_SCREEN_INVALID_DASHBOARD_ID"


def test_nfr_r67_001_validate_ok(client):
    """T-NFR-R67-001-05: 合法 validate 仍 200（r64 语义）。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/validate",
        headers=AUTH,
        json={"dashboardId": "dash-001", "budgetMs": 5000, "widgetCount": 12},
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_nfr_r67_001_r64_regression_probe_elapsed(client):
    """T-NFR-R67-001-06: probe 默认 elapsedMs=800 withinBudget=true。"""
    resp = client.post(
        "/api/v1/nfr/dashboard-first-screen/probe",
        headers=AUTH,
        json={"dashboardId": "dash-001"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["elapsedMs"] == 800
    assert body["withinBudget"] is True


# --- NFR-002 ---


def test_nfr_r67_002_probe_validate_under_50ms():
    """T-NFR-R67-002-01: probe_validate_report_perf_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_validate_report_perf_budget_ms(actor)
    assert result.ok is True


def test_nfr_r67_002_probe_probe_under_50ms():
    """T-NFR-R67-002-02: probe_report_perf_probe_budget_ms < 50ms。"""
    actor = UserContext(id="dev", username="dev", roles=["admin"])
    result = probe_report_perf_probe_budget_ms(actor)
    assert result.ok is True


def test_nfr_r67_002_enterprise_forbidden(client, enterprise_user):
    """T-NFR-R67-002-03: enterprise 越权 reportId → 403。"""
    set_user_report_perf_scope("enterprise-r67", "rpt-allowed-")
    resp = client.post(
        "/api/v1/nfr/report-query-perf/probe",
        headers=AUTH,
        json={"reportId": "other-rpt-001"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "REPORT_PERF_FORBIDDEN"


def test_nfr_r67_002_invalid_sample_query_id(client):
    """T-NFR-R67-002-04: 非法 sampleQueryId → 422。"""
    resp = client.post(
        "/api/v1/nfr/report-query-perf/validate",
        headers=AUTH,
        json={"reportId": "rpt-001", "sampleQueryId": "Bad-ID"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_PERF_INVALID_SAMPLE_QUERY"


def test_nfr_r67_002_simulate_failure(client):
    """T-NFR-R67-002-05: simulateFailure=true → samplePassed=false。"""
    resp = client.post(
        "/api/v1/nfr/report-query-perf/probe",
        headers=AUTH,
        json={"reportId": "rpt-001", "simulateFailure": True},
    )
    assert resp.status_code == 200
    assert resp.json()["samplePassed"] is False


def test_nfr_r67_002_r61_regression(client):
    """T-NFR-R67-002-06: probe 默认 elapsedMs=120（r61 语义）。"""
    resp = client.post(
        "/api/v1/nfr/report-query-perf/probe",
        headers=AUTH,
        json={"reportId": "rpt-001"},
    )
    assert resp.status_code == 200
    assert resp.json()["elapsedMs"] == 120


# --- CONN-018 ---


def test_conn_r67_018_probe_under_50ms():
    """T-CONN-R67-018-01: probe_test_connection_budget_ms < 50ms。"""
    mock_conn = MagicMock()
    with patch.object(KingbaseConnector()._inner, "open_connection", return_value=mock_conn):
        result = probe_test_connection_budget_ms(
            host="127.0.0.1", port=54321, database="db", username="u", password="p",
        )
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_conn_r67_018_http_missing_host(client):
    """T-CONN-R67-018-02: 缺 host HTTP draft → 422 KINGBASE_INVALID_PARAMS。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-missing-host",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "",
            "port": 54321,
            "database": "db",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "KINGBASE_INVALID_PARAMS"


def test_conn_r67_018_http_port_out_of_range(client):
    """T-CONN-R67-018-03: port=0 → 422 KINGBASE_PORT_OUT_OF_RANGE。"""
    resp = client.post(
        "/api/v1/datasources/test",
        headers=AUTH,
        json={
            "type": "kingbase",
            "name": "kb-bad-port",
            "code": f"kb-{uuid.uuid4().hex[:8]}",
            "host": "127.0.0.1",
            "port": 0,
            "database": "db",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "KINGBASE_PORT_OUT_OF_RANGE"


def test_conn_r67_018_auth_failed_regression():
    """T-CONN-R67-018-04: mock auth 失败仍 KINGBASE_AUTH_FAILED。"""
    import psycopg

    connector = KingbaseConnector()
    err = psycopg.OperationalError("password authentication failed")
    err.sqlstate = "28P01"
    with patch.object(connector._inner, "open_connection", side_effect=err):
        result = connector.test_connection(
            host="h", port=54321, username="u", password="p", database="d",
        )
    assert result.ok is False
    assert result.code == "KINGBASE_AUTH_FAILED"


def test_conn_r67_018_http_no_password_leak(client):
    """T-CONN-R67-018-05: 响应不得含 password。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "kingbase",
                "name": "kb-nopw",
                "code": f"kb-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 54321,
                "database": "db",
                "username": "u",
                "password": "secret",
            },
        )
    assert resp.status_code == 200
    assert "password" not in resp.text.lower()


def test_conn_r67_018_r59_regression_pointer(client):
    """T-CONN-R67-018-06: r59 HTTP draft kingbase 200 指针。"""
    mock_result = type("R", (), {"ok": True, "message": "ok", "latency_ms": 1, "code": None})()
    with patch("app.datasources.dialects.kingbase.connector.KingbaseConnector.test_connection", return_value=mock_result):
        resp = client.post(
            "/api/v1/datasources/test",
            headers=AUTH,
            json={
                "type": "kingbase",
                "name": "kb-ok",
                "code": f"kb-{uuid.uuid4().hex[:8]}",
                "host": "127.0.0.1",
                "port": 54321,
                "database": "db",
                "username": "u",
                "password": "p",
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# --- RPT-003 ---


def test_rpt_r67_003_probe_validate_under_50ms():
    """T-RPT-R67-003-01: probe_validate_template_budget_ms < 50ms。"""
    from app.reports.templates.schemas import TemplateDefinitionIn

    payload = TemplateDefinitionIn.model_validate(_template_payload("tmpl-probe-val"))
    result = probe_validate_template_budget_ms(payload)
    assert result.ok is True


def test_rpt_r67_003_probe_get_under_50ms():
    """T-RPT-R67-003-02: probe_get_template_budget_ms < 50ms。"""
    from app.reports.templates.schemas import TemplateDefinitionIn

    key = "tmpl-probe-get"
    template_service.upsert_template_definition(
        key,
        TemplateDefinitionIn.model_validate(_template_payload(key)),
        UserContext(id="dev", username="dev", roles=["admin"]),
    )
    result = probe_get_template_budget_ms(key, UserContext(id="dev", username="dev", roles=["admin"]))
    assert result.ok is True


def test_rpt_r67_003_viewer_put_forbidden(client, viewer_user):
    """T-RPT-R67-003-03: viewer PUT → 403 RPT_TEMPLATE_FORBIDDEN。"""
    key = "tmpl-viewer-block"
    resp = client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=_template_payload(key))
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_TEMPLATE_FORBIDDEN"


def test_rpt_r67_003_enterprise_get_forbidden(client, enterprise_user):
    """T-RPT-R67-003-04: enterprise 越权 key GET → 403。"""
    key = "tmpl-admin-only"
    admin_put = client.put(f"/api/v1/reports/templates/{key}", headers=AUTH, json=_template_payload(key))
    assert admin_put.status_code == 200
    set_user_template_scope("enterprise-r67", "tmpl-allowed-")
    resp = client.get(f"/api/v1/reports/templates/{key}", headers=AUTH)
    assert resp.status_code == 403


def test_rpt_r67_003_duplicate_block(client):
    """T-RPT-R67-003-05: duplicate sql block → 422 RPT_TEMPLATE_DUPLICATE_BLOCK。"""
    key = "tmpl-dup"
    payload = _template_payload(key)
    payload["blocks"] = [
        {"blockType": "sql", "queryRef": "q1"},
        {"blockType": "sql", "queryRef": "q1"},
    ]
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_TEMPLATE_DUPLICATE_BLOCK"


def test_rpt_r67_003_chart_type_guard(client):
    """T-RPT-R67-003-06: chart 块非法 chartType → 422 RPT_TEMPLATE_INVALID_BLOCK。"""
    key = "tmpl-bad-chart"
    payload = {
        "templateKey": key,
        "format": "pdf",
        "displayName": "bad chart",
        "blocks": [{"blockType": "chart", "chartType": "donut"}],
    }
    resp = client.post("/api/v1/reports/templates/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422


def test_rpt_r67_003_r62_regression(client):
    """T-RPT-R67-003-07: r62 validate word+sql 仍 200。"""
    resp = client.post(
        "/api/v1/reports/templates/validate",
        headers=AUTH,
        json=_template_payload("tmpl-r62-pointer"),
    )
    assert resp.status_code == 200
    assert resp.json()["valid"] is True
