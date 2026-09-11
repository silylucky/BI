"""F-F VIEW + NFR companion tests — track E (r251)."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from app.views import store
from app.views.adapter import dashboard_layout_to_view
from app.views.models import ViewRoleDefault
from app.views.role_defaults_repo import get_role_defaults
from app.views.validate import validate_dashboard_view
from jwt_auth import AUTH

_E95D_SQLITE = "sqlite+pysqlite:///file:ff_track_e_e95d?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def ff_track_e_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _E95D_SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
    import app.query.models  # noqa: F401
    import app.views.models  # noqa: F401

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


@pytest.fixture(autouse=True)
def _reset_view_stores():
    from app.auth.models import get_meta_engine
    from app.views import role_defaults_repo, user_override_repo
    from sqlalchemy.orm import Session

    store.clear_role_defaults()
    with Session(get_meta_engine()) as session:
        role_defaults_repo.clear_role_defaults(session)
        user_override_repo.clear_user_overrides(session)
    yield
    store.clear_role_defaults()
    with Session(get_meta_engine()) as session:
        role_defaults_repo.clear_role_defaults(session)
        user_override_repo.clear_user_overrides(session)


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def _layout_widget(chart_type: str = "kpi") -> dict:
    wid = str(uuid.uuid4())
    return {
        "id": wid,
        "type": "chart",
        "title": chart_type,
        "colSpan": 6,
        "order": 0,
        "chartConfig": {
            "chartType": chart_type,
            "chartId": wid,
            "mode": "sql",
            "dataSourceId": "00000000-0000-4000-8000-000000000010",
            "sql": "SELECT 1",
            "dimensions": [],
            "metrics": [{"field": "total"}],
        },
    }


# --- VIEW-001 ---


def test_view001_adapter_round_trip(client: TestClient):
    create = client.post("/api/v1/dashboards", headers=AUTH, json={"name": "Adapter", "description": ""})
    assert create.status_code == 201
    dash_id = create.json()["id"]
    layout = {"version": 1, "widgets": [_layout_widget()], "globalFilters": []}
    doc = dashboard_layout_to_view(dashboard_id=uuid.UUID(dash_id), name="Adapter", layout_json=layout)
    validated = validate_dashboard_view(doc)
    assert validated.dashboard_id == uuid.UUID(dash_id)
    put = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    assert put.status_code == 200, put.text


def test_view001_put_rejects_invalid_protocol_via_adapter(client: TestClient):
    create = client.post("/api/v1/dashboards", headers=AUTH, json={"name": "Bad", "description": ""})
    dash_id = create.json()["id"]
    bad = {"version": 1, "widgets": [_layout_widget()], "globalFilters": []}
    bad["widgets"][0]["colSpan"] = 99
    resp = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": bad})
    assert resp.status_code == 422
    assert resp.json()["code"] == "VIEW_LAYOUT_BOUNDS"


# --- VIEW-002 / VIEW-003 onboarding ---


def test_view002_role_defaults_db_persist(client: TestClient):
    dash_id = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "RoleDefault", "description": ""},
    ).json()["id"]
    put = client.put(
        "/api/v1/roles/viewer/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id, "maxWidgetCount": 12},
    )
    assert put.status_code == 200
    from app.auth.models import get_meta_engine
    from sqlalchemy.orm import Session

    with Session(get_meta_engine()) as session:
        stored = get_role_defaults(session, "viewer")
        assert stored is not None
        assert stored["dashboardId"] == dash_id
        assert stored["maxWidgetCount"] == 12
        assert session.query(ViewRoleDefault).count() == 1


def test_view003_first_login_inherit_user_override(client: TestClient):
    dash_id = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "Onboard", "description": ""},
    ).json()["id"]
    layout = {"version": 1, "widgets": [_layout_widget()], "globalFilters": []}
    client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    client.put(
        "/api/v1/roles/admin/default-views",
        headers=AUTH,
        json={"dashboardId": dash_id},
    )

    listed = client.get("/api/v1/users/me/views", headers=AUTH)
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "默认"
    assert items[0]["dashboardId"] == dash_id
    assert items[0].get("inheritedFromRole") is True


# --- NFR-001 / NFR-002 perf companions ---


def test_nfr001_dashboard_concurrent_get_probe(client: TestClient):
    from perf.nfr01_dashboard.concurrent_probe import (
        render_report_stub,
        run_concurrent_dashboard_get_probe,
    )

    dash_id = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": "PerfDash", "description": ""},
    ).json()["id"]
    result = run_concurrent_dashboard_get_probe(
        client,
        dashboard_id=dash_id,
        auth_headers=AUTH,
        concurrency=4,
        requests=12,
        budget_ms=5000,
    )
    assert result.success_count == result.requests
    assert result.within_budget is True
    report = render_report_stub(result, dashboard_id=dash_id)
    assert "withinBudget: True" in report


def test_nfr002_report_concurrent_template_run_probe(client: TestClient):
    from perf.nfr01_report.concurrent_probe import run_concurrent_template_run_probe

    template_body = {
        "templateKey": "sales_summary",
        "format": "pdf",
        "displayName": "销售汇总",
        "blocks": [{"blockType": "table", "tableRef": "sales_fact"}],
    }
    put_tpl = client.put("/api/v1/reports/templates/sales_summary", headers=AUTH, json=template_body)
    assert put_tpl.status_code == 200, put_tpl.text
    node_id = client.post(
        "/api/v1/reports/catalog/nodes",
        headers=AUTH,
        json={"name": "PerfTpl", "nodeType": "template", "templateKind": "pdf", "templateKey": "sales_summary"},
    ).json()["id"]
    client.put(
        f"/api/v1/reports/catalog/nodes/{node_id}/extension",
        headers=AUTH,
        json={"catalogNodeId": node_id, "metrics": [], "filters": [], "changeNote": "init"},
    )
    result = run_concurrent_template_run_probe(
        client,
        template_node_id=node_id,
        auth_headers=AUTH,
        concurrency=3,
        requests=9,
        budget_ms=10000,
    )
    assert result.success_count == result.requests
    assert result.within_budget is True
