"""跨域远期薄弱项 L1 kickoff r61 — CAT/DASH/VIZ/NFR."""
from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import UserContext, get_current_user
from app.core.config import get_settings
from app.main import app as fastapi_app

_R61_SQLITE_URL = "sqlite+pysqlite:///file:cat_dash_viz_nfr_r61?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def r61_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R61_SQLITE_URL
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
def viewer_user() -> Generator[None, None, None]:
    async def _override() -> UserContext:
        return UserContext(id="viewer-r61", username="viewer", roles=["viewer"])

    fastapi_app.dependency_overrides[get_current_user] = _override
    yield
    fastapi_app.dependency_overrides.pop(get_current_user, None)


_R61_WIDGET_ID = "11111111-1111-4111-8111-111111111111"


def _create_dashboard_with_widget(client: TestClient, widget_id: str = _R61_WIDGET_ID) -> str:
    create = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"R61-{uuid.uuid4().hex[:6]}", "description": "r61 fixture"},
    )
    assert create.status_code == 201, create.text
    dash_id = create.json()["id"]
    layout = client.put(
        f"/api/v1/dashboards/{dash_id}/layout",
        headers=AUTH,
        json={
            "layoutJson": {
                "version": 1,
                "widgets": [
                    {
                        "id": widget_id,
                        "type": "chart",
                        "title": "R61 Widget",
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
        },
    )
    assert layout.status_code == 200, layout.text
    return dash_id


def _ticket_payload(key: str = "TICKET_OPS") -> dict:
    return {
        "ticketCategoryKey": key,
        "displayName": "Ops Tickets",
        "statusFilters": ["open", "pending"],
        "tableRef": "stub.tickets",
        "allowedRoles": ["analyst"],
    }


from app.query.config_store.schemas import ALLOWED_CONFIG_TYPES
from jwt_auth import AUTH, jwt_auth_headers


def test_r61_fixture_bootstraps(client):
    """T-R61-000-01: r61 sqlite 环境 health 可达。"""
    resp = client.get("/health")
    assert resp.status_code == 200


def test_r61_config_types_include_global_filter_linkage():
    """T-R61-000-02: config_store 允许 global_filter_linkage。"""
    assert "global_filter_linkage" in ALLOWED_CONFIG_TYPES


def test_cat_r61_005_validate_ok(client):
    """T-CAT-R61-005-01: POST /tickets/validate 合法 200 valid=true。"""
    resp = client.post("/api/v1/gov/catalog/tickets/validate", headers=AUTH, json=_ticket_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["categoryKey"] == "TICKET_OPS"
    assert body["statusCount"] == 2


def test_cat_r61_005_validate_empty_status_filters(client):
    """T-CAT-R61-005-02: 空 statusFilters 422 CAT05_EMPTY_STATUS_FILTERS。"""
    payload = _ticket_payload()
    payload["statusFilters"] = []
    resp = client.post("/api/v1/gov/catalog/tickets/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT05_EMPTY_STATUS_FILTERS"


def test_cat_r61_005_create_and_list(client):
    """T-CAT-R61-005-03: POST items 201 + GET 列表含该项。"""
    key = f"T_{uuid.uuid4().hex[:6].upper()}"
    payload = _ticket_payload(key)
    create = client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=payload)
    assert create.status_code == 201, create.text
    listed = client.get("/api/v1/gov/catalog/tickets/items", headers=AUTH)
    assert listed.status_code == 200
    keys = [i["ticketCategoryKey"] for i in listed.json()["items"]]
    assert key in keys


def test_cat_r61_005_create_conflict(client):
    """T-CAT-R61-005-04: 重复 key 409 CAT05_KEY_CONFLICT。"""
    key = f"DUP_{uuid.uuid4().hex[:4].upper()}"
    payload = _ticket_payload(key)
    assert client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=payload).status_code == 201
    dup = client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=payload)
    assert dup.status_code == 409
    assert dup.json()["code"] == "CAT05_KEY_CONFLICT"


def test_cat_r61_005_stats_probe(client):
    """T-CAT-R61-005-05: GET stats mock counts 200。"""
    key = f"ST_{uuid.uuid4().hex[:4].upper()}"
    client.post("/api/v1/gov/catalog/tickets/items", headers=AUTH, json=_ticket_payload(key))
    resp = client.get(f"/api/v1/gov/catalog/tickets/items/{key}/stats", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) >= {"open", "closed", "pending", "sampledAt"}
    assert isinstance(body["open"], int)


def test_cat_r61_005_stats_not_found(client):
    """T-CAT-R61-005-06: 未知 key 404 CAT05_NOT_FOUND。"""
    resp = client.get("/api/v1/gov/catalog/tickets/items/MISSING_KEY/stats", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT05_NOT_FOUND"


def _filter_linkage_payload(dashboard_id: str, widget_id: str = _R61_WIDGET_ID) -> dict:
    return {
        "dashboardId": dashboard_id,
        "filters": [{"filterId": "f1", "dimensionRef": "region", "defaultValue": "CN"}],
        "linkageRules": [{"sourceFilterId": "f1", "targetWidgetIds": [widget_id], "parameterKey": "region"}],
        "refreshMode": "eager",
    }


def test_dash_r61_004_validate_ok(client):
    """T-DASH-R61-004-01: validate 合法 dashboard 200。"""
    dash_id = _create_dashboard_with_widget(client)
    resp = client.post(
        "/api/v1/dashboards/global-filters/validate",
        headers=AUTH,
        json=_filter_linkage_payload(dash_id),
    )
    assert resp.status_code == 200
    assert resp.json()["dashboardId"] == dash_id


def test_dash_r61_004_validate_empty_filters(client):
    """T-DASH-R61-004-02: 空 filters 422 DASH_FILTER_EMPTY_FILTERS。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id)
    payload["filters"] = []
    resp = client.post("/api/v1/dashboards/global-filters/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_FILTER_EMPTY_FILTERS"


def test_dash_r61_004_validate_dashboard_not_found(client):
    """T-DASH-R61-004-03: 未知 dashboard 404 DASH_FILTER_DASHBOARD_NOT_FOUND。"""
    missing = str(uuid.uuid4())
    resp = client.post(
        "/api/v1/dashboards/global-filters/validate",
        headers=AUTH,
        json=_filter_linkage_payload(missing),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "DASH_FILTER_DASHBOARD_NOT_FOUND"


def test_dash_r61_004_save_and_get_roundtrip(client):
    """T-DASH-R61-004-04: PUT save + GET 往返含 affectedWidgetCount。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id)
    save = client.put(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH, json=payload)
    assert save.status_code == 200, save.text
    got = client.get(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH)
    assert got.status_code == 200
    body = got.json()
    assert body["affectedWidgetCount"] == 1
    assert body["filters"][0]["filterId"] == "f1"


def test_dash_r61_004_forbidden_viewer(client, viewer_user):
    """T-DASH-R61-004-05: 非 owner viewer 403 DASH_FILTER_FORBIDDEN。"""
    dash_id = _create_dashboard_with_widget(client)
    resp = client.get(f"/api/v1/dashboards/{dash_id}/global-filters", headers=AUTH)
    assert resp.status_code == 403
    assert resp.json()["code"] == "DASH_FILTER_FORBIDDEN"


def test_dash_r61_004_widget_not_found(client):
    """T-DASH-R61-004-06: 未知 widget 422 DASH_FILTER_WIDGET_NOT_FOUND。"""
    dash_id = _create_dashboard_with_widget(client)
    payload = _filter_linkage_payload(dash_id, widget_id="missing-widget")
    resp = client.post("/api/v1/dashboards/global-filters/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_FILTER_WIDGET_NOT_FOUND"


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


def test_viz_r61_007_validate_ok(client):
    """T-VIZ-R61-007-01: POST /charts/sdk/validate 合法 200。"""
    resp = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=_sdk_init_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["appId"] == "portal-demo"


def test_viz_r61_007_validate_invalid_origin(client):
    """T-VIZ-R61-007-02: 非法 origin 422 VIZ_SDK_INVALID_ORIGIN。"""
    payload = _sdk_init_payload()
    payload["allowedOrigins"] = ["not-a-url"]
    resp = client.post("/api/v1/charts/sdk/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIZ_SDK_INVALID_ORIGIN"


def test_viz_r61_007_lifecycle_init(client):
    """T-VIZ-R61-007-03: lifecycle init manifest。"""
    resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "init"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["phase"] == "init"
    assert body["ready"] is True
    assert body["sdkVersion"] == "0.1.0-l1"


def test_viz_r61_007_lifecycle_destroy(client):
    """T-VIZ-R61-007-04: lifecycle destroy manifest。"""
    resp = client.post("/api/v1/charts/sdk/lifecycle", headers=AUTH, json={"phase": "destroy"})
    assert resp.status_code == 200
    assert resp.json()["phase"] == "destroy"


def test_viz_r61_007_capabilities(client):
    """T-VIZ-R61-007-05: GET capabilities 列表非空。"""
    resp = client.get("/api/v1/charts/sdk/capabilities", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert "chart" in body["targetTypes"]
    assert "token" in body["authModes"]


def test_viz_r61_007_embed_validate_unchanged(client):
    """T-VIZ-R61-007-06: POST /charts/embed/validate 语义未改。"""
    resp = client.post(
        "/api/v1/charts/embed/validate",
        headers=AUTH,
        json={"chartId": str(uuid.uuid4()), "allowedOrigins": ["https://a.example.com"]},
    )
    assert resp.status_code == 200
    assert "chartId" in resp.json()


def _perf_probe_payload(report_id: str | None = None) -> dict:
    return {
        "reportId": report_id or str(uuid.uuid4()),
        "sampleQueryId": "q-sample",
        "budgetMs": 10000,
        "sampleRows": 100,
    }


def test_nfr_r61_002_probe_ok(client):
    """T-NFR-R61-002-01: POST probe mock withinBudget=true。"""
    resp = client.post("/api/v1/nfr/report-query-perf/probe", headers=AUTH, json=_perf_probe_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["withinBudget"] is True
    assert body["samplePassed"] is True
    assert body["elapsedMs"] == 120


def test_nfr_r61_002_validate_ok(client):
    """T-NFR-R61-002-02: POST validate 仅校验不执行。"""
    resp = client.post("/api/v1/nfr/report-query-perf/validate", headers=AUTH, json=_perf_probe_payload())
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


def test_nfr_r61_002_report_required(client):
    """T-NFR-R61-002-03: 缺 reportId 422 REPORT_PERF_REPORT_REQUIRED。"""
    payload = _perf_probe_payload()
    payload["reportId"] = ""
    resp = client.post("/api/v1/nfr/report-query-perf/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_PERF_REPORT_REQUIRED"


def test_nfr_r61_002_budget_out_of_range(client):
    """T-NFR-R61-002-04: budgetMs 超范围 422 REPORT_PERF_BUDGET_OUT_OF_RANGE。"""
    payload = _perf_probe_payload()
    payload["budgetMs"] = 500
    resp = client.post("/api/v1/nfr/report-query-perf/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_PERF_BUDGET_OUT_OF_RANGE"


def test_nfr_r61_002_sample_out_of_range(client):
    """T-NFR-R61-002-05: sampleRows 超范围 422 REPORT_PERF_SAMPLE_OUT_OF_RANGE。"""
    payload = _perf_probe_payload()
    payload["sampleRows"] = 2000
    resp = client.post("/api/v1/nfr/report-query-perf/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "REPORT_PERF_SAMPLE_OUT_OF_RANGE"


def test_nfr_r61_002_probe_elapsed_under_50ms(client):
    """T-NFR-R61-002-06: probe 单测 elapsed 守卫 <50ms（同进程 mock）。"""
    import time
    start = time.perf_counter()
    resp = client.post("/api/v1/nfr/report-query-perf/probe", headers=AUTH, json=_perf_probe_payload())
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert resp.status_code == 200
    assert elapsed_ms < 50


def _geo_node_payload(code: str = "CN-SH", parent_id: str | None = None) -> dict:
    payload = {"regionCode": code, "name": f"Region {code}", "level": "province", "sortOrder": 0}
    if parent_id:
        payload["parentId"] = parent_id
    return payload


def test_cat_r61_003_create_root_and_child(client):
    """T-CAT-R61-003-01: 创建根节点 + 子节点。"""
    root = client.post("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH, json=_geo_node_payload("CN"))
    assert root.status_code == 201, root.text
    root_id = root.json()["regionId"]
    child = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-SH", parent_id=root_id),
    )
    assert child.status_code == 201
    assert child.json()["parentId"] == root_id


def test_cat_r61_003_move_cycle(client):
    """T-CAT-R61-003-02: move 成环 422 CAT03_CYCLE。"""
    a = client.post("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH, json=_geo_node_payload("CN-A")).json()
    b = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-B", parent_id=a["regionId"]),
    ).json()
    resp = client.post(
        f"/api/v1/gov/catalog/geo-regions/nodes/{a['regionId']}/move",
        headers=AUTH,
        json={"parentId": b["regionId"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "CAT03_CYCLE"


def test_cat_r61_003_parent_not_found(client):
    """T-CAT-R61-003-03: 未知 parent 404 CAT03_PARENT_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-X", parent_id=str(uuid.uuid4())),
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CAT03_PARENT_NOT_FOUND"


def test_cat_r61_003_max_depth(client):
    """T-CAT-R61-003-04: 超深 422 CAT03_MAX_DEPTH。"""
    parent_id = None
    for i in range(7):
        code = f"CN-L{i}"
        resp = client.post(
            "/api/v1/gov/catalog/geo-regions/nodes",
            headers=AUTH,
            json=_geo_node_payload(code, parent_id=parent_id),
        )
        if resp.status_code != 201:
            assert resp.status_code == 422
            assert resp.json()["code"] == "CAT03_MAX_DEPTH"
            return
        parent_id = resp.json()["regionId"]
    pytest.fail("expected CAT03_MAX_DEPTH before 7 successful creates")


def test_cat_r61_003_code_conflict(client):
    """T-CAT-R61-003-05: 重复 regionCode 409 CAT03_CODE_CONFLICT。"""
    code = f"CN-{uuid.uuid4().hex[:4].upper()}"
    assert client.post("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH, json=_geo_node_payload(code)).status_code == 201
    dup = client.post("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH, json=_geo_node_payload(code))
    assert dup.status_code == 409
    assert dup.json()["code"] == "CAT03_CODE_CONFLICT"


def test_cat_r61_003_delete_has_children(client):
    """T-CAT-R61-003-06: 删除含子节点 409 CAT03_HAS_CHILDREN。"""
    root = client.post("/api/v1/gov/catalog/geo-regions/nodes", headers=AUTH, json=_geo_node_payload("CN-DEL")).json()
    client.post(
        "/api/v1/gov/catalog/geo-regions/nodes",
        headers=AUTH,
        json=_geo_node_payload("CN-DEL-C", parent_id=root["regionId"]),
    )
    resp = client.delete(f"/api/v1/gov/catalog/geo-regions/nodes/{root['regionId']}", headers=AUTH)
    assert resp.status_code == 409
    assert resp.json()["code"] == "CAT03_HAS_CHILDREN"
