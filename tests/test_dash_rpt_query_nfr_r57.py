"""M9 主题分析 + M10/M12 报表 + M13 Dataset/NFR companion 质量推分 r57."""
from __future__ import annotations

import os
import subprocess
import sys
import uuid
from pathlib import Path
from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
_R57_SQLITE_URL = "sqlite+pysqlite:///file:dash_rpt_query_nfr_r57?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r57_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R57_SQLITE_URL
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
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


@pytest.fixture
def analyst_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="analyst-1", username="analyst", roles=["analyst"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-1", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def editor_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="editor-1", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R57 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r57 fixture"},
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


def _theme_config_payload(ref_id: str, widget_id: str | None = None) -> dict:
    payload = {
        "entityType": "store",
        "timeGranularity": "month",
        "dimensions": [{"dimensionId": "region", "label": "Region", "sortOrder": 0}],
        "refType": "dashboard",
        "refId": ref_id,
    }
    if widget_id:
        payload["chartViewBindings"] = [{"widgetId": widget_id, "dimensionId": "region"}]
    return payload


def _scheduled_fixture(client: TestClient) -> str:
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "SchedTpl", "nodeType": "template", "templateKind": "pdf"},
    ).json()
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node["id"], "cron": "0 0 * * *"},
    ).json()
    client.post(
        f"/api/v1/reports/schedules/{sched['id']}/transition",
        headers=AUTH,
        json={"action": "schedule"},
    )
    return sched["id"]


def test_r57_fixture_bootstraps(client: TestClient):
    """T-R57-000-01: r57 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


# --- DASH-006 ---


def test_dash006_valid_chart_bindings_put_200(client: TestClient):
    """T-DASH-R57-006-01: 合法 chartViewBindings + chart widget → PUT 200。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = _theme_config_payload(dash_id, wid)
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json()["chartViewBindings"][0]["widgetId"] == wid


def test_dash006_missing_widget_422(client: TestClient):
    """T-DASH-R57-006-02: binding.widgetId 不在 layout → 422 DASH_THEME_CHART_VIEW_MISMATCH。"""
    dash_id = _create_dashboard(client)
    payload = _theme_config_payload(dash_id, str(uuid.uuid4()))
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "DASH_THEME_CHART_VIEW_MISMATCH"
    assert body["detail"]["fields"]


