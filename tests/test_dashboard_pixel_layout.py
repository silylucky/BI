"""Dashboard version=2 pixel layout contract."""

from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.dashboard.schemas import DashboardLayout
from app.views.schemas import ViewError
from app.views.validate import validate_dashboard_view


def _assert_layout_422(response, expected_code: str | None = None) -> None:
    assert response.status_code == 422
    body = response.json()
    if "code" in body:
        if expected_code:
            assert body["code"] == expected_code
    else:
        assert "detail" in body


def _chart_config() -> dict:
    return {
        "chartType": "table",
        "dataSourceId": str(uuid.uuid4()),
        "mode": "sql",
        "sql": "SELECT 1 AS value",
    }


def _pixel_layout(*, x: int = 120, y: int = 44, width: int = 600, height: int = 120) -> dict:
    return {
        "version": 2,
        "canvas": {"width": 1440, "height": 900},
        "widgets": [
            {
                "id": str(uuid.uuid4()),
                "type": "chart",
                "title": "像素图表",
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "order": 0,
                "chartConfig": _chart_config(),
            }
        ],
        "globalFilters": [{"id": "region", "value": "east"}],
    }


def _create_dashboard(client, auth_headers) -> str:
    response = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": "像素布局测试", "slug": f"pixel-layout-{uuid.uuid4().hex[:12]}"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_pixel_layout_api_and_view_round_trip_preserves_v2(client, auth_headers):
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = _pixel_layout()

    put = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text
    stored = put.json()["layoutJson"]
    assert stored["version"] == 2
    assert stored["canvas"] == {"width": 1440, "height": 900}
    assert {key: stored["widgets"][0][key] for key in ("x", "y", "width", "height")} == {
        "x": 120,
        "y": 44,
        "width": 600,
        "height": 120,
    }
    assert stored["globalFilters"] == layout["globalFilters"]
    assert "colSpan" not in stored["widgets"][0]
    assert "rowSpan" not in stored["widgets"][0]

    view = validate_dashboard_view({"name": "像素视图", "layout": stored})
    dumped = view.model_dump(by_alias=True, mode="json")["layout"]
    assert dumped == stored


def test_grid_layout_api_and_view_round_trip_remains_v1(client, auth_headers):
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": str(uuid.uuid4()),
                "title": "旧网格图表",
                "colSpan": 6,
                "rowSpan": 3,
                "gridX": 2,
                "gridY": 4,
                "order": 0,
                "chartConfig": _chart_config(),
            }
        ],
        "globalFilters": [{"id": "region", "value": "east"}],
    }

    put = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text
    stored = put.json()["layoutJson"]
    assert stored["version"] == 1
    assert "canvas" not in stored
    assert stored["widgets"][0]["gridX"] == 2
    assert stored["globalFilters"] == layout["globalFilters"]

    view = validate_dashboard_view({"name": "网格视图", "layout": stored})
    assert view.model_dump(by_alias=True, mode="json")["layout"] == stored


@pytest.mark.parametrize(
    ("version", "extra"),
    [
        (1, {"x": 0, "y": 0, "width": 600, "height": 120}),
        (2, {"colSpan": 6, "rowSpan": 3, "gridX": 0, "gridY": 0}),
    ],
)
def test_layout_rejects_v1_v2_widget_field_mixing(version, extra):
    layout = _pixel_layout()
    layout["version"] = version
    if version == 1:
        layout.pop("canvas")
        widget = layout["widgets"][0]
        for key in ("x", "y", "width", "height"):
            widget.pop(key)
        widget.update({"colSpan": 6, "rowSpan": 3, "gridX": 0, "gridY": 0})
    layout["widgets"][0].update(extra)

    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(layout)


def test_v1_rejects_canvas_and_v2_requires_canvas():
    v1 = {
        "version": 1,
        "canvas": {"width": 1440, "height": 900},
        "widgets": [],
        "globalFilters": [],
    }
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(v1)

    v2 = _pixel_layout()
    v2.pop("canvas")
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(v2)


