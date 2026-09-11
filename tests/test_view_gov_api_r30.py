"""M5 VIEW-001 + M6 GOV/API companion r30 — VIEW-001/GOV-001/GOV-002/API-001/API-002."""
from __future__ import annotations

import os
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view
from app.main import app
from jwt_auth import AUTH, jwt_auth_headers

_R30_SQLITE_URL = "sqlite+pysqlite:///file:view_gov_r30?mode=memory&cache=shared&uri=true"


def _valid_layout(widget_id: str | None = None) -> dict:
    wid = widget_id or str(uuid.uuid4())
    return {
        "version": 1,
        "widgets": [
            {
                "id": wid,
                "type": "chart",
                "title": "KPI",
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


def test_view_valid_layout_and_name():
    """T-VIEW-R30-001-01: 合法 layout + name → validate_dashboard_view 成功。"""
    view = validate_dashboard_view({"name": "Main", "layout": _valid_layout()})
    assert view.name == "Main"
    assert view.layout.version == 1


def test_view_empty_widgets_allowed():
    """T-VIEW-R30-001-02: layout.widgets=[] → 200。"""
    view = validate_dashboard_view(
        {"name": "Empty", "layout": {"version": 1, "widgets": [], "globalFilters": []}}
    )
    assert view.layout.widgets == []


def test_view_invalid_chart_type():
    """T-VIEW-R30-001-03: 非法 chartType → 422。"""
    layout = _valid_layout()
    layout["widgets"][0]["chartConfig"]["chartType"] = "radar"
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Bad", "layout": layout})
    assert exc.value.status == 422


def test_view_unknown_chart_ref_via_chart_id():
    """T-VIEW-R30-001-04: chartConfig.chartId 指向不存在 widget → VIEW_UNKNOWN_CHART_REF。"""
    other = str(uuid.uuid4())
    layout = _valid_layout()
    layout["widgets"][0]["chartConfig"]["chartId"] = other
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Ref", "layout": layout})
    assert exc.value.code == "VIEW_UNKNOWN_CHART_REF"


@pytest.fixture(scope="module", autouse=True)
def r30_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R30_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    import app.dashboard.models  # noqa: F401 — register ORM tables
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    yield
    if previous is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = previous
    get_settings.cache_clear()
    get_meta_engine.cache_clear()
    auth_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    from app.datasources.models import get_meta_session
    from sqlalchemy import text

    session = get_meta_session()
    try:
        yield session
        session.rollback()
        session.execute(text("DELETE FROM dashboards"))
        session.commit()
    finally:
        session.close()


def test_view_default_view_self_ref():
    """T-VIEW-R30-001-05: defaultViewId == id → VIEW_DEFAULT_SELF_REF。"""
    vid = uuid.uuid4()
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(
            {"id": str(vid), "name": "Self", "defaultViewId": str(vid), "layout": _valid_layout()}
        )
    assert exc.value.code == "VIEW_DEFAULT_SELF_REF"


def test_views_validate_api_invalid(client):
    """T-VIEW-R30-001-06: POST /views/validate 非法 → 422 结构化 body。"""
    resp = client.post(
        "/api/v1/views/validate",
        headers=AUTH,
        json={
            "name": "Bad",
            "layout": {
                "version": 1,
                "widgets": [{"id": str(uuid.uuid4()), "type": "chart", "title": "X", "colSpan": 12}],
            },
        },
    )
    assert resp.status_code == 422
    body = resp.json()
    assert "code" in body and "message" in body


def test_dashboard_layout_put_regression(client, db_session):
    """T-VIEW-R30-001-07/08: PUT layout 合法 200；重复 widget → DASH_DUPLICATE_WIDGET。"""
    from app.dashboard.service import create_dashboard, update_layout

    dash = create_dashboard(db_session, name="R30 Dash")
    layout = _valid_layout()
    out = update_layout(db_session, dash.id, layout)
    assert out.layout_json["widgets"]
    dup = layout.copy()
    dup["widgets"] = [layout["widgets"][0], layout["widgets"][0]]
    resp = client.put(
        f"/api/v1/dashboards/{dash.id}/layout",
        headers=AUTH,
        json={"layoutJson": dup},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_DUPLICATE_WIDGET"


def test_gov_categories_seven(client):
    """T-GOV-R30-001-01: GET categories → 恰好 7 条 CAT-01~07。"""
    resp = client.get("/api/v1/gov/catalog/categories", headers=AUTH)
    assert resp.status_code == 200
    codes = {item["code"] for item in resp.json()["items"]}
    assert codes == {f"CAT-{i:02d}" for i in range(1, 8)}


def test_gov_create_entry_ok(client):
    """T-GOV-R30-001-02: POST entry categoryCodes CAT-02 → 201。"""
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Aggregate stats",
            "httpMethod": "GET",
            "path": "/api/v1/stats/aggregate",
            "categoryCodes": ["CAT-02"],
            "status": "active",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["categoryCodes"] == ["CAT-02"]


def test_gov_create_entry_invalid_category(client):
    """T-GOV-R30-001-03: categoryCodes CAT-99 → 400 CATALOG_INVALID_CATEGORY。"""
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={"name": "Bad", "httpMethod": "GET", "path": "/x", "categoryCodes": ["CAT-99"]},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "CATALOG_INVALID_CATEGORY"


def test_gov_list_entries_filter(client):
    """T-GOV-R30-001-04: GET entries ?category=CAT-01 过滤。"""
    client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "E1",
            "httpMethod": "GET",
            "path": "/api/v1/entities/x",
            "categoryCodes": ["CAT-01"],
            "status": "active",
        },
    )
    client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "E2",
            "httpMethod": "GET",
            "path": "/api/v1/stats",
            "categoryCodes": ["CAT-02"],
            "status": "active",
        },
    )
    resp = client.get("/api/v1/gov/catalog/entries?category=CAT-01", headers=AUTH)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert "CAT-01" in item["categoryCodes"]