def test_dash006_bad_dimension_422(client: TestClient):
    """T-DASH-R57-006-03: dimensionId 不在 dimensions → 422。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    payload = _theme_config_payload(dash_id, wid)
    payload["chartViewBindings"][0]["dimensionId"] = "missing-dim"
    resp = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_THEME_CHART_VIEW_MISMATCH"


def test_dash006_invalid_chart_config_422(client: TestClient):
    """T-DASH-R57-006-04: chartConfig 非法 chartType → 422。"""
    dash_id = _create_dashboard(client)
    wid = str(uuid.uuid4())
    client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": wid,
                        "type": "chart",
                        "title": "Bad",
                        "colSpan": 12,
                        "order": 0,
                        "chartConfig": {"chartType": "not-a-real-type", "styleVariant": "default"},
                    }
                ],
                "globalFilters": [],
            }
        },
    )
    resp = client.put(
        "/api/v1/dashboards/theme-analysis",
        headers=AUTH,
        json=_theme_config_payload(dash_id, wid),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_THEME_CHART_VIEW_MISMATCH"


def test_dash006_get_chart_bindings(client: TestClient):
    """T-DASH-R57-006-05: GET chart-bindings 返回 linkedWidgetCount。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_config_payload(dash_id, wid))
    resp = client.get(
        "/api/v1/dashboards/theme-analysis/chart-bindings",
        headers=AUTH,
        params={"refType": "dashboard", "refId": dash_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["linkedWidgetCount"] == 1
    assert len(body["bindings"]) == 1


def test_dash006_empty_bindings_regression(client: TestClient):
    """T-DASH-R57-006-06: chartViewBindings 空 → r53 PUT/GET 行为不变。"""
    dash_id = _create_dashboard(client)
    payload = _theme_config_payload(dash_id)
    assert "chartViewBindings" not in payload or payload.get("chartViewBindings") == []
    put = client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=payload)
    assert put.status_code == 200
    get = client.get(
        "/api/v1/dashboards/theme-analysis",
        headers=AUTH,
        params={"refType": "dashboard", "refId": dash_id},
    )
    assert get.status_code == 200


def test_dash006_link_performance_budget(client: TestClient):
    """T-DASH-R57-006-07: _link_chart_views ≤50ms（16 bindings fixture）。"""
    from sqlalchemy.orm import Session

    from app.dashboard.theme import service as theme_service
    from app.dashboard.theme.schemas import EntityThemeConfig, ThemeChartViewBinding, ThemeDimensionBinding
    from app.datasources.models import get_meta_session

    dash_id = _create_dashboard(client)
    widgets = []
    bindings = []
    for i in range(16):
        wid = str(uuid.uuid4())
        widgets.append(
            {
                "id": wid,
                "type": "chart",
                "title": f"W{i}",
                "colSpan": 12,
                "order": i,
                "chartConfig": _chart_table_config(),
            }
        )
        bindings.append(ThemeChartViewBinding(widgetId=wid, dimensionId="region"))
    client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={"layoutJson": {"version": 1, "widgets": widgets, "globalFilters": []}},
    )
    config = EntityThemeConfig(
        entityType="store",
        timeGranularity="month",
        dimensions=[ThemeDimensionBinding(dimensionId="region")],
        refType="dashboard",
        refId=uuid.UUID(dash_id),
        chartViewBindings=bindings,
    )
    session: Session = get_meta_session()
    try:
        elapsed = theme_service.probe_link_chart_views_budget_ms(session, config)
    finally:
        session.close()
    assert elapsed <= 50.0, f"link_chart_views took {elapsed:.2f}ms"


# --- QUERY-009 ---


