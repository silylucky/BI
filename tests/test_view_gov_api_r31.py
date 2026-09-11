"""M5 VIEW-001 + M6 companion 质量推分 r31 — VIEW-001/GOV-002/GOV-001/API-001/API-002."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view

_R31_SQLITE_URL = "sqlite+pysqlite:///file:view_gov_r31?mode=memory&cache=shared&uri=true"


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


def test_view_empty_widgets_allowed_r31():
    """T-VIEW-R31-001-01: layout.widgets=[] → 200 且 widgets==[]。"""
    view = validate_dashboard_view(
        {"name": "Empty", "layout": {"version": 1, "widgets": [], "globalFilters": []}}
    )
    assert view.layout.widgets == []


def test_view_colspan_bounds_r31():
    """T-VIEW-R31-001-02: colSpan=13 → VIEW_LAYOUT_BOUNDS + detail.fields 含 colSpan。"""
    layout = _valid_layout()
    layout["widgets"][0]["colSpan"] = 13
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Bounds", "layout": layout})
    assert exc.value.code == "VIEW_LAYOUT_BOUNDS"
    assert any("colSpan" in f.get("field", "") for f in exc.value.fields)


def test_view_chart_ref_cycle_r31():
    """T-VIEW-R31-001-03: A→B→A chartRef → VIEW_CHART_REF_CYCLE。"""
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {"id": id_a, "type": "chart", "title": "A", "colSpan": 12, "order": 0, "chartRef": id_b},
            {"id": id_b, "type": "chart", "title": "B", "colSpan": 12, "order": 1, "chartRef": id_a},
        ],
        "globalFilters": [],
    }
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Cycle", "layout": layout})
    assert exc.value.code == "VIEW_CHART_REF_CYCLE"


@pytest.fixture(autouse=True)
def r31_registry():
    from app.datasources import register_builtin_dialects
    from app.datasources.registry import registry

    registry._connectors.clear()
    register_builtin_dialects()
    yield
    registry._connectors.clear()
    register_builtin_dialects()


@pytest.fixture(scope="module", autouse=True)
def r31_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _R31_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.governance.catalog.models  # noqa: F401
    import app.query.models  # noqa: F401

    get_meta_engine.cache_clear()
    auth_engine.cache_clear()
    engine = get_meta_engine()
    Base.metadata.create_all(engine)
    AuthBase.metadata.create_all(engine)
    QueryBase.metadata.create_all(engine)
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


def test_views_validate_api_bounds_body_r31(client):
    """T-VIEW-R31-001-04: POST /views/validate colSpan 越界 → 422 code + detail.fields。"""
    layout = _valid_layout()
    layout["widgets"][0]["colSpan"] = 13
    resp = client.post("/api/v1/views/validate", headers=AUTH, json={"name": "Bad", "layout": layout})
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "VIEW_LAYOUT_BOUNDS"
    assert body["detail"] is not None
    assert isinstance(body["detail"]["fields"], list)


def test_dashboard_layout_put_regression_r31(client, db_session):
    """T-VIEW-R31-001-05: PUT layout 合法 200；重复 widget → DASH_DUPLICATE_WIDGET。"""
    from app.dashboard.service import create_dashboard, update_layout

    dash = create_dashboard(db_session, name="R31 Dash")
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


def test_view_unknown_chart_ref_regression_r31():
    """T-VIEW-R31-001-06: 未知 chartId → VIEW_UNKNOWN_CHART_REF（r30 回归）。"""
    other = str(uuid.uuid4())
    layout = _valid_layout()
    layout["widgets"][0]["chartConfig"]["chartId"] = other
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "Ref", "layout": layout})
    assert exc.value.code == "VIEW_UNKNOWN_CHART_REF"


from app.auth.deps import UserContext, get_current_user
from jwt_auth import AUTH, jwt_auth_headers


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


def test_bus_register_timeout_r31(client):
    """T-GOV-R31-002-01: force-timeout → 504 BUS_REGISTRATION_TIMEOUT + detail.traceId。"""
    eid = _create_entry(client, path="/api/v1/force-timeout/demo")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 504
    body = resp.json()
    assert body["code"] == "BUS_REGISTRATION_TIMEOUT"
    assert body["detail"] is not None
    assert body["detail"]["traceId"]


def test_bus_register_4xx_5xx_r31(client):
    """T-GOV-R31-002-02: force-4xx → 400；force-5xx → 502。"""
    e4 = _create_entry(client, path="/api/v1/force-4xx/demo")
    r4 = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": e4})
    assert r4.status_code == 400
    assert r4.json()["code"] == "BUS_REGISTRATION_CLIENT_ERROR"
    e5 = _create_entry(client, path="/api/v1/force-5xx/demo")
    r5 = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": e5})
    assert r5.status_code == 502
    assert r5.json()["code"] == "BUS_REGISTRATION_SERVER_ERROR"


def test_bus_register_idempotent_r31(client):
    """T-GOV-R31-002-03: 同一 entry 连续登记 → 201 后 200 同 id。"""
    eid = _create_entry(client, path="/api/v1/query/execute-r31")
    first = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert first.status_code == 201
    second = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


def test_bus_register_forbidden_non_admin_r31(client):
    """T-GOV-R31-002-04: 非 admin → 403 BUS_REGISTER_FORBIDDEN。"""
    app.dependency_overrides[get_current_user] = lambda: UserContext(
        id="viewer", username="viewer", roles=["viewer"]
    )
    try:
        eid = _create_entry(client, path="/api/v1/query/exec-forbidden")
        resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
        assert resp.status_code == 403
        assert resp.json()["code"] == "BUS_REGISTER_FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_bus_register_failure_no_succeeded_row_r31(client, db_session):
    """T-GOV-R31-002-05: force-fail 不插入 succeeded 行。"""
    from sqlalchemy import select
    from app.governance.catalog.models import BusRegistration

    eid = _create_entry(client, path="/api/v1/force-fail/r31")
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 502
    rows = db_session.scalars(
        select(BusRegistration).where(BusRegistration.catalog_entry_id == uuid.UUID(eid))
    ).all()
    assert all(r.status != "succeeded" for r in rows)


def test_gov_list_entries_invalid_category_r31(client):
    """T-GOV-R31-001-01: ?category=CAT-99 → 400 CATALOG_INVALID_CATEGORY。"""
    resp = client.get("/api/v1/gov/catalog/entries?category=CAT-99", headers=AUTH)
    assert resp.status_code == 400
    assert resp.json()["code"] == "CATALOG_INVALID_CATEGORY"


def test_gov_list_entries_pagination_r31(client):
    """T-GOV-R31-001-02: limit=1 offset=0 分页字段一致。"""
    for i in range(2):
        client.post(
            "/api/v1/gov/catalog/entries",
            headers=AUTH,
            json={
                "name": f"P{i}",
                "httpMethod": "GET",
                "path": f"/api/v1/p/{i}",
                "categoryCodes": ["CAT-01"],
                "status": "active",
            },
        )
    resp = client.get("/api/v1/gov/catalog/entries?limit=1&offset=0", headers=AUTH)
    assert resp.status_code == 200
    body = resp.json()
    assert body["limit"] == 1
    assert body["offset"] == 0
    assert body["total"] >= 2
    assert len(body["items"]) == 1


def test_gov_categories_kind_enum_r31(client):
    """T-GOV-R31-001-03: 附录 E 七分法 kind 覆盖 entity~audit。"""
    resp = client.get("/api/v1/gov/catalog/categories", headers=AUTH)
    kinds = {item["kind"] for item in resp.json()["items"]}
    assert kinds == {"entity", "aggregate", "geo", "timeseries", "ticket", "production", "audit"}


def test_gov_delete_entry_r31(client):
    """T-GOV-R31-001-04: 创建 → DELETE 204 → GET 404。"""
    eid = _create_entry(client, path="/api/v1/to-delete")
    del_resp = client.delete(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    assert del_resp.status_code == 204
    get_resp = client.get(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    assert get_resp.status_code == 404


def test_gov_delete_then_bus_register_404_r31(client):
    """T-GOV-R31-001-05: 删除后 bus/register → 404。"""
    eid = _create_entry(client, path="/api/v1/deleted-bus")
    client.delete(f"/api/v1/gov/catalog/entries/{eid}", headers=AUTH)
    resp = client.post("/api/v1/gov/bus/register", headers=AUTH, json={"catalogEntryId": eid})
    assert resp.status_code == 404
    assert resp.json()["code"] == "CATALOG_ENTRY_NOT_FOUND"


def test_openapi_datasource_path_param_example_r31(client):
    """T-API-R31-001-01: GET /datasources/{id} path 参数含 example。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/datasources/{data_source_id}"]["get"]
    params = op.get("parameters", [])
    assert params
    assert params[0].get("example") or params[0].get("schema", {}).get("example")


