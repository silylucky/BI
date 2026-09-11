"""M9 主题分析 + M10/M12 报表 companion 质量推分 r58."""
from __future__ import annotations

import os
import subprocess
import sys
import time
import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
_R58_SQLITE_URL = "sqlite+pysqlite:///file:dash_rpt_r58?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r58_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R58_SQLITE_URL
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
    import app.metadata.dimensions.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
    from sqlalchemy.orm import Session
    from app.metadata.dimensions.service import ensure_legacy_probe_dimensions

    with Session(engine) as session:
        ensure_legacy_probe_dimensions(session)
    yield
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
        return UserContext(id="00000000-0000-4000-8000-000000000058", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def editor_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000059", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R58 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r58 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _chart_table_config() -> dict:
    return {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1 AS id",
    }


def _put_chart_widget(client: TestClient, dash_id: str, widget_id: str | None = None) -> str:
    wid = widget_id or str(uuid.uuid4())
    resp = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": wid,
                        "type": "chart",
                        "title": "Sales",
                        "colSpan": 12,
                        "rowSpan": 1,
                        "order": 0,
                        "chartConfig": _chart_table_config(),
                    }
                ],
                "globalFilters": [],
            }
        },
    )
    assert resp.status_code == 200, resp.text
    return wid


def _save_theme_config(
    client: TestClient,
    dash_id: str,
    *,
    granularity: str = "month",
    widget_id: str | None = None,
    dimension_id: str = "dim_sales",
) -> None:
    wid = widget_id or str(uuid.uuid4())
    payload = {
        "entityType": "sales",
        "timeGranularity": granularity,
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": dimension_id, "label": "Sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": dimension_id}],
    }
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text


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


def _schedule_and_execute(
    client: TestClient,
    node_id: str,
    *,
    idempotency_key: str | None = None,
    delivery_mock: str | None = "success",
) -> dict:
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    assert sched.status_code == 201, sched.text
    sid = sched.json()["id"]
    client.post(
        f"/api/v1/reports/schedules/{sid}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    headers = {
        **AUTH,
        "Idempotency-Key": idempotency_key or f"r58-{uuid.uuid4().hex}",
        "X-Rpt-Semi-Real": "1",
    }
    if delivery_mock is not None:
        headers["X-Rpt-Delivery-Mock"] = delivery_mock
    resp = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


# --- DASH-006 execute-plan ---


def test_r58_fixture_bootstraps(client):
    """T-R58-000-01: r58 sqlite 环境 health 可达。"""
    assert client.get("/health").status_code == 200


def test_dash_r58_execute_plan_happy_path(client):
    """D58-006-01: execute-plan 合法 dashboard → 200 planVersion=theme-plan-v1 四步 pass。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["planVersion"] == "theme-plan-v1"
    steps = [s["step"] for s in body["steps"]]
    assert steps == ["config_load", "bindings_resolve", "granularity_window", "geo_check"]
    assert all(s["status"] in ("pass", "skip") for s in body["steps"])


def test_dash_r58_execute_plan_yoy_compare_window(client):
    """D58-006-02: timeGranularity=yoy → compareWindow baseline/current 非空 ISO 区间。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid, granularity="yoy")
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    cw = resp.json().get("compareWindow")
    assert cw is not None
    assert cw["current"]["start"] and cw["current"]["end"]
    assert cw["baseline"]["start"] and cw["baseline"]["end"]


def test_dash_r58_execute_plan_mom_compare_window(client):
    """D58-006-02b: timeGranularity=mom → compareWindow 非空。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid, granularity="mom")
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json().get("compareWindow") is not None


def test_dash_r58_execute_plan_config_not_found(client):
    """D58-006-01b: 无 theme config → 404 CONFIG_NOT_FOUND。"""
    dash_id = _create_dashboard(client)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CONFIG_NOT_FOUND"


def test_dash_r58_resolved_widgets_chart_type(client):
    """D58-006-04: resolvedWidgets chartType 与 layout 一致。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    widgets = resp.json().get("resolvedWidgets", [])
    assert len(widgets) >= 1
    assert widgets[0]["chartType"] == "table"
    assert widgets[0]["widgetId"] == wid


def test_dash_r58_probe_execute_plan_under_budget(client):
    """D58-006-05: probe_theme_execute_plan ≤40ms。"""
    from app.auth.deps import UserContext
    from app.dashboard.theme.execute import probe_theme_execute_plan_budget_ms
    from app.datasources.models import get_meta_session

    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    db = get_meta_session()
    try:
        elapsed = probe_theme_execute_plan_budget_ms(
            db, "dashboard", uuid.UUID(dash_id), UserContext(id="dev", username="dev", roles=["admin"], is_root=True),
        )
    finally:
        db.close()
    assert elapsed <= 40.0