def _create_entry(client, *, path: str, status: str = "active") -> str:
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Reg",
            "httpMethod": "POST",
            "path": path,
            "categoryCodes": ["CAT-01"],
            "status": status,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_bus_register_active_succeeded(client):
    """T-GOV-R30-002-01: active entry → 201 status=succeeded + traceId。"""
    eid = _create_entry(client, path="/api/v1/query/execute")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["traceId"]


def test_bus_register_draft_not_publishable(client):
    """T-GOV-R30-002-02: draft → 400 BUS_ENTRY_NOT_PUBLISHABLE。"""
    eid = _create_entry(client, path="/api/v1/x", status="draft")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 400
    assert resp.json()["code"] == "BUS_ENTRY_NOT_PUBLISHABLE"


def test_bus_register_not_found(client):
    """T-GOV-R30-002-03: 不存在 entryId → 404 CATALOG_ENTRY_NOT_FOUND。"""
    resp = client.post(
        "/api/v1/gov/bus/register",
        headers=AUTH,
        json={"catalogEntryId": str(uuid.uuid4())},
    )
    assert resp.status_code == 404
    assert resp.json()["code"] == "CATALOG_ENTRY_NOT_FOUND"


def test_bus_register_force_fail(client):
    """T-GOV-R30-002-04: path 含 force-fail → 502 BUS_REGISTRATION_REJECTED。"""
    eid = _create_entry(client, path="/api/v1/force-fail/demo")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 502
    assert resp.json()["code"] == "BUS_REGISTRATION_REJECTED"


def test_openapi_datasources_if06_paths(client):
    """T-API-R30-001-01/02: OpenAPI 含 datasources CRUD + IF-06 tag。"""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "/api/v1/datasources" in paths
    post_op = paths["/api/v1/datasources"]["post"]
    assert "IF-06" in post_op.get("tags", [])
    assert post_op.get("operationId", "").startswith("if06.datasources.")


def test_openapi_info_version(client):
    """T-API-R30-001-04: info.version 存在。"""
    spec = client.get("/openapi.json").json()
    assert "version" in spec["info"]


