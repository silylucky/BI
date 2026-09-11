"""Tests for template demo datasource binding."""

from __future__ import annotations

import uuid

from app.dashboard.templates.demo_datasource import (
    TEMPLATE_DEMO_DATASOURCE_REF,
    bind_template_demo_datasources,
    repair_legacy_template_layout,
)
from app.dashboard.templates import presets
from app.dashboard.templates import presets_gov
from app.dashboard.service import validate_layout


def test_bind_template_demo_datasources_replaces_magic_ref() -> None:
    ds_id = uuid.uuid4()
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": "w1",
                "type": "chart",
                "chartConfig": {
                    "chartId": "w1",
                    "chartType": "bar",
                    "dataSourceId": TEMPLATE_DEMO_DATASOURCE_REF,
                    "sql": "SELECT 1",
                },
            }
        ],
        "globalFilters": [],
    }
    bound = bind_template_demo_datasources(layout, ds_id)
    assert bound["widgets"][0]["chartConfig"]["dataSourceId"] == str(ds_id)


def test_repair_legacy_template_layout_normalizes_gap_and_chart_style() -> None:
    layout = {
        "version": 1,
        "widgets": [],
        "globalFilters": [],
        "styleConfig": {
            "gapPreset": "comfortable",
            "chartStyle": {"labelColor": "#abc"},
            "gap": 16,
        },
    }
    repaired = repair_legacy_template_layout(layout)
    assert repaired["styleConfig"]["gapPreset"] == "md"
    assert repaired["styleConfig"]["chartLabelStyle"] == {"color": "#abc"}
    assert "chartStyle" not in repaired["styleConfig"]


def test_repair_legacy_template_layout_migrates_deprecated_chart_types() -> None:
    layout = {
        "version": 1,
        "widgets": [
            {
                "id": "w1",
                "type": "chart",
                "chartConfig": {
                    "chartId": "w1",
                    "chartType": "table",
                    "mode": "sql",
                    "sql": "SELECT 1",
                },
            }
        ],
        "globalFilters": [],
    }
    repaired = repair_legacy_template_layout(layout)
    assert repaired["widgets"][0]["chartConfig"]["chartType"] == "table-info"


DEPRECATED_CHART_TYPES = frozenset({"table", "combo", "heatmap", "wordCloud", "timeline"})


def test_builtin_preset_layouts_avoid_deprecated_chart_types() -> None:
    builders = [
        presets.build_screen_blank_layout,
        presets.build_command_center_layout,
        presets.build_tech_blue_layout,
        presets.build_gov_minimal_layout,
        presets.build_sales_geo_screen_layout,
        presets.build_dash_blank_layout,
        presets.build_dual_kpi_layout,
        presets.build_triple_analysis_layout,
        presets.build_ops_dashboard_layout,
        presets_gov.build_gov_efficiency_dashboard,
        presets_gov.build_gov_satisfaction_dashboard,
        presets_gov.build_gov_finance_dashboard,
        presets_gov.build_gov_investment_dashboard,
        presets_gov.build_gov_grid_dashboard,
    ]
    for builder in builders:
        layout = builder()
        for widget in layout.get("widgets", []):
            if widget.get("type") != "chart":
                continue
            chart_type = widget["chartConfig"]["chartType"]
            assert chart_type not in DEPRECATED_CHART_TYPES, f"{builder.__name__}: {chart_type}"


def test_builtin_preset_layout_validates_after_demo_bind() -> None:
    builders = [
        presets.build_triple_analysis_layout,
        presets_gov.build_gov_efficiency_dashboard,
        presets_gov.build_gov_finance_dashboard,
    ]
    for builder in builders:
        bound = bind_template_demo_datasources(builder(), uuid.uuid4())
        validate_layout(bound)