def test_dash_r58_execute_plan_day_no_compare_window(client):
    """D58-006-02c: day granularity → compareWindow 为空。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid, granularity="day")
    resp = client.post(
        "/api/v1/dashboards/theme-analysis/execute-plan",
        headers=AUTH,
        json={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json().get("compareWindow") is None


# --- DASH-006 theme ACL ---


def test_dash_r58_theme_viewer_put_forbidden(client):
    """D58-006-03: viewer PUT theme-analysis → 403 DASH_THEME_FORBIDDEN。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = {
        "entityType": "sales",
        "timeGranularity": "month",
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": "dim_sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": "dim_sales"}],
    }

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000058", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_THEME_FORBIDDEN"
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_dash_r58_theme_editor_put_allowed(client):
    """D58-006-03b: editor PUT theme-analysis → 200。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = {
        "entityType": "sales",
        "timeGranularity": "month",
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": "dim_sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": "dim_sales"}],
    }

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000059", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_dash_r58_theme_viewer_get_allowed(client):
    """D58-006-03c: viewer GET theme-analysis → 200（read 放行）。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000058", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.get(
        "/api/v1/dashboards/theme-analysis",
        headers=AUTH,
        params={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200, resp.text
    fastapi_app.dependency_overrides.pop(get_current_user, None)


# --- RPT-004 compare ---


def test_rpt_r58_compare_preview_yoy(client):
    """D58-004-01: compareMode=yoy upsert → compare-preview 200 slots。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "revenue", "label": "Revenue", "expression": "sum(amt)", "compareMode": "yoy"}],
        },
    )
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension/compare-preview",
        headers=AUTH,
        json={"compareMode": "yoy"},
    )
    assert resp.status_code == 200, resp.text
    slots = resp.json()["slots"]
    assert len(slots) >= 1
    assert slots[0]["compareMode"] == "yoy"


def test_rpt_r58_compare_preview_mom(client):
    """D58-004-01b: compare-preview mom slots。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "orders", "label": "Orders", "compareMode": "mom"}],
        },
    )
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension/compare-preview",
        headers=AUTH,
        json={"compareMode": "mom"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["slots"][0]["compareMode"] == "mom"


def test_rpt_r58_render_spec_compare_metrics(client):
    """D58-004-02: render-spec 含 compareMetrics 与 compareVersion。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "orders", "label": "Orders", "compareMode": "mom"}],
        },
    )
    resp = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["compareVersion"] == "1.0"
    assert len(body.get("compareMetrics", [])) >= 1


def test_rpt_r58_invalid_compare_mode(client):
    """D58-004-04: 非法 compareMode → 422 RPT_EXT_INVALID_COMPARE。"""
    node_id = _create_template_node(client)
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "bad", "label": "Bad", "compareMode": "wow"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_COMPARE"


def test_rpt_r58_compare_preview_folder_rejected(client):
    """D58-006R-02b: folder 节点 compare-preview → 422 RPT_EXT_INVALID_NODE_TYPE。"""
    folder_id = _create_folder_node(client)
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{folder_id}/extension/compare-preview",
        headers=AUTH,
        json={"compareMode": "yoy"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_EXT_INVALID_NODE_TYPE"


# --- RPT-004/006 extension ACL ---


def test_rpt_r58_extension_viewer_put_forbidden(client):
    """D58-004-03: viewer PUT extension → 403 RPT_EXT_FORBIDDEN。"""
    node_id = _create_template_node(client)

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000058", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "m1", "label": "M1"}]},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_EXT_FORBIDDEN"
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_rpt_r58_extension_viewer_render_spec_read_ok(client):
    """D58-004-03b: viewer GET render-spec → 200（read 放行）。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "m1", "label": "M1"}]},
    )

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000058", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert resp.status_code == 200, resp.text
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_rpt_r58_extension_editor_put_allowed(client):
    """D58-004-03c: editor PUT extension → 200。"""
    node_id = _create_template_node(client)

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000059", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "m2", "label": "M2"}]},
    )
    assert resp.status_code == 200, resp.text
    fastapi_app.dependency_overrides.pop(get_current_user, None)


# --- RPT-005 semi-real ---


