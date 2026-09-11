"""F-F track D — DASH-005 metricSource companion pytest."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from jwt_auth import AUTH

_DASH_FF_SQLITE = "sqlite+pysqlite:///file:ff_track_d_dash005?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def dash005_sqlite_env():
    previous_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _DASH_FF_SQLITE
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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


def _create_dashboard(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/dashboards",
        headers=AUTH,
        json={"name": f"FF Dash {uuid.uuid4().hex[:6]}", "description": "ff-track-d"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _put_metric_widget(client: TestClient, dash_id: str, *, metric_key: str) -> str:
    wid = str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": wid,
                "type": "chart",
                "title": "Orders",
                "colSpan": 12,
                "rowSpan": 1,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": f"SELECT 42 AS {metric_key}",
                    "dimensions": [],
                    "metrics": [{"field": metric_key}],
                },
            }
        ],
        "globalFilters": [],
    }
    resp = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    assert resp.status_code == 200, resp.text
    return wid


def test_dash005_metric_source_valid(client: TestClient):
    """T-DASH-005-FF-01: metricSource + matching metricKey validate 200."""
    dash_id = _create_dashboard(client)
    wid = _put_metric_widget(client, dash_id, metric_key="total_orders")
    payload = {
        "dashboardId": dash_id,
        "entityTypeRef": "customer",
        "statCards": [
            {
                "metricKey": "total_orders",
                "label": "Orders",
                "metricSource": {"widgetId": wid},
            }
        ],
        "filters": [],
        "drillTargets": [],
    }
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 200, resp.text


def test_dash005_metric_source_mismatch(client: TestClient):
    """T-DASH-005-FF-02: metricKey not in widget metrics → 422."""
    dash_id = _create_dashboard(client)
    wid = _put_metric_widget(client, dash_id, metric_key="total_orders")
    payload = {
        "dashboardId": dash_id,
        "entityTypeRef": "customer",
        "statCards": [
            {
                "metricKey": "other_metric",
                "label": "Other",
                "metricSource": {"widgetId": wid},
            }
        ],
        "filters": [],
        "drillTargets": [],
    }
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_METRIC_KEY_MISMATCH"


def test_dash005_metric_source_missing_widget(client: TestClient):
    """T-DASH-005-FF-03: metricSource widget missing → 422."""
    dash_id = _create_dashboard(client)
    payload = {
        "dashboardId": dash_id,
        "entityTypeRef": "customer",
        "statCards": [
            {
                "metricKey": "total_orders",
                "label": "Orders",
                "metricSource": {"widgetId": "missing-widget"},
            }
        ],
        "filters": [],
        "drillTargets": [],
    }
    resp = client.post("/api/v1/dashboards/entity-overview/validate", headers=AUTH, json=payload)
    assert resp.status_code == 422
    assert resp.json()["code"] == "DASH_OVERVIEW_INVALID_METRIC_SOURCE"
