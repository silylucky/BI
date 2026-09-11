"""跨域远期 stub L1 kickoff r60 — RPT/VIEW/CAT/GOV."""
from __future__ import annotations

import os
import time
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH, jwt_auth_headers

_R60_SQLITE_URL = "sqlite+pysqlite:///file:rpt_view_cat_gov_r60?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r60_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R60_SQLITE_URL
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
    import app.views.models  # noqa: F401

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
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r60", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def integration_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="integration-r60", username="integration", roles=["integration"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_report_template(client: TestClient, *, template_kind: str | None = "pdf") -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={
            "name": f"Tpl-{uuid.uuid4().hex[:6]}",
            "nodeType": "template",
            "templateKind": template_kind,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_report_folder(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": f"Folder-{uuid.uuid4().hex[:6]}", "nodeType": "folder"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"Dash-{uuid.uuid4().hex[:6]}", "description": "r60 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_published_entry(client: TestClient, *, path: str) -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "R60 Entry",
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": "published",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _valid_user_layout(widget_count: int = 1) -> dict:
    widgets = []
    for i in range(widget_count):
        wid = str(uuid.uuid4())
        widgets.append(
            {
                "id": wid,
                "type": "chart",
                "title": f"W{i}",
                "colSpan": 12,
                "order": i,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": "SELECT 1",
                },
            }
        )
    return {"version": 1, "widgets": widgets, "globalFilters": []}


def test_r60_fixture_bootstraps(client):
    """T-RPT-R60-000-01: r60 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r60_engine_module_importable():
    """T-RPT-R60-000-02: reports.engine 包可导入。"""
    from app.reports.engine import errors  # noqa: F401

    assert hasattr(errors, "ReportEngineError")


def test_rpt_run_ok(client):
    """T-RPT-R60-001-01: POST run 合法 template → 200 + engineVersion=1.0。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"parameters": {"region": "east"}, "format": "web"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["renderSpec"]["engineVersion"] == "1.0"
    assert body["renderSpec"]["templateNodeId"] == tid
    assert body["renderSpec"]["parameters"] == {"region": "east"}


def test_rpt_run_unknown_template_404(client):
    """T-RPT-R60-001-02: 未知 template id → 404 RPT_ENGINE_TEMPLATE_NOT_FOUND。"""
    resp = client.post(
        f"/api/v1/reports/templates/{uuid.uuid4()}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "RPT_ENGINE_TEMPLATE_NOT_FOUND"


def test_rpt_run_not_template_422(client):
    """T-RPT-R60-001-03: folder 节点 → 422 RPT_ENGINE_NOT_TEMPLATE。"""
    fid = _create_report_folder(client)
    resp = client.post(
        f"/api/v1/reports/templates/{fid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_NOT_TEMPLATE"


def test_rpt_run_pdf_not_supported(client):
    """T-RPT-R60-001-04: format=pdf → 422 RPT_ENGINE_FORMAT_NOT_SUPPORTED。"""
    tid = _create_report_template(client)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "pdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_FORMAT_NOT_SUPPORTED"


def test_rpt_run_incomplete_template(client):
    """T-RPT-R60-001-05: templateKind 非空且无 extension → 422 RPT_ENGINE_INCOMPLETE_TEMPLATE。"""
    tid = _create_report_template(client, template_kind="excel")
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "RPT_ENGINE_INCOMPLETE_TEMPLATE"


def test_rpt_run_html_format(client):
    """T-RPT-R60-001-06: format=html 接受。"""
    tid = _create_report_template(client, template_kind=None)
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "html"},
    )
    assert resp.status_code == 200
    assert resp.json()["renderSpec"]["format"] == "html"


def test_rpt_run_probe_under_50ms(client):
    """T-RPT-R60-001-07: run probe elapsed_ms < 50。"""
    tid = _create_report_template(client, template_kind=None)
    start = time.perf_counter()
    resp = client.post(
        f"/api/v1/reports/templates/{tid}/run",
        headers=AUTH,
        json={"format": "web"},
    )
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert resp.status_code == 200
    assert elapsed_ms < 50


def test_view_role_defaults_put_get(client):
    """T-VIEW-R60-002-01: admin PUT + GET 往返。"""
    dash_id = _create_dashboard(client)
    tpl_id = _create_report_template(client, template_kind=None)
    role_id = "admin"
    put = client.put(
        f"/api/v1/roles/{role_id}/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "reportTemplateNodeId": tpl_id, "maxWidgetCount": 12},
    )
    assert put.status_code == 200
    get = client.get(f"/api/v1/roles/{role_id}/default-views", headers=AUTH)
    assert get.status_code == 200
    body = get.json()
    assert body["dashboardId"] == dash_id
    assert body["reportTemplateNodeId"] == tpl_id
    assert body["maxWidgetCount"] == 12


