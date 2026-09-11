"""存量 chartConfig 迁移 — 与 FE migrateChartTypes 对齐。"""

from __future__ import annotations

from app.schemas.chart_view import ChartViewConfigLayout
from app.viz.migrate_chart_types import migrate_chart_config, migrate_layout_chart_configs


def test_migrate_bar_stacked_to_bar_stack():
    out = migrate_chart_config({"chartType": "bar", "styleVariant": "stacked"})
    assert out["chartType"] == "bar-stack"
    assert out["styleVariant"] == "default"


def test_migrate_line_stacked_to_area_stack():
    out = migrate_chart_config({"chartType": "line", "styleVariant": "stacked"})
    assert out["chartType"] == "area-stack"
    assert out["styleVariant"] == "default"


def test_layout_shell_accepts_legacy_stacked_variants():
    cfg = ChartViewConfigLayout.model_validate(
        {"chartType": "line", "styleVariant": "stacked", "dimensions": [], "metrics": []},
    )
    assert cfg.chart_type == "area-stack"
    assert cfg.style_variant == "default"


def test_layout_shell_persists_de_axes():
    cfg = ChartViewConfigLayout.model_validate(
        {
            "chartType": "kpi",
            "styleVariant": "default",
            "dimensions": [],
            "metrics": [{"field": "amount"}],
            "axes": {"yAxis": [{"field": "amount"}]},
        },
    )
    assert cfg.axes is not None
    assert cfg.axes["yAxis"][0].field == "amount"


def test_migrate_remaps_legacy_chinese_axis_aliases():
    out = migrate_chart_config(
        {
            "chartType": "table-info",
            "dimensions": [{"field": "grid_name"}],
            "axes": {
                "xAxis": [
                    {"field": "网格"},
                    {"field": "事件数"},
                    {"field": "已办结"},
                ]
            },
        },
    )
    fields = [item["field"] for item in out["axes"]["xAxis"]]
    assert fields == ["grid_name", "event_count", "resolved_count"]


def test_layout_rejects_unknown_axis_id():
    import pytest

    with pytest.raises(ValueError, match="CHART_INVALID_AXIS"):
        ChartViewConfigLayout.model_validate(
            {
                "chartType": "line",
                "styleVariant": "default",
                "axes": {"unknownAxis": [{"field": "x"}]},
            },
        )


def test_migrate_layout_widgets():
    layout = migrate_layout_chart_configs(
        {
            "version": 1,
            "widgets": [
                {
                    "id": "w1",
                    "type": "chart",
                    "chartConfig": {"chartType": "bar", "styleVariant": "stacked"},
                },
            ],
        },
    )
    cfg = layout["widgets"][0]["chartConfig"]
    assert cfg["chartType"] == "bar-stack"
