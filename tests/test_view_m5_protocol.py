"""M5 VIEW-001 — protocolVersion + round-trip + destructive cases."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app as fastapi_app
from app.views.adapter import dashboard_layout_to_view
from app.views.protocol import VIEW_PROTOCOL_VERSION, round_trip_view_document
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view
from jwt_auth import AUTH

_M5_SQLITE_URL = "sqlite+pysqlite:///file:view_m5_protocol?mode=memory&cache=shared&uri=true"


@pytest.fixture(scope="module", autouse=True)
def m5_sqlite_env():
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _M5_SQLITE_URL
    get_settings.cache_clear()
    from app.auth.models import Base as AuthBase, get_meta_engine as auth_engine
    from app.datasources.models import Base, get_meta_engine
    from app.query.models import Base as QueryBase
    import app.auth.models  # noqa: F401
    import app.dashboard.models  # noqa: F401
    import app.datasources.models  # noqa: F401
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


def _m5_layout_widget(chart_type: str, dims: list[str], metrics: list[str], widget_id: str | None = None) -> dict:
    wid = widget_id or str(uuid.uuid4())
    return {
        "id": wid,
        "type": "chart",
        "title": chart_type,
        "colSpan": 6,
        "rowSpan": 1,
        "order": 0,
        "chartConfig": {
            "chartType": chart_type,
            "chartId": wid,
            "mode": "sql",
            "dataSourceId": "00000000-0000-4000-8000-000000000010",
            "sql": "SELECT 1",
            "dimensions": [{"field": d} for d in dims],
            "metrics": [{"field": m} for m in metrics],
        },
    }


def _view_doc(widgets: list[dict]) -> dict:
    return {
        "name": "M5 view",
        "protocolVersion": VIEW_PROTOCOL_VERSION,
        "layout": {"version": 1, "widgets": widgets, "globalFilters": []},
    }


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_view_001_01_validate_extended_widgets():
    doc = _view_doc([
        _m5_layout_widget("map", ["region"], ["value"]),
        _m5_layout_widget("heatmap", ["x", "y"], ["v"]),
        _m5_layout_widget("kpi", [], ["total"]),
        _m5_layout_widget("timeline", ["t"], ["v"]),
    ])
    for i, w in enumerate(doc["layout"]["widgets"]):
        w["order"] = i
    view = validate_dashboard_view(doc)
    assert view.layout.widgets


def test_view_001_02_round_trip_equivalent():
    doc = _view_doc([_m5_layout_widget("heatmap", ["x", "y"], ["v"])])
    out = round_trip_view_document(doc)
    again = round_trip_view_document(out)
    assert again["layout"]["widgets"][0]["chartConfig"]["chartType"] == "heatmap"


def test_view_001_02b_adapter_preserves_v2_pixel_geometry():
    widget = _m5_layout_widget("kpi", [], ["total"])
    widget.pop("colSpan")
    widget.pop("rowSpan")
    widget.update({"x": 120, "y": 80, "width": 480, "height": 320})
    layout = {
        "version": 2,
        "canvas": {"width": 1440, "height": 900},
        "widgets": [widget],
        "globalFilters": [],
    }

    doc = dashboard_layout_to_view(
        dashboard_id=uuid.uuid4(),
        name="Pixel view",
        layout_json=layout,
    )
    out = round_trip_view_document(doc)

    assert out["protocolVersion"] == VIEW_PROTOCOL_VERSION
    assert out["layout"]["version"] == 2
    assert out["layout"]["widgets"][0]["x"] == 120
    assert out["layout"]["widgets"][0]["width"] == 480
    assert "colSpan" not in out["layout"]["widgets"][0]


def test_view_001_03_unknown_chart_type_rejected():
    doc = _view_doc([_m5_layout_widget("not-a-chart", [], ["v"])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.status == 422


def test_view_001_04a_heatmap_one_dimension_rejected():
    doc = _view_doc([_m5_layout_widget("heatmap", ["x"], ["v"])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"
    assert any("dimensions" in f.get("field", "") for f in exc.value.fields)


def test_view_001_04b_kpi_empty_metrics_rejected():
    doc = _view_doc([_m5_layout_widget("kpi", [], [])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"
    assert any("metrics" in f.get("field", "") for f in exc.value.fields)


def test_view_001_04c_timeline_empty_dimensions_rejected():
    doc = _view_doc([_m5_layout_widget("timeline", [], ["v"])])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "CHART_FIELD_REQUIREMENT"


def test_view_001_04d_protocol_version_2_rejected():
    doc = _view_doc([_m5_layout_widget("kpi", [], ["total"])])
    doc["protocolVersion"] = 2
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "VIEW_PROTOCOL_UNSUPPORTED"
    assert any(f.get("field") == "protocolVersion" for f in exc.value.fields)


def test_view_001_04e_extended_widget_colspan_out_of_bounds_rejected():
    w = _m5_layout_widget("map", ["region"], ["value"])
    w["colSpan"] = 13
    doc = _view_doc([w])
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view(doc)
    assert exc.value.code == "VIEW_LAYOUT_BOUNDS"


def test_view_001_04g_chart_ref_cycle_with_kpi():
    id_a, id_b = str(uuid.uuid4()), str(uuid.uuid4())
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": id_a,
                "type": "chart",
                "title": "KPI",
                "colSpan": 6,
                "order": 0,
                "chartRef": id_b,
                "chartConfig": {
                    "chartType": "kpi",
                    "chartId": id_a,
                    "mode": "sql",
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "sql": "SELECT 1",
                    "dimensions": [],
                    "metrics": [{"field": "total"}],
                },
            },
            {
                "id": id_b,
                "type": "chart",
                "title": "Map",
                "colSpan": 6,
                "order": 1,
                "chartRef": id_a,
                "chartConfig": {
                    "chartType": "map",
                    "chartId": id_b,
                    "mode": "sql",
                    "dataSourceId": "00000000-0000-4000-8000-000000000010",
                    "sql": "SELECT 1",
                    "dimensions": [{"field": "region"}],
                    "metrics": [{"field": "value"}],
                },
            },
        ],
        "globalFilters": [],
    }
    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "cycle", "layout": layout})
    assert exc.value.code == "VIEW_CHART_REF_CYCLE"


def test_view_001_06_get_schema_api(client: TestClient):
    resp = client.get("/api/v1/views/schema", headers=AUTH)
    assert resp.status_code == 200
    schema = resp.json()
    assert "properties" in schema
    assert "protocolVersion" in schema["properties"]


def test_view_001_05_dashboard_put_get_round_trip(client: TestClient):
    create = client.post("/api/v1/dashboards", headers=AUTH, json={"name": "M5-RT", "description": ""})
    assert create.status_code == 201
    dash_id = create.json()["id"]
    layout = _view_doc([_m5_layout_widget("kpi", [], ["total", "rate"])])["layout"]
    put = client.put(f"/api/v1/dashboards/{dash_id}/layout", headers=AUTH, json={"layoutJson": layout})
    assert put.status_code == 200, put.text
    get = client.get(f"/api/v1/dashboards/{dash_id}", headers=AUTH)
    assert get.status_code == 200
    got = get.json()["layoutJson"]["widgets"][0]["chartConfig"]["chartType"]
    assert got == "kpi"
    val = client.post("/api/v1/views/validate", headers=AUTH, json={"name": "x", "layout": layout})
    assert val.status_code == 200
