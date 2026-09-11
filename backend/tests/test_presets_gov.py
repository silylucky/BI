"""政企内置模板预设结构验收。"""

from __future__ import annotations

from app.dashboard.templates import presets_gov
from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF


def _first_chart(layout: dict) -> dict:
    for widget in layout["widgets"]:
        if widget.get("type") == "chart":
            return widget
    raise AssertionError("no chart widget")


def test_gov_smart_city_screen_has_materialized_style_and_de_style() -> None:
    layout = presets_gov.build_gov_smart_city_screen()
    style = layout["styleConfig"]
    assert style["canvasBackgroundCustom"] is True
    assert style.get("canvasBackgroundImage") or style.get("canvasBackground")
    assert style.get("paletteColors")
    assert style.get("seriesGradient") is True
    assert "themeAccent" not in style
    assert "#22d3ee" in style.get("canvasBackground", "")
    assert style.get("widgetStyle", {}).get("borderColor") == "#22d3ee80"

    border = next(
        w for w in layout["widgets"]
        if w.get("textConfig", {}).get("content") == "__vs_screen_border__"
    )
    assert border["textConfig"]["screenStyle"]["border"]["accentColor"] == "#22d3ee"

    chart = _first_chart(layout)
    cfg = chart["chartConfig"]
    assert cfg.get("dataSourceId") == TEMPLATE_DEMO_DATASOURCE_REF
    de = cfg.get("nativeBody", {}).get("deStyle")
    assert de
    assert de.get("seriesColor", [{}])[0].get("color") == "#22d3ee"


def test_gov_screens_are_v2_with_l3_density() -> None:
    map_builders = {
        presets_gov.build_gov_smart_city_screen,
        presets_gov.build_gov_emergency_command_screen,
        presets_gov.build_gov_eco_monitor_screen,
    }
    no_map_builders = {
        presets_gov.build_gov_digital_cockpit_screen,
        presets_gov.build_gov_community_screen,
    }
    table_builders = {
        presets_gov.build_gov_smart_city_screen,
        presets_gov.build_gov_emergency_command_screen,
        presets_gov.build_gov_eco_monitor_screen,
        presets_gov.build_gov_community_screen,
    }
    all_builders = [
        presets_gov.build_gov_smart_city_screen,
        presets_gov.build_gov_digital_cockpit_screen,
        presets_gov.build_gov_emergency_command_screen,
        presets_gov.build_gov_eco_monitor_screen,
        presets_gov.build_gov_community_screen,
    ]
    for build in all_builders:
        layout = build()
        assert layout["version"] == 2
        assert layout["canvas"] == {"width": 1920, "height": 1080}
        charts = [w for w in layout["widgets"] if w.get("type") == "chart"]
        assert len(charts) >= 5
        types = {w["chartConfig"]["chartType"] for w in charts}
        if build in map_builders:
            assert "map" in types
        if build in no_map_builders:
            assert "map" not in types
        if build in table_builders:
            assert "table-info" in types


def test_gov_dashboard_has_materialized_dash_style() -> None:
    layout = presets_gov.build_gov_efficiency_dashboard()
    style = layout["styleConfig"]
    assert style.get("canvasBackgroundCustom") or style.get("canvasBackground")
    assert style.get("paletteColors")