def test_query009_execute_plan_analyst_200(client: TestClient, analyst_user):
    """T-QUERY-R57-009-01: analyst + demo-orders execute-plan → 200 四步 pass。"""
    resp = client.post(
        "/api/v1/query/dataset/execute-plan",
        headers=AUTH,
        json={"datasetId": "demo-orders", "operation": "select"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["planVersion"] == "dataset-plan-v1"
    assert len(body["steps"]) == 4
    assert all(s["status"] == "pass" for s in body["steps"])


def test_query009_forbidden_dataset_403(client: TestClient, analyst_user):
    """T-QUERY-R57-009-02: forbidden dataset → 403（plan 不生成）。"""
    resp = client.post(
        "/api/v1/query/dataset/execute-plan",
        headers=AUTH,
        json={"datasetId": "restricted-ledger", "operation": "select"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "QUERY_DATASET_FORBIDDEN"


def test_query009_path_ambiguous_422(client: TestClient):
    """T-QUERY-R57-009-03: path ambiguous → 422。"""
    resp = client.post(
        "/api/v1/query/dataset/execute-plan",
        headers=AUTH,
        json={
            "datasetId": "demo-orders",
            "dataSourceId": str(uuid.uuid4()),
            "operation": "select",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_PATH_AMBIGUOUS"


def test_query009_invalid_params_422(client: TestClient):
    """T-QUERY-R57-009-04: parameters 含 _sql → 422 QUERY_DATASET_PLAN_INVALID_PARAMS。"""
    resp = client.post(
        "/api/v1/query/dataset/execute-plan",
        headers=AUTH,
        json={"datasetId": "demo-orders", "operation": "select", "parameters": {"_sql": "bad"}},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "QUERY_DATASET_PLAN_INVALID_PARAMS"


def test_query009_plan_version(client: TestClient):
    """T-QUERY-R57-009-05: planVersion=dataset-plan-v1。"""
    resp = client.post(
        "/api/v1/query/dataset/execute-plan",
        headers=AUTH,
        json={"datasetId": "demo-orders", "operation": "select"},
    )
    assert resp.status_code == 200
    assert resp.json()["planVersion"] == "dataset-plan-v1"


def test_query009_execute_plan_performance(client: TestClient):
    """T-QUERY-R57-009-06: execute-plan ≤30ms。"""
    from app.query.dataset.executor import probe_execute_plan_budget_ms

    elapsed = probe_execute_plan_budget_ms(
        {"datasetId": "demo-orders", "operation": "select"},
        ["admin"],
    )
    assert elapsed <= 30.0


def test_query009_validate_execute_consistency(client: TestClient):
    """T-QUERY-R57-009-07: validate 与 execute-plan datasetId/readonly 一致。"""
    payload = {"datasetId": "demo-orders", "operation": "select"}
    v = client.post("/api/v1/query/dataset/validate", headers=AUTH, json=payload).json()
    p = client.post("/api/v1/query/dataset/execute-plan", headers=AUTH, json=payload).json()
    assert v["datasetId"] == p["datasetId"] == "demo-orders"
    assert v["readonly"] is True and p["readonly"] is True


# --- RPT-004 ---


def test_rpt004_viewer_create_forbidden(client: TestClient, viewer_user):
    """T-RPT-R57-004-01: viewer 创建节点 → 403 RPT_CATALOG_FORBIDDEN。"""
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Denied", "nodeType": "folder"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "RPT_CATALOG_FORBIDDEN"


def test_rpt004_editor_create_and_cross_update_forbidden(client: TestClient, editor_user):
    """T-RPT-R57-004-02: editor 创建 201；非 owner editor 更新他人节点 → 403。"""
    create = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Mine", "nodeType": "folder"},
    )
    assert create.status_code == 201
    node_id = create.json()["id"]

    async def _editor2() -> UserContext:
        return UserContext(id="editor-2", username="editor2", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _editor2
    patch = client.patch(
        f"/api/v1/reports/catalog/nodes/{node_id}",
        headers=AUTH,
        json={"name": "Hijack"},
    )
    assert patch.status_code == 403
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_rpt004_owner_delete_leaf(client: TestClient):
    """T-RPT-R57-004-03: owner 删除自有叶子 → 204。"""
    async def _owner() -> UserContext:
        return UserContext(id="owner-1", username="owner", roles=["owner", "editor"])

    fastapi_app.dependency_overrides[get_current_user] = _owner
    create = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "Leaf", "nodeType": "template", "templateKind": "pdf"},
    )
    assert create.status_code == 201
    node_id = create.json()["id"]
    resp = client.delete(f"/api/v1/reports/catalog/nodes/{node_id}", headers=AUTH)
    assert resp.status_code == 204
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_rpt004_admin_move_bypass(client: TestClient):
    """T-RPT-R57-004-04: admin 绕过 owner 限制 move → 200。"""
    folder = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "F", "nodeType": "folder"},
    ).json()
    leaf = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "L", "nodeType": "template", "templateKind": "pdf"},
    ).json()
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{leaf['id']}/move",
        headers=AUTH,
        json={"parentId": folder["id"]},
    )
    assert resp.status_code == 200


def test_rpt004_acl_performance(client: TestClient):
    """T-RPT-R57-004-05: ACL 判定 ≤10ms。"""
    from app.reports.catalog.acl import probe_acl_budget_ms

    actor = UserContext(id="admin-1", username="admin", roles=["admin"])
    node_id = uuid.uuid4()
    elapsed = probe_acl_budget_ms(actor, "read", node_id)
    assert elapsed <= 10.0