def test_view_role_defaults_forbidden(client, viewer_user):
    """T-VIEW-R60-002-02: viewer PUT → 403 VIEW_DEFAULT_FORBIDDEN。"""
    resp = client.put(
        "/api/v1/roles/viewer/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4())},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "VIEW_DEFAULT_FORBIDDEN"


def test_view_role_defaults_empty_422(client):
    """T-VIEW-R60-002-03: 双 null → 422 VIEW_DEFAULT_EMPTY。"""
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": None, "reportTemplateNodeId": None},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_EMPTY"


def test_view_role_defaults_dashboard_not_found(client):
    """T-VIEW-R60-002-04: 未知 dashboard → 404 VIEW_DEFAULT_DASHBOARD_NOT_FOUND。"""
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_DEFAULT_DASHBOARD_NOT_FOUND"


def test_view_role_defaults_report_not_found(client):
    """T-VIEW-R60-002-05: 未知 report template → 404 VIEW_DEFAULT_REPORT_NOT_FOUND。"""
    dash_id = _create_dashboard(client)
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "reportTemplateNodeId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_DEFAULT_REPORT_NOT_FOUND"


def test_view_resolve_defaults_for_roles():
    """T-VIEW-R60-002-06: resolve_defaults_for_roles 取首个命中角色。"""
    from app.views import store
    from app.views.role_template import resolve_defaults_for_roles

    store.clear_role_defaults()
    store.set_role_defaults("role_a", {"dashboardId": "d-a", "maxWidgetCount": 8})
    store.set_role_defaults("role_b", {"dashboardId": "d-b", "maxWidgetCount": 16})
    resolved = resolve_defaults_for_roles(["role_b", "role_a"])
    assert resolved["dashboardId"] == "d-b"
    assert resolved["maxWidgetCount"] == 16


def test_user_views_post_list(client):
    """T-VIEW-R60-003-01: POST me/views + GET list 含新建项。"""
    dash_id = _create_dashboard(client)
    client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "maxWidgetCount": 24},
    )
    layout = _valid_user_layout(2)
    layout["widgetCount"] = 2
    post = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "My View", "dashboardId": dash_id, "layout": layout},
    )
    assert post.status_code == 201
    lst = client.get("/api/v1/users/me/views", headers=AUTH)
    assert lst.status_code == 200
    names = [v["name"] for v in lst.json()["items"]]
    assert "My View" in names


def test_user_views_out_of_bounds(client):
    """T-VIEW-R60-003-02: widgetCount 超 maxWidgetCount → 422 VIEW_OVERRIDE_OUT_OF_BOUNDS。"""
    dash_id = _create_dashboard(client)
    client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "maxWidgetCount": 2},
    )
    layout = _valid_user_layout(5)
    layout["widgetCount"] = 5
    resp = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "Too Many", "dashboardId": dash_id, "layout": layout},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_OVERRIDE_OUT_OF_BOUNDS"


def test_user_views_classification_denied(client):
    """T-VIEW-R60-003-03: 非法 classificationScope → 422 VIEW_OVERRIDE_CLASSIFICATION_DENIED。"""
    dash_id = _create_dashboard(client)
    layout = _valid_user_layout(1)
    layout["widgetCount"] = 1
    resp = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={
            "name": "Bad Scope",
            "dashboardId": dash_id,
            "layout": layout,
            "classificationScope": "CAT-99",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_OVERRIDE_CLASSIFICATION_DENIED"


def test_user_views_conflict_409(client):
    """T-VIEW-R60-003-04: 重复 name → 409 VIEW_OVERRIDE_CONFLICT。"""
    dash_id = _create_dashboard(client)
    layout = _valid_user_layout(1)
    layout["widgetCount"] = 1
    payload = {"name": "Dup", "dashboardId": dash_id, "layout": layout}
    first = client.post("/api/v1/users/me/views", headers=AUTH, json=payload)
    assert first.status_code == 201
    second = client.post("/api/v1/users/me/views", headers=AUTH, json=payload)
    assert second.status_code == 409
    assert second.json()["code"] == "VIEW_OVERRIDE_CONFLICT"


def test_user_views_validate_route_unchanged_r31(client):
    """T-VIEW-R60-003-05: VIEW-001 validate 语义不变（r31 子集）。"""
    layout = _valid_user_layout(1)
    resp = client.post(
        "/api/v1/views/validate",
        headers=AUTH,
        json={"name": "Ok", "layout": layout},
    )
    assert resp.status_code == 200


def test_user_views_chart_ref_cycle(client):
    """T-VIEW-R60-003-06: 非法 layout cycle 映射 ViewError。"""
    dash_id = _create_dashboard(client)
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    bad_layout = {
        "version": 1,
        "widgetCount": 2,
        "widgets": [
            {"id": id_a, "type": "chart", "title": "A", "colSpan": 12, "order": 0, "chartRef": id_b},
            {"id": id_b, "type": "chart", "title": "B", "colSpan": 12, "order": 1, "chartRef": id_a},
        ],
        "globalFilters": [],
    }
    resp = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "Cycle", "dashboardId": dash_id, "layout": bad_layout},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_CHART_REF_CYCLE"