def test_openapi_query_execute_if06(client):
    """T-API-R30-002-01/02: execute 路径 + requestBody 示例。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/query/execute"]["post"]
    assert "IF-06" in op.get("tags", [])
    assert op.get("operationId") == "if06.query.execute"
    assert "requestBody" in op


def test_datasources_list_smoke(client):
    """T-API-R30-001-03: GET /datasources 200 Bearer dev。"""
    resp = client.get("/api/v1/datasources", headers=AUTH)
    assert resp.status_code == 200


def _create_test_datasource(client) -> str:
    code = f"r30{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": f"R30 DS {uuid.uuid4().hex[:8]}",
            "code": code,
            "type": "mysql",
            "host": "localhost",
            "port": 3306,
            "database": "test",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@patch("app.query.service.execute_query")
def test_query_execute_openapi_smoke(mock_execute, client):
    """T-API-R30-002-03: POST /execute mock → 200。"""
    from app.query.schemas import ExecuteResponse

    mock_execute.return_value = ExecuteResponse(
        columns=["c"], rows=[["v"]], row_count=1, truncated=False, trace_id="t"
    )
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "SELECT 1"},
    )
    assert resp.status_code == 200


def test_query_execute_forbidden_data_source(client):
    """T-API-R30-002-04: 不可见 dataSource → 403。"""
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "SELECT 1"},
    )
    assert resp.status_code in (403, 404)


@patch("app.query.executor.QueryExecutor._load_row")
def test_query_execute_not_readonly(mock_load_row, client):
    """T-API-R30-002-05: INSERT → 400 QUERY_NOT_READONLY。"""
    from unittest.mock import MagicMock

    mock_load_row.return_value = MagicMock(type="mysql")
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "INSERT INTO t VALUES (1)"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_views_validate_api_success(client):
    """T-VIEW-R30-001-09: POST /views/validate 合法 → 200。"""
    resp = client.post(
        "/api/v1/views/validate",
        headers=AUTH,
        json={"name": "OK", "layout": _valid_layout()},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "OK"


def test_gov_get_entry(client):
    """T-GOV-R30-001-05: GET entry by id → 200。"""
    created = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Detail",
            "httpMethod": "GET",
            "path": "/api/v1/detail",
            "categoryCodes": ["CAT-03"],
            "status": "active",
        },
    )
    eid = created.json()["id"]
    resp = client.get(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Detail"


def test_gov_get_entry_not_found(client):
    """T-GOV-R30-001-06: GET 不存在 entry → 404。"""
    resp = client.get(f"/api/v1/gov/catalog/entries/{uuid.uuid4()}", headers=AUTH)
    assert resp.status_code == 404
    assert resp.json()["code"] == "CATALOG_ENTRY_NOT_FOUND"


def test_openapi_views_if06_tag(client):
    """T-API-R30-001-05: views validate OpenAPI IF-06 tag。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/views/validate"]["post"]
    assert "IF-06" in op.get("tags", [])


def test_openapi_gov_catalog_if06(client):
    """T-API-R30-001-06: gov catalog OpenAPI IF-06 paths。"""
    spec = client.get("/openapi.json").json()
    assert "/api/v1/gov/catalog/categories" in spec["paths"]
    assert "/api/v1/gov/bus/register" in spec["paths"]


def test_gov_create_entry_multi_category(client):
    """T-GOV-R30-001-07: 多分类挂载 → 201。"""
    resp = client.post(
        "/api/v1/gov/catalog/entries",
        headers=AUTH,
        json={
            "name": "Multi",
            "httpMethod": "GET",
            "path": "/api/v1/multi",
            "categoryCodes": ["CAT-01", "CAT-02"],
            "status": "active",
        },
    )
    assert resp.status_code == 201
    assert set(resp.json()["categoryCodes"]) == {"CAT-01", "CAT-02"}


def test_bus_register_response_has_bus_response(client):
    """T-GOV-R30-002-05: succeeded 登记含 busResponse。"""
    eid = _create_entry(client, path="/api/v1/stats/sum")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 201
    assert resp.json().get("busResponse")


def test_view_validate_empty_name_rejected(client):
    """T-VIEW-R30-001-10: 空 name → 422。"""
    resp = client.post(
        "/api/v1/views/validate",
        headers=AUTH,
        json={"name": "", "layout": {"version": 1, "widgets": [], "globalFilters": []}},
    )
    assert resp.status_code == 422