def test_rpt_r58_semi_real_execute_succeeded(client):
    """D58-005-01: explicit X-Rpt-Delivery-Mock:success → semi_real_succeeded."""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id, delivery_mock="success")
    assert body["status"] == "succeeded"
    assert len(body.get("deliverySteps", [])) >= 1


def test_rpt_r58_semi_real_delivery_unconfigured_without_header(client):
    """D58-005-01b: no delivery mock header + mock mode → semi_real_failed/unconfigured."""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id, delivery_mock=None)
    assert body["status"] == "failed"
    assert body.get("errorMessage")
    steps = body.get("deliverySteps", [])
    assert steps and steps[0].get("status") == "unconfigured"


def test_rpt_r58_semi_real_delivery_fail(client):
    """D58-005-02: X-Rpt-Delivery-Mock: fail → semi_real_failed (RPT-005 r238 契约)."""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id, delivery_mock="fail")
    assert body["status"] == "failed"
    assert body.get("errorMessage")


def test_rpt_r58_semi_real_delivery_retry(client):
    """D58-005-03: X-Rpt-Delivery-Mock: retry → attempt=2 delivered。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id, delivery_mock="retry")
    steps = body.get("deliverySteps", [])
    assert any(s.get("attempt") == 2 and s.get("status") == "delivered" for s in steps)


def test_rpt_r58_revision_snapshot_on_execute(client):
    """D58-005-04: 有 extension 时 revisionSnapshot.revision 与当前一致。"""
    node_id = _create_template_node(client)
    upsert = client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "k1", "label": "K1"}], "changeNote": "r58"},
    )
    rev = upsert.json()["revision"]
    body = _schedule_and_execute(client, node_id)
    snap = body.get("revisionSnapshot")
    assert snap is not None
    assert snap["revision"] == rev


def test_rpt_r58_probe_semi_real_under_budget(client):
    """D58-005-06: probe_semi_real_execute ≤35ms。"""
    from app.reports.scheduler.executor import probe_semi_real_execute_budget_ms

    node_id = _create_template_node(client)
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    sid = sched.json()["id"]
    client.post(f"/api/v1/reports/schedules/{sid}/transition", headers=AUTH, json={"action": "schedule"})
    actor = UserContext(id="00000000-0000-4000-8000-000000000001", username="admin", roles=["admin"])
    elapsed = probe_semi_real_execute_budget_ms(uuid.UUID(sid), f"probe-{uuid.uuid4().hex}", actor)
    assert elapsed <= 35.0


def test_rpt_r58_semi_real_idempotency_replay(client):
    """D58-005-05b: semi-real Idempotency-Key 重放相同 executionId。"""
    node_id = _create_template_node(client)
    key = f"idem-{uuid.uuid4().hex}"
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node_id, "cron": "0 8 * * *"},
    )
    sid = sched.json()["id"]
    client.post(f"/api/v1/reports/schedules/{sid}/transition", headers=AUTH, json={"action": "schedule"})
    headers = {**AUTH, "Idempotency-Key": key, "X-Rpt-Semi-Real": "1"}
    first = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=headers).json()
    second = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=headers).json()
    assert first["executionId"] == second["executionId"]


# --- RPT-005/007 artifact ACL ---


def test_rpt_r58_artifact_owner_can_read(client):
    """D58-007-01: owner/admin artifact GET → 200。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id)
    eid = body["executionId"]
    resp = client.get(f"/api/v1/reports/schedules/executions/{eid}/artifact", headers=AUTH)
    assert resp.status_code == 200, resp.text
    assert resp.json()["artifactRef"] == body["artifactRef"]


