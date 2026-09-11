"""Dashboard layout grid coordinate persistence and bounds."""
from __future__ import annotations

import uuid


def _create_dashboard(client, auth_headers) -> str:
    response = client.post(
        "/api/v1/dashboards",
        headers=auth_headers,
        json={"name": "布局坐标测试", "slug": f"layout-grid-{uuid.uuid4().hex[:12]}"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _layout(*, grid_x: int = 2, grid_y: int = 3, col_span: int = 6, row_span: int = 12):
    return {
        "version": 1,
        "widgets": [
            {
                "id": str(uuid.uuid4()),
                "type": "chart",
                "title": "坐标图表",
                "colSpan": col_span,
                "rowSpan": row_span,
                "gridX": grid_x,
                "gridY": grid_y,
                "order": 0,
                "chartConfig": {
                    "chartType": "table",
                    "dataSourceId": str(uuid.uuid4()),
                    "mode": "sql",
                    "sql": "SELECT 1 AS value",
                },
            }
        ],
        "globalFilters": [],
    }


def test_layout_put_preserves_grid_coordinates_and_row_span(client, auth_headers):
    """PUT 后 GET 保留 gridX/gridY，且允许 12 行组件。"""
    dashboard_id = _create_dashboard(client, auth_headers)
    layout = _layout()

    put = client.put(
        f"/api/v1/dashboards/{dashboard_id}/layout",
        headers=auth_headers,
        json={"layoutJson": layout},
    )

    assert put.status_code == 200
    got = client.get(f"/api/v1/dashboards/{dashboard_id}", headers=auth_headers)
    assert got.status_code == 200
    widget = got.json()["layoutJson"]["widgets"][0]
    assert widget["gridX"] == 2
    assert widget["gridY"] == 3
    assert widget["rowSpan"] == 12


def test_layout_put_rejects_grid_coordinates_outside_bounds(client, auth_headers):
    """grid 坐标越界或超出 12 列时返回明确的 bounds 422。"""
    dashboard_id = _create_dashboard(client, auth_headers)

    for layout in (
        _layout(grid_x=-1),
        _layout(grid_y=-1),
        _layout(grid_x=11, col_span=2),
    ):
        response = client.put(
            f"/api/v1/dashboards/{dashboard_id}/layout",
            headers=auth_headers,
            json={"layoutJson": layout},
        )

        assert response.status_code == 422
        body = response.json()
        if "code" in body:
            assert body["code"] == "VIEW_LAYOUT_BOUNDS"
        else:
            assert "detail" in body