def test_openapi_datasource_response_examples_r31(client):
    """T-API-R31-001-02: datasources POST/GET responses 含 json example。"""
    spec = client.get("/openapi.json").json()
    post = spec["paths"]["/api/v1/datasources"]["post"]
    post_resp = post["responses"]["201"]["content"]["application/json"]
    assert "example" in post_resp or "examples" in post_resp
    get_list = spec["paths"]["/api/v1/datasources"]["get"]
    get_resp = get_list["responses"]["200"]["content"]["application/json"]
    assert "example" in get_resp or "examples" in get_resp


def test_datasources_unauthorized_r31(client):
    """T-API-R31-001-03: GET /datasources 无 Authorization → 401。"""
    resp = client.get("/api/v1/datasources")
    assert resp.status_code == 401


def test_datasources_list_smoke_regression_r31(client):
    """T-API-R31-001-04: GET /datasources Bearer dev → 200（r30 回归）。"""
    resp = client.get("/api/v1/datasources", headers=AUTH)
    assert resp.status_code == 200


def _create_test_datasource(client) -> str:
    resp = client.post(
        "/api/v1/datasources",
        headers=AUTH,
        json={
            "name": "R31 DS",
            "code": f"r31-{uuid.uuid4().hex[:6]}",
            "type": "postgresql",
            "host": "localhost",
            "port": 5432,
            "database": "test",
            "username": "u",
            "password": "p",
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_execute_unauthorized_r31(client):
    """T-API-R31-002-01: POST /execute 无 auth → 401。"""
    resp = client.post(
        "/api/v1/query/execute",
        json={"dataSourceId": str(uuid.uuid4()), "mode": "sql", "sql": "SELECT 1"},
    )
    assert resp.status_code == 401


def test_execute_forbidden_hidden_datasource_r31(client, auth_headers):
    """T-API-R31-002-02: 不可见 dataSource → 403 RESOURCE_FORBIDDEN。"""
    from sqlalchemy import select, text
    from app.auth.models import AuthUser
    from app.datasources.models import get_meta_session
    from app.datasources.schemas import DataSourceCreate
    from app.datasources.service import create_data_source

    session = get_meta_session()
    try:
        visible = create_data_source(
            session,
            DataSourceCreate(
                name="R31 Visible",
                code=f"r31-vis-{uuid.uuid4().hex[:6]}",
                type="postgresql",
                host="h",
                port=5432,
                database="d",
                username="u",
                password="p",
            ),
        )
        hidden = create_data_source(
            session,
            DataSourceCreate(
                name="R31 Hidden",
                code=f"r31-hid-{uuid.uuid4().hex[:6]}",
                type="postgresql",
                host="h",
                port=5432,
                database="d",
                username="u",
                password="p",
            ),
        )
        session.commit()
    finally:
        session.close()

    role = client.post(
        "/api/v1/roles",
        json={"code": f"r31_viewer_{uuid.uuid4().hex[:6]}", "name": "Viewer"},
        headers=auth_headers,
    ).json()
    client.post(
        "/api/v1/resource-grants",
        json={"role_id": role["id"], "resource_type": "datasource", "resource_id": str(visible.id)},
        headers=auth_headers,
    )
    dev_user = client.post("/api/v1/users", json={"username": "dev", "initialPassword": "Init-Pass-1234567"}, headers=auth_headers)
    if dev_user.status_code != 201:
        session = get_meta_session()
        try:
            user = session.scalar(select(AuthUser).where(AuthUser.username == "dev"))
            dev_id = str(user.id)
        finally:
            session.close()
    else:
        dev_id = dev_user.json()["id"]
    client.put(
        f"/api/v1/users/{dev_id}/roles",
        json={"role_ids": [role["id"]]},
        headers=auth_headers,
    )
    # Task 4 起中间件从 DB 解析身份，auth_headers 恒为 root（直通 RLS）。以真实非
    # root 的 dev 用户 JWT 调用，才能触发 hidden 数据源的 RESOURCE_FORBIDDEN。
    dev_headers = jwt_auth_headers(user_id=dev_id, username="dev")
    try:
        resp = client.post(
            "/api/v1/query/execute",
            json={"dataSourceId": str(hidden.id), "mode": "sql", "sql": "SELECT 1"},
            headers=dev_headers,
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "RESOURCE_FORBIDDEN"
    finally:
        client.put(f"/api/v1/users/{dev_id}/roles", json={"role_ids": []}, headers=auth_headers)
        session = get_meta_session()
        try:
            session.execute(text("DELETE FROM auth_resource_grants"))
            session.execute(text("DELETE FROM auth_user_roles"))
            session.execute(text("DELETE FROM data_sources"))
            session.commit()
        finally:
            session.close()


@pytest.fixture
def auth_headers():
    return AUTH


def test_execute_multi_statement_rejected_r31(client):
    """T-API-R31-002-03: SELECT 1; DELETE → 400 QUERY_NOT_READONLY。"""
    ds_id = _create_test_datasource(client)
    resp = client.post(
        "/api/v1/query/execute",
        headers=AUTH,
        json={"dataSourceId": ds_id, "mode": "sql", "sql": "SELECT 1; DELETE FROM t"},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "QUERY_NOT_READONLY"


def test_openapi_execute_response_example_r31(client):
    """T-API-R31-002-04: execute 200 response example 含 traceId。"""
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/api/v1/query/execute"]["post"]
    example = op["responses"]["200"]["content"]["application/json"].get("example", {})
    assert "traceId" in example