@pytest.mark.parametrize("level", ["layout", "widget", "canvas"])
def test_pixel_layout_api_rejects_unknown_fields(client, auth_headers, level):
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = _pixel_layout()
    targets = {
        "layout": layout,
        "widget": layout["widgets"][0],
        "canvas": layout["canvas"],
    }
    target = targets[level]
    target["unknownField"] = "must-not-be-dropped"

    response = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )

    assert response.status_code == 422
    _assert_layout_422(response, "DASH_INVALID_LAYOUT")


def test_layout_extra_forbid_does_not_reject_chart_config_fields(client, auth_headers):
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = _pixel_layout()
    layout["widgets"][0]["chartConfig"]["styleVariant"] = "default"

    response = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )

    assert response.status_code == 200, response.text
    assert response.json()["layoutJson"]["widgets"][0]["chartConfig"]["styleVariant"] == "default"


@pytest.mark.parametrize(
    ("patch", "expected_code"),
    [
        ({"x": -1}, "VIEW_LAYOUT_BOUNDS"),
        ({"width": 119}, "VIEW_LAYOUT_BOUNDS"),
        ({"height": 31}, "VIEW_LAYOUT_BOUNDS"),
        ({"x": 1000, "width": 600}, "VIEW_LAYOUT_BOUNDS"),
        ({"y": 850, "height": 120}, "VIEW_LAYOUT_BOUNDS"),
    ],
)
def test_pixel_layout_api_rejects_bounds(client, auth_headers, patch, expected_code):
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = _pixel_layout()
    layout["widgets"][0].update(patch)

    response = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )
    assert response.status_code == 422
    _assert_layout_422(response, expected_code)


def test_pixel_layout_view_rejects_canvas_bounds():
    layout = _pixel_layout(x=1000, width=600)

    with pytest.raises(ViewError) as exc:
        validate_dashboard_view({"name": "越界视图", "layout": layout})

    assert exc.value.code == "VIEW_LAYOUT_BOUNDS"


def test_pixel_layout_accepts_tab_parked_child_zero_size(client, auth_headers):
    dashboard_id = _create_dashboard(client, auth_headers)
    tabs_id = str(uuid.uuid4())
    pane_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    layout = {
        "version": 2,
        "canvas": {"width": 1440, "height": 900},
        "widgets": [
            {
                "id": tabs_id,
                "type": "tabs",
                "title": "页签容器",
                "x": 120,
                "y": 44,
                "width": 720,
                "height": 360,
                "order": 0,
                "tabsConfig": {
                    "tabsId": tabs_id,
                    "activePaneId": pane_id,
                    "panes": [{"id": pane_id, "title": "页签 1", "childWidgetIds": [child_id]}],
                },
            },
            {
                "id": child_id,
                "type": "chart",
                "title": "页签内图表",
                "x": 120,
                "y": 44,
                "width": 0,
                "height": 0,
                "order": 1,
                "parentTabsId": tabs_id,
                "tabPaneId": pane_id,
                "chartConfig": _chart_config(),
            },
        ],
        "globalFilters": [],
    }

    put = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )
    assert put.status_code == 200, put.text
    stored = put.json()["layoutJson"]
    child = next(w for w in stored["widgets"] if w["id"] == child_id)
    assert child["width"] == 0
    assert child["height"] == 0
    assert child["parentTabsId"] == tabs_id
    assert child["tabPaneId"] == pane_id

    view = validate_dashboard_view({"name": "Tab 嵌套", "layout": stored})
    assert view.model_dump(by_alias=True, mode="json")["layout"] == stored


def test_pixel_layout_rejects_tab_child_with_nonzero_size(client, auth_headers):
    dashboard_id = _create_dashboard(client, auth_headers)
    tabs_id = str(uuid.uuid4())
    pane_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    layout = {
        "version": 2,
        "canvas": {"width": 1440, "height": 900},
        "widgets": [
            {
                "id": tabs_id,
                "type": "tabs",
                "title": "页签容器",
                "x": 120,
                "y": 44,
                "width": 720,
                "height": 360,
                "order": 0,
                "tabsConfig": {
                    "tabsId": tabs_id,
                    "activePaneId": pane_id,
                    "panes": [{"id": pane_id, "title": "页签 1", "childWidgetIds": [child_id]}],
                },
            },
            {
                "id": child_id,
                "type": "chart",
                "title": "页签内图表",
                "x": 120,
                "y": 44,
                "width": 600,
                "height": 120,
                "order": 1,
                "parentTabsId": tabs_id,
                "tabPaneId": pane_id,
                "chartConfig": _chart_config(),
            },
        ],
        "globalFilters": [],
    }

    response = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )
    assert response.status_code == 422
    _assert_layout_422(response, "DASH_INVALID_LAYOUT")