def test_rpt004_r53_depth_regression(client: TestClient):
    """T-RPT-R57-004-06: r53 深度/环用例仍通过（调用 r53 同类断言）。"""
    root = client.post(
        "/api/v1/reports/catalog/nodes", headers=AUTH, json={"name": "R", "nodeType": "folder"}
    ).json()
    child = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "C", "nodeType": "folder", "parentId": root["id"]},
    ).json()
    resp = client.post(
        f"/api/v1/reports/catalog/nodes/{root['id']}/move",
        headers=AUTH,
        json={"parentId": child["id"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_CATALOG_CYCLE"


# --- RPT-005 ---


def test_rpt005_execute_mock_succeeded(client: TestClient):
    """T-RPT-R57-005-01: X-Rpt-Execute-Mock:1 → 200 mock_succeeded (probe-only)."""
    sid = _scheduled_fixture(client)
    resp = client.post(
        f"/api/v1/reports/schedules/{sid}/execute",
        headers={**AUTH, "Idempotency-Key": "key-r57-01", "X-Rpt-Execute-Mock": "1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "mock_succeeded"
    assert body["artifactRef"].startswith("test://reports/")


def test_rpt005_idempotency_replay(client: TestClient):
    """T-RPT-R57-005-02: 相同 Idempotency-Key 重放返回相同 executionId。"""
    sid = _scheduled_fixture(client)
    headers = {**AUTH, "Idempotency-Key": "key-r57-idem", "X-Rpt-Execute-Mock": "1"}
    first = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=headers).json()
    second = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=headers).json()
    assert first["executionId"] == second["executionId"]


def test_rpt005_draft_not_ready_400(client: TestClient):
    """T-RPT-R57-005-03: draft 状态 execute → 400 RPT_SCHEDULE_EXECUTE_NOT_READY。"""
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "DraftTpl", "nodeType": "template", "templateKind": "pdf"},
    ).json()
    sched = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node["id"], "cron": "0 0 * * *"},
    ).json()
    resp = client.post(
        f"/api/v1/reports/schedules/{sched['id']}/execute",
        headers={**AUTH, "Idempotency-Key": "draft-key"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "RPT_SCHEDULE_EXECUTE_NOT_READY"


def test_rpt005_cron_day32_422(client: TestClient):
    """T-RPT-R57-005-04: cron 日字段 32 → 422。"""
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "CronTpl", "nodeType": "template", "templateKind": "pdf"},
    ).json()
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node["id"], "cron": "0 0 32 * *"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_SCHEDULE_INVALID_CRON"


