from __future__ import annotations

from app.dashboard.preview_summary import extract_preview_summary, sync_surface_kind_column


def test_extract_preview_summary_strips_chart_config() -> None:
    layout = {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "styleConfig": {"surfaceKind": "data-screen"},
        "widgets": [
            {
                "id": "w1",
                "type": "chart",
                "order": 0,
                "x": 10,
                "y": 20,
                "width": 400,
                "height": 300,
                "chartConfig": {"chartType": "bar", "sql": "SELECT 1"},
            },
        ],
        "globalFilters": [],
    }
    summary = extract_preview_summary(layout)
    assert summary["version"] == 2
    assert summary["canvas"] == {"width": 1920, "height": 1080}
    assert summary["widgets"][0]["id"] == "w1"
    assert summary["widgets"][0]["type"] == "chart"
    assert summary["widgets"][0]["chartType"] == "bar"
    assert "chartConfig" not in summary["widgets"][0]
    assert sync_surface_kind_column(layout) == "data-screen"