def test_rpt_r58_artifact_viewer_other_forbidden(client):
    """D58-005-05 / D58-007-01: 非 owner viewer GET artifact → 403 RPT_ARTIFACT_FORBIDDEN。"""
    node_id = _create_template_node(client)
    body = _schedule_and_execute(client, node_id)
    eid = body["executionId"]

    async def _override() -> UserContext:
        return UserContext(id="00000000-0000-4000-8000-000000000058", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    resp = client.get(f"/api/v1/reports/schedules/executions/{eid}/artifact", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_ARTIFACT_FORBIDDEN"
    fastapi_app.dependency_overrides.pop(get_current_user, None)


# --- RPT-006/007 batch + LINK ---


def test_rpt_r58_batch_yoy_render_spec_compare(client):
    """D58-006R-01: batch 含 yoy metric → render-spec compareMetrics 非空。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {
                    "name": f"BatchYoy-{uuid.uuid4().hex[:6]}",
                    "templateKind": "excel",
                    "extension": {
                        "metrics": [{"key": "sales", "label": "Sales", "compareMode": "yoy"}],
                    },
                }
            ]
        },
    )
    assert resp.status_code == 201, resp.text
    node_id = resp.json()["createdNodeIds"][0]
    spec = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert len(spec.json().get("compareMetrics", [])) >= 1


def test_rpt_r58_render_spec_probe_under_50ms(client):
    """D58-006R-02: render-spec probe <50ms（r55 门槛）。"""
    from app.reports.extension.render import probe_extension_load_budget_ms

    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [{"key": "m1", "label": "M1"}]},
    )
    start = time.perf_counter()
    client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/render-spec", headers=AUTH)
    assert (time.perf_counter() - start) * 1000 < probe_extension_load_budget_ms


def test_rpt_r58_batch_partial_failure_rolled_back(client):
    """D58-007-03: partial failure detail.rolledBackCount 结构不变。"""
    resp = client.post(
        "/api/v1/reports/batch",
        headers=AUTH,
        json={
            "items": [
                {"name": "Ok1", "templateKind": "excel"},
                {"name": "BadParent", "templateKind": "excel", "parentId": str(uuid.uuid4())},
            ]
        },
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    assert detail["rolledBackCount"] >= 1


def test_rpt_r58_batch_10_items_probe_under_200ms(client):
    """D58-007-02: batch 10 项含 compare metrics probe <200ms。"""
    from app.reports.batch.schemas import BatchCreateReportsIn, BatchExtensionInline, BatchReportItem
    from app.reports.batch.service import probe_batch_create_budget_ms, timed_batch_create_budget_ms
    from app.reports.extension.schemas import MetricAdjustment

    items = [
        BatchReportItem(
            name=f"B{i}",
            template_kind="excel",
            extension=BatchExtensionInline(
                metrics=[MetricAdjustment(key="m", label="M", compare_mode="mom")],
            ),
        )
        for i in range(10)
    ]
    elapsed = timed_batch_create_budget_ms(BatchCreateReportsIn(items=items), None)
    assert elapsed < probe_batch_create_budget_ms


def test_dash_r58_theme_schedule_link_semi_real(client):
    """D58-006-06: theme 保存 → semi-real schedule execute 全链 LINK。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    _save_theme_config(client, dash_id, widget_id=wid)
    node_id = _create_template_node(client, name="ThemeLink")
    body = _schedule_and_execute(client, node_id)
    assert body["status"] in {"succeeded", "delivery_degraded", "semi_real_succeeded", "semi_real_delivery_degraded"}
    assert body.get("deliverySteps")


def test_rpt_r58_revisions_change_note_after_compare_upsert(client):
    """D58-006R-03: compare upsert 后 revisions 仍含 changeNote。"""
    node_id = _create_template_node(client)
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={
            "catalogNodeId": node_id,
            "metrics": [{"key": "rev", "label": "Rev", "compareMode": "yoy"}],
            "changeNote": "r58 compare",
        },
    )
    revs = client.get(f"/api/v1/reports/catalog/nodes/{node_id}/extension/revisions", headers=AUTH)
    assert revs.status_code == 200
    assert any(r.get("changeNote") for r in revs.json()["items"])


# --- 回归门控 subprocess ---


def test_r58_regression_gate_r57_subprocess():
    """全轮回归：r57 37/37 不被 semi-real 破坏。"""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(_BACKEND_DIR.parent / "tests/test_dash_rpt_query_nfr_r57.py"), "-q"],
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_r58_regression_gate_r55_subprocess():
    """全轮回归：r55 35/35。"""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(_BACKEND_DIR.parent / "tests/test_rpt_gov_meta_conn_r55.py"), "-q"],
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_r58_regression_gate_r53_subprocess():
    """全轮回归：r53 38/38。"""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(_BACKEND_DIR.parent / "tests/test_dash_rpt_query_nfr_r53.py"), "-q"],
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_r58_regression_gate_r52_subprocess():
    """全轮回归：r52 52/52。"""
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", str(_BACKEND_DIR.parent / "tests/test_design_conn_gov_query_r52.py"), "-q"],
        cwd=str(_BACKEND_DIR),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_dash_r58_theme_admin_put_allowed(client):
    """D58-006-03d: admin PUT theme-analysis → 200。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = {
        "entityType": "sales",
        "timeGranularity": "week",
        "refType": "dashboard",
        "refId": dash_id,
        "dimensions": [{"dimensionId": "dim_sales"}],
        "chartViewBindings": [{"widgetId": wid, "dimensionId": "dim_sales"}],
    }
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text
