"""跨域 companion 质量推分 r63 — VIZ/VIEW/DESIGN/CAT."""
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

_R63_SQLITE_URL = "sqlite+pysqlite:///file:viz_view_design_cat_r63?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r63_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R63_SQLITE_URL
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
        return UserContext(id="viewer-r63", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def enterprise_user() -> Generator[None, None, None]:
    from app.governance.catalog.cat05 import service as cat05_service

    async def _override() -> UserContext:
        return UserContext(id="enterprise-r63", username="enterprise", roles=["enterprise"])

    cat05_service.set_user_ticket_scope("enterprise-r63", "TICKET_DEFAULT")
    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


def _create_dashboard(client: TestClient, name: str = "R63 Dash") -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"{name}-{uuid.uuid4().hex[:6]}", "description": "r63 fixture"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _sdk_init_payload(target_id: str | None = None) -> dict:
    return {
        "appId": "portal-demo",
        "targetType": "chart",
        "targetId": target_id or str(uuid.uuid4()),
        "authMode": "token",
        "embedToken": "tok-demo",
        "allowedOrigins": ["https://portal.example.com"],
        "lifecycleHooks": {"onInit": True, "onDestroy": True},
    }


def _ticket_payload(key: str = "TICKET_OPS") -> dict:
    return {
        "ticketCategoryKey": key,
        "displayName": "Ops Tickets",
        "statusFilters": ["open", "pending"],
        "tableRef": "stub.tickets",
        "allowedRoles": ["analyst"],
    }


def _create_workflow_instance(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/gov/workflow/instances",
        headers=AUTH,
        json={"templateId": "standard_query_release", "refId": str(uuid.uuid4())},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _publish_workflow_instance(client: TestClient, instance_id: str) -> None:
    for action, role in [
        ("submit", "requester"),
        ("approve", "approver"),
        ("complete_design", "designer"),
        ("publish", "publisher"),
    ]:
        r = client.post(
            f"/api/v1/gov/workflow/instances/{instance_id}/transition",
            headers=AUTH,
            json={"action": action, "actorRole": role},
        )
        assert r.status_code == 200, r.text


def test_r63_fixture_bootstraps(client):
    """T-R63-000-01: r63 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


# --- VIZ-007 ---


def test_viz_r63_007_probe_validate_under_budget():
    """T-VIZ-R63-007-01: probe_validate_sdk_budget_ms < 50ms。"""
    from app.viz.sdk_portal.probe import probe_validate_sdk_budget_ms
    from app.viz.sdk_portal.schemas import SdkPortalInitIn

    payload = SdkPortalInitIn.model_validate(_sdk_init_payload())
    result = probe_validate_sdk_budget_ms(payload)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_viz_r63_007_probe_lifecycle_under_budget():
    """T-VIZ-R63-007-02: probe_lifecycle_budget_ms init < 50ms。"""
    from app.auth.deps import UserContext
    from app.viz.sdk_portal.probe import probe_lifecycle_budget_ms

    actor = UserContext(id="admin", username="admin", roles=["admin"])
    result = probe_lifecycle_budget_ms("init", actor)
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_viz_r63_007_token_required_422(client):
    """T-VIZ-R63-007-03: auth_mode=token 无 embedToken → 422 VIZ_SDK_TOKEN_REQUIRED。"""
    payload = _sdk_init_payload()
    payload.pop("embedToken", None)
    resp = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIZ_SDK_TOKEN_REQUIRED"


def test_viz_r63_007_duplicate_origin_422(client):
    """T-VIZ-R63-007-04: duplicate allowedOrigins → 422 VIZ_SDK_DUPLICATE_ORIGIN。"""
    payload = _sdk_init_payload()
    payload["allowedOrigins"] = ["https://a.example.com", "https://a.example.com"]
    resp = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIZ_SDK_DUPLICATE_ORIGIN"


def test_viz_r63_007_lifecycle_destroy_forbidden_viewer(client, viewer_user):
    """T-VIZ-R63-007-05: viewer lifecycle destroy → 403 VIZ_SDK_FORBIDDEN。"""
    resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
    assert resp.status_code == 403
    assert resp.json()["code"] == "VIZ_SDK_FORBIDDEN"


def test_viz_r63_007_lifecycle_destroy_admin_ok(client):
    """T-VIZ-R63-007-06: admin lifecycle destroy 仍 200。"""
    resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
    assert resp.status_code == 200
    assert resp.json()["phase"] == "destroy"


def test_viz_r63_007_r61_regression_subset(client):
    """T-VIZ-R63-007-07: r61 validate/capabilities 子集回归。"""
    ok = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=_sdk_init_payload())
    assert ok.status_code == 200
    caps = client.get("/api/v1/charts/sdk/capabilities", headers=AUTH)
    assert caps.status_code == 200
    assert "chart" in caps.json()["targetTypes"]


def test_viz_r63_007_lifecycle_destroy_editor_ok(client):
    """T-VIZ-R63-007-08: editor lifecycle destroy 200。"""
    async def _override() -> UserContext:
        return UserContext(id="editor-r63", username="editor", roles=["editor"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    try:
        resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
        assert resp.status_code == 200
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user, None)


# --- VIEW-002 ---


def test_view_r63_002_max_widget_zero_422(client):
    """T-VIEW-R63-002-01: maxWidgetCount=0 → 422 VIEW_DEFAULT_OUT_OF_BOUNDS。"""
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4()), "maxWidgetCount": 0},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_OUT_OF_BOUNDS"


def test_view_r63_002_max_widget_65_422(client):
    """T-VIEW-R63-002-02: maxWidgetCount=65 → 422 VIEW_DEFAULT_OUT_OF_BOUNDS。"""
    resp = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4()), "maxWidgetCount": 65},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_DEFAULT_OUT_OF_BOUNDS"


def test_view_r63_002_probe_resolve_under_budget():
    """T-VIEW-R63-002-03: probe_resolve_defaults_budget_ms < 50ms。"""
    from app.views import store
    from app.views.probe import probe_resolve_defaults_budget_ms

    store.clear_role_defaults()
    store.set_role_defaults("admin", {"dashboardId": "d1", "maxWidgetCount": 12})
    result = probe_resolve_defaults_budget_ms(["admin", "viewer"])
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_view_r63_002_resolve_empty_roles_default():
    """T-VIEW-R63-002-04: resolve_defaults_for_roles([]) 空默认 maxWidgetCount=24。"""
    from app.views.role_template import resolve_defaults_for_roles

    resolved = resolve_defaults_for_roles([])
    assert resolved["dashboardId"] is None
    assert resolved["maxWidgetCount"] == 24


def test_view_r63_002_r60_regression_put_get(client):
    """T-VIEW-R63-002-05: r60 admin PUT+GET 子集仍绿。"""
    dash_id = _create_dashboard(client)
    put = client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "maxWidgetCount": 12},
    )
    assert put.status_code == 200
    get = client.get("/api/v1/roles/admin/default-views", headers=AUTH)
    assert get.status_code == 200
    assert get.json()["maxWidgetCount"] == 12


def test_view_r63_002_viewer_put_forbidden_regression(client, viewer_user):
    """T-VIEW-R63-002-06: viewer PUT 仍 403 VIEW_DEFAULT_FORBIDDEN（r60 回归）。"""
    resp = client.put(
        "/api/v1/roles/viewer/default-views",
        headers=AUTH,
        json={"dashboardId": str(uuid.uuid4()), "maxWidgetCount": 8},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "VIEW_DEFAULT_FORBIDDEN"


# --- DESIGN-004 ---


def test_design_r63_004_catalog_mismatch_422(client):
    """T-DESIGN-R63-004-01: designType=query + catalogEntryId → 422 DESIGN_WORKFLOW_CATALOG_MISMATCH。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={
            "designerItemId": str(uuid.uuid4()),
            "workflowInstanceId": wf_id,
            "designType": "query",
            "catalogEntryId": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DESIGN_WORKFLOW_CATALOG_MISMATCH"


def test_design_r63_004_probe_under_budget(client):
    """T-DESIGN-R63-004-02: probe_validate_workflow_link_budget_ms < 50ms。"""
    from app.auth.models import get_meta_session
    from app.designer.workflow import DesignerWorkflowLinkIn, probe_validate_workflow_link_budget_ms

    wf_id = _create_workflow_instance(client)
    link = DesignerWorkflowLinkIn.model_validate(
        {"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"}
    )
    session = get_meta_session()
    try:
        elapsed = probe_validate_workflow_link_budget_ms(session, link)
    finally:
        session.close()
    assert elapsed < 50


def test_design_r63_004_publish_ready_true_published_workflow(client):
    """T-DESIGN-R63-004-03: published workflow 无 catalog → publishReady=true。"""
    wf_id = _create_workflow_instance(client)
    _publish_workflow_instance(client, wf_id)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"},
    )
    assert resp.status_code == 200
    assert resp.json()["publishReady"] is True


def test_design_r63_004_r59_regression_draft_false(client):
    """T-DESIGN-R63-004-04: draft workflow publishReady=false（r59 回归）。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={"designerItemId": str(uuid.uuid4()), "workflowInstanceId": wf_id, "designType": "chart"},
    )
    assert resp.status_code == 200
    assert resp.json()["publishReady"] is False


def test_design_r63_004_chart_without_catalog_ok(client):
    """T-DESIGN-R63-004-05: chart designType 无 catalogEntryId validate 200。"""
    wf_id = _create_workflow_instance(client)
    resp = client.post(
        "/api/v1/designer/workflow-link/validate",
        headers=AUTH,
        json={
            "designerItemId": str(uuid.uuid4()),
            "workflowInstanceId": wf_id,
            "designType": "chart",
            "catalogEntryId": None,
        },
    )
    assert resp.status_code == 200


# --- CAT-005 ---


def test_cat_r63_005_enterprise_scope_forbidden(client, enterprise_user):
    """T-CAT-R63-005-01: enterprise scope 外 GET stats → 403 CAT05_FORBIDDEN。"""
    from app.auth.deps import UserContext
    from app.governance.catalog.cat05 import service as cat05_service
    from app.governance.catalog.cat05.schemas import TicketStatsItemIn

    admin = UserContext(id="seed-admin", username="seed", roles=["admin"])
    cat05_service.create_ticket_item(
        TicketStatsItemIn.model_validate(_ticket_payload("TICKET_OTHER")), admin
    )
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_DEFAULT"))
    resp = client.get("/api/v1/gov/catalog/tickets/items/TICKET_OTHER/stats", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT05_FORBIDDEN"


def test_cat_r63_005_viewer_create_forbidden(client, viewer_user):
    """T-CAT-R63-005-02: viewer POST items → 403 CAT05_FORBIDDEN。"""
    resp = client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_VIEWER"))
    assert resp.status_code == 403
    assert resp.json()["code"] == "CAT05_FORBIDDEN"


def test_cat_r63_005_probe_stats_under_budget(client):
    """T-CAT-R63-005-03: probe_ticket_stats_budget_ms < 50ms。"""
    from app.governance.catalog.cat05.service import probe_ticket_stats_budget_ms

    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_PROBE"))
    result = probe_ticket_stats_budget_ms("TICKET_PROBE")
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_cat_r63_005_viewer_stats_read_ok(client, viewer_user):
    """T-CAT-R63-005-04: viewer GET stats 只读 200。"""
    from app.auth.deps import UserContext
    from app.governance.catalog.cat05 import service as cat05_service
    from app.governance.catalog.cat05.schemas import TicketStatsItemIn

    admin = UserContext(id="seed-admin", username="seed", roles=["admin"])
    cat05_service.create_ticket_item(
        TicketStatsItemIn.model_validate(_ticket_payload("TICKET_READ")), admin
    )
    resp = client.get("/api/v1/gov/catalog/tickets/items/TICKET_READ/stats", headers=AUTH)
    assert resp.status_code == 200
    assert "open" in resp.json()


def test_cat_r63_005_r61_regression_validate(client):
    """T-CAT-R63-005-05: r61 validate 子集仍绿。"""
    resp = client.post("/api/v1/gov/catalog/tickets/validate", headers=AUTH, json=_ticket_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_cat_r63_005_enterprise_scope_in_ok(client, enterprise_user):
    """T-CAT-R63-005-06: enterprise scope 内 GET stats 200。"""
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload("TICKET_DEFAULT"))
    resp = client.get("/api/v1/gov/catalog/tickets/items/TICKET_DEFAULT/stats", headers=AUTH)
    assert resp.status_code == 200


# --- VIEW-003 ---


def _valid_user_layout(widget_count: int = 1) -> dict:
    widgets = []
    for i in range(widget_count):
        widgets.append(
            {
                "id": str(uuid.uuid4()),
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
    return {"version": 1, "widgetCount": widget_count, "widgets": widgets, "globalFilters": []}


def test_view_r63_003_get_unknown_404(client):
    """T-VIEW-R63-003-01: GET /me/views/{unknown} → 404 VIEW_OVERRIDE_NOT_FOUND。"""
    resp = client.get(f"/api/v1/users/me/views/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_OVERRIDE_NOT_FOUND"


def test_view_r63_003_dashboard_not_found_404(client):
    """T-VIEW-R63-003-02: POST 未知 dashboardId → 404 VIEW_OVERRIDE_DASHBOARD_NOT_FOUND。"""
    layout = _valid_user_layout(1)
    resp = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "No Dash", "dashboardId": str(uuid.uuid4()), "layout": layout},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "VIEW_OVERRIDE_DASHBOARD_NOT_FOUND"


def test_view_r63_003_chart_ref_cycle_422(client):
    """T-VIEW-R63-003-03: chartRef cycle → 422 VIEW_CHART_REF_CYCLE。"""
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


def test_view_r63_003_probe_create_under_budget(client):
    """T-VIEW-R63-003-04: probe_create_override_budget_ms < 50ms。"""
    from app.auth.deps import UserContext
    from app.auth.models import get_meta_session
    from app.views.probe import probe_create_override_budget_ms

    dash_id = _create_dashboard(client)
    actor = UserContext(id="admin", username="admin", roles=["admin"])
    payload = {"name": f"Probe-{uuid.uuid4().hex[:6]}", "dashboardId": dash_id, "layout": _valid_user_layout(1)}
    session = get_meta_session()
    try:
        result = probe_create_override_budget_ms(session, actor, payload)
    finally:
        session.close()
    assert result.ok is True
    assert result.elapsed_ms < 50


def test_view_r63_003_get_after_create_200(client):
    """T-VIEW-R63-003-05: POST 后 GET by id 200。"""
    dash_id = _create_dashboard(client)
    layout = _valid_user_layout(1)
    created = client.post(
        "/api/v1/users/me/views",
        headers=AUTH,
        json={"name": "Owned", "dashboardId": dash_id, "layout": layout},
    )
    assert created.status_code == 201
    view_id = created.json()["id"]
    got = client.get(f"/api/v1/users/me/views/{view_id}", headers=AUTH)
    assert got.status_code == 200
    assert got.json()["name"] == "Owned"


def test_view_r63_003_list_regression(client):
    """T-VIEW-R63-003-06: GET list 仍 200（r60 回归）。"""
    resp = client.get("/api/v1/users/me/views", headers=AUTH)
    assert resp.status_code == 200
    assert "items" in resp.json()