def test_cat07_behavior_ok(client):
    """T-CAT-R60-007-01: 合法 workno → 200 + auditLinked=true。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "EMP1001"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["workno"] == "EMP1001"
    assert body["auditLinked"] is True
    assert len(body["behaviors"]) >= 3
    assert body["total"] >= 3


def test_cat07_workno_not_found(client):
    """T-CAT-R60-007-02: 未知 workno → 404 CAT07_WORKNO_NOT_FOUND。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "UNKNOWN99"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT07_WORKNO_NOT_FOUND"


def test_cat07_workno_required(client):
    """T-CAT-R60-007-03: 缺 workno → 422 CAT07_WORKNO_REQUIRED。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT07_WORKNO_REQUIRED"


def test_cat07_workno_invalid(client):
    """T-CAT-R60-007-04: 非法格式 → 422 CAT07_WORKNO_INVALID。"""
    resp = client.get("/api/v1/workno/behavior", headers=AUTH, params={"workno": "bad!"})
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT07_WORKNO_INVALID"


def test_cat07_date_range_invalid(client):
    """T-CAT-R60-007-05: fromDate > toDate → 422 CAT07_DATE_RANGE_INVALID。"""
    resp = client.get(
        "/api/v1/workno/behavior",
        headers=AUTH,
        params={"workno": "EMP1001", "fromDate": "2026-07-04", "toDate": "2026-07-01"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT07_DATE_RANGE_INVALID"


def test_cat07_limit_exceeded(client):
    """T-CAT-R60-007-06: limit>200 → 422 CAT07_LIMIT_EXCEEDED。"""
    resp = client.get(
        "/api/v1/workno/behavior",
        headers=AUTH,
        params={"workno": "EMP1001", "limit": 201},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT07_LIMIT_EXCEEDED"


def test_cat07_pagination(client):
    """T-CAT-R60-007-07: offset/limit 分页 smoke。"""
    resp = client.get(
        "/api/v1/workno/behavior",
        headers=AUTH,
        params={"workno": "EMP1001", "limit": 2, "offset": 1},
    )
    assert resp.status_code == 200
    assert len(resp.json()["behaviors"]) <= 2


def test_gov_auto_register_ok(client, integration_user):
    """T-GOV-R60-007-01: integration 角色 published entry → 201 autoRegistered。"""
    eid = _create_published_entry(client, path=f"/api/v1/r60/auto-{uuid.uuid4().hex[:6]}")
    resp = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body["autoRegistered"] is True
    assert body["busId"]
    assert body["fsmState"] == "succeeded"


def test_gov_auto_register_draft_400(client, integration_user):
    """T-GOV-R60-007-02: draft entry → 400 GOV_AUTO_BUS_NOT_PUBLISHABLE。"""
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Draft",
            "httpMethod": "GET",
            "path": f"/api/v1/r60/draft-{uuid.uuid4().hex[:6]}",
            "categoryCodes": ["CAT-01"],
            "status": "draft",
        },
    )
    eid = resp.json()["id"]
    reg = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert reg.status_code == 400
    assert reg.json()["code"] == "GOV_AUTO_BUS_NOT_PUBLISHABLE"


def test_gov_auto_register_forbidden(client, viewer_user):
    """T-GOV-R60-007-03: viewer → 403 GOV_AUTO_BUS_FORBIDDEN。"""
    eid = _create_published_entry(client, path=f"/api/v1/r60/forbidden-{uuid.uuid4().hex[:6]}")
    resp = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 403
    assert resp.json()["code"] == "GOV_AUTO_BUS_FORBIDDEN"


def test_gov_auto_register_idempotent(client, integration_user):
    """T-GOV-R60-007-04: 重复 auto-register → 200 幂等 busId。"""
    eid = _create_published_entry(client, path=f"/api/v1/r60/idem-{uuid.uuid4().hex[:6]}")
    first = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    second = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert first.status_code in (200, 201)
    assert second.status_code == 200
    assert first.json()["busId"] == second.json()["busId"]


def test_gov_semi_auto_admin_guard_unchanged_r31(client):
    """T-GOV-R60-007-05: GOV-002 semi-auto 仍要求 admin（r31 守卫不变）。"""
    eid = _create_published_entry(client, path=f"/api/v1/r60/semi-{uuid.uuid4().hex[:6]}")
    async def _viewer():
        return UserContext(id="v", username="v", roles=["viewer"])
    from app.main import app as fastapi_app
    from app.auth.deps import get_current_user
    fastapi_app.dependency_overrides[get_current_user] = _viewer
    try:
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


def test_gov_auto_register_fsm_failed_path(client, integration_user):
    """T-GOV-R60-007-06: force-fail entry → 502 + fsmState failed。"""
    eid = _create_published_entry(client, path="/api/v1/force-fail/r60")
    resp = client.post("/api/v1/gov/bus/auto-register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 502
    body = resp.json()
    assert body["code"] == "BUS_REGISTRATION_REJECTED"
    from app.governance.bus.auto import get_fsm_state
    assert get_fsm_state(uuid.UUID(eid)) == "failed"