def test_migrate_v1_to_v2_is_deterministic_and_expands_canvas():
    from app.dashboard.layout_migration import migrate_v1_to_v2

    widget_id = str(uuid.uuid4())
    source = {
        "version": 1,
        "widgets": [
            {
                "id": widget_id,
                "type": "filter",
                "title": "区域",
                "colSpan": 4,
                "rowSpan": 3,
                "gridX": 2,
                "gridY": 21,
                "order": 0,
                "filterConfig": {
                    "filterId": "region",
                    "dimensionRef": "region",
                    "controlType": "select",
                },
            }
        ],
        "globalFilters": [{"id": "region", "value": "east"}],
    }

    first = migrate_v1_to_v2(source).model_dump(by_alias=True, mode="json")
    second = migrate_v1_to_v2(source).model_dump(by_alias=True, mode="json")

    assert first == second
    assert source["version"] == 1
    assert first["version"] == 2
    assert first["widgets"][0]["x"] == 240
    assert first["widgets"][0]["y"] == 924
    assert first["widgets"][0]["width"] == 480
    assert first["widgets"][0]["height"] == 120
    assert first["canvas"]["height"] == 1044
    assert first["globalFilters"] == source["globalFilters"]
    assert "colSpan" not in first["widgets"][0]


def test_migrate_v1_without_grid_coordinates_is_deterministic():
    from app.dashboard.layout_migration import migrate_v1_to_v2

    source = {
        "version": 1,
        "widgets": [
            {
                "id": str(uuid.uuid4()),
                "title": "旧布局",
                "colSpan": 6,
                "rowSpan": 2,
                "order": 3,
                "chartConfig": _chart_config(),
            }
        ],
        "globalFilters": [],
    }

    migrated = migrate_v1_to_v2(source).model_dump(by_alias=True, mode="json")

    assert migrated["widgets"][0]["x"] == 0
    assert migrated["widgets"][0]["y"] == 132
    assert migrated["widgets"][0]["height"] == 76


def test_dashboard_api_dto_layout_json_is_dashboard_layout():
    from app.dashboard.schemas import DashboardLayout, DashboardLayoutUpdate, DashboardOut

    assert DashboardOut.model_fields["layout_json"].annotation is DashboardLayout
    assert DashboardLayoutUpdate.model_fields["layout_json"].annotation is DashboardLayout


def test_data_screen_canvas_1920x1080_validates():
    layout = DashboardLayout.model_validate(
        {
            "version": 2,
            "canvas": {"width": 1920, "height": 1080},
            "widgets": [],
            "globalFilters": [],
            "styleConfig": {"surfaceKind": "data-screen", "colorScheme": "dark"},
        }
    )
    assert layout.canvas is not None
    assert layout.canvas.width == 1920
    assert layout.canvas.height == 1080


def test_data_screen_custom_canvas_within_bounds_validates():
    layout = DashboardLayout.model_validate(
        {
            "version": 2,
            "canvas": {"width": 1944, "height": 1174},
            "widgets": [],
            "globalFilters": [],
            "styleConfig": {"surfaceKind": "data-screen", "colorScheme": "dark"},
        }
    )
    assert layout.canvas is not None
    assert layout.canvas.width == 1944
    assert layout.canvas.height == 1174


def test_data_screen_rejects_canvas_width_out_of_bounds():
    with pytest.raises(ValidationError):
        DashboardLayout.model_validate(
            {
                "version": 2,
                "canvas": {"width": 700, "height": 1080},
                "widgets": [],
                "globalFilters": [],
                "styleConfig": {"surfaceKind": "data-screen"},
            }
        )


def test_data_screen_rejects_canvas_height_below_backend_min(client, auth_headers):
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = _pixel_layout()
    layout["canvas"] = {"width": 1920, "height": 583}
    layout["styleConfig"] = {"surfaceKind": "data-screen", "colorScheme": "dark"}

    response = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )
    assert response.status_code == 422
    _assert_layout_422(response)