def test_rpt005_cron_month25_422(client: TestClient):
    """T-RPT-R57-005-05: cron 月字段 25 → 422。"""
    node = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "CronTpl2", "nodeType": "template", "templateKind": "pdf"},
    ).json()
    resp = client.post(
        "/api/v1/reports/schedules",
        headers=AUTH,
        json={"catalogNodeId": node["id"], "cron": "0 0 1 25 *"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_SCHEDULE_INVALID_CRON"


def test_rpt005_missing_idempotency_key_422(client: TestClient):
    """T-RPT-R57-005-06: 缺 Idempotency-Key → 422。"""
    sid = _scheduled_fixture(client)
    resp = client.post(f"/api/v1/reports/schedules/{sid}/execute", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_SCHEDULE_EXECUTE_INVALID"


def test_rpt005_execute_performance(client: TestClient):
    """T-RPT-R57-005-07: mock execute ≤20ms。"""
    from app.reports.scheduler.executor import probe_mock_execute_budget_ms

    sid = uuid.uuid4()
    from app.reports.scheduler import service as scheduler_service
    from app.reports.catalog import service as catalog_service
    from app.reports.catalog.schemas import CatalogNodeCreate

    admin = UserContext(id="admin-perf", username="admin", roles=["admin"])
    node = catalog_service.create_node(
        CatalogNodeCreate(name="Perf", nodeType="template", templateKind="pdf"),
        admin,
    )
    from app.reports.scheduler.schemas import ScheduleCreate

    sched = scheduler_service.create_schedule(
        ScheduleCreate(catalogNodeId=node.id, cron="0 0 * * *"),
        admin,
    )
    scheduler_service.transition_schedule(sched.id, "schedule", admin)
    elapsed = probe_mock_execute_budget_ms(sched.id, f"perf-{uuid.uuid4().hex[:8]}", admin)
    assert elapsed <= 20.0


# --- NFR-008 ---


def test_nfr008_deployment_report_accepted(client: TestClient):
    """T-NFR-R57-008-01: GET deployment-report 默认 accepted。"""
    resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reportVersion"] == "nfr08-deployment-v1"
    assert body["overallAcceptance"] == "accepted"


def test_nfr008_pyproject_violation_rejected(client: TestClient):
    """T-NFR-R57-008-02: mock pyproject 违规 → rejected + remediation_index。"""
    fake = '[project]\ndependencies = ["apache-superset>=3.0"]\n'
    with patch("app.core.nfr.runtime_guard._read_pyproject_text", return_value=fake):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["overallAcceptance"] == "rejected"
    assert body["remediationIndex"]


def test_nfr008_violation_always_rejected(client: TestClient):
    """T-NFR-R57-008-03: loaded-modules fail → rejected。"""
    with patch.dict(sys.modules, {"superset": object()}):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["overallAcceptance"] == "rejected"


def test_nfr008_remediation_index_on_fail(client: TestClient):
    """T-NFR-R57-008-04: fail 项 remediation_index 非空。"""
    fake = '[project]\ndependencies = ["dataease-client"]\n'
    with patch("app.core.nfr.runtime_guard._read_pyproject_text", return_value=fake):
        resp = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH)
    idx = resp.json()["remediationIndex"]
    assert "pyproject-dependencies" in idx
    assert idx["pyproject-dependencies"]


def test_nfr008_deployment_report_performance(client: TestClient):
    """T-NFR-R57-008-05: deployment-report ≤100ms。"""
    from app.core.nfr.deployment_report import probe_deployment_report_budget_ms

    elapsed = probe_deployment_report_budget_ms()
    assert elapsed <= 100.0


# --- LINK ---


def test_r57_link_theme_dataset_no_conflict(client: TestClient):
    """T-R57-LINK-01: theme bindings + dataset execute-plan 同 dashboard ref 不冲突。"""
    dash_id = _create_dashboard(client)
    wid = _put_chart_widget(client, dash_id)
    client.put("/api/v1/dashboards/theme-analysis", headers=AUTH, json=_theme_config_payload(dash_id, wid))
    plan = client.post(
        "/api/v1/query/dataset/execute-plan",
        headers=AUTH,
        json={"datasetId": "demo-orders", "operation": "select"},
    )
    assert plan.status_code == 200


def test_r57_link_catalog_schedule_execute(client: TestClient):
    """T-R57-LINK-02: catalog node → schedule → execute 全链。"""
    sid = _scheduled_fixture(client)
    resp = client.post(
        f"/api/v1/reports/schedules/{sid}/execute",
        headers={**AUTH, "Idempotency-Key": "link-chain-key", "X-Rpt-Execute-Mock": "1"},
    )
    assert resp.status_code == 200


def test_r57_link_deployment_runtime_consistency(client: TestClient):
    """T-R57-LINK-03: deployment-report.runtime 与 GET runtime-compliance 一致。"""
    dep = client.get("/api/v1/nfr/runtime-compliance/deployment-report", headers=AUTH).json()
    rt = client.get("/api/v1/nfr/runtime-compliance", headers=AUTH).json()
    assert dep["runtime"]["overallStatus"] == rt["overallStatus"]
    assert dep["runtime"]["policyVersion"] == rt["policyVersion"]


def test_r57_link_regression_suites_green():
    """T-R57-LINK-04: r53+r55+r52 回归套件全绿（subprocess 门控）。"""
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "-q",
        str(_BACKEND_DIR.parent / "tests" / "test_dash_rpt_query_nfr_r53.py"),
        str(_BACKEND_DIR.parent / "tests" / "test_rpt_gov_meta_conn_r55.py"),
        str(_BACKEND_DIR.parent / "tests" / "test_design_conn_gov_query_r52.py"),
    ]
    proc = subprocess.run(cmd, cwd=str(_BACKEND_DIR), capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
