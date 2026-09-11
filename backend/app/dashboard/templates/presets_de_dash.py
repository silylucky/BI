"""DataEase 风格仪表板主题与样式（浅灰画布 + 白卡片 + Ant Design 色板）。"""

from __future__ import annotations

from typing import Any, Literal

from app.dashboard.templates.presets_gov_assets import de_bg

# Ant Design / DataEase 常用色
DE_BLUE = "#1890ff"
DE_CYAN = "#13c2c2"
DE_GREEN = "#52c41a"
DE_GOLD = "#faad14"
DE_RED = "#f5222d"
DE_PURPLE = "#722ed1"
DE_MAGENTA = "#eb2f96"
DE_SLATE = "#595959"

DE_CANVAS = "#f0f2f5"
DE_TITLE = "#262626"
DE_LABEL = "#8c8c8c"

DE_PALETTE_DEFAULT = (DE_BLUE, DE_CYAN, DE_GREEN, DE_GOLD, DE_RED, DE_PURPLE)
DE_PALETTE_VIOLET = (DE_PURPLE, DE_MAGENTA, DE_BLUE, DE_CYAN, "#9254de", "#b37feb")
DE_PALETTE_GREEN = (DE_GREEN, DE_CYAN, DE_BLUE, DE_GOLD, "#73d13d", "#36cfc9")
DE_PALETTE_INDIGO = ("#597ef7", DE_BLUE, DE_PURPLE, DE_CYAN, "#85a5ff", "#adc6ff")
DE_PALETTE_TEAL = (DE_CYAN, DE_BLUE, DE_GREEN, "#36cfc9", "#5cdbd3", "#87e8de")
DE_PALETTE_SLATE = (DE_SLATE, DE_BLUE, "#8c8c8c", "#bfbfbf", "#595959", "#d9d9d9")


def de_card_widget_style(*, accent: str = DE_BLUE) -> dict[str, Any]:
    """对标 DataEase 组件外框：白底、细边框、4px 圆角。"""
    return {
        "background": "#ffffff",
        "backgroundShow": True,
        "borderEnabled": True,
        "borderColor": "#f0f0f0",
        "borderWidth": 1,
        "borderStyle": "solid",
        "borderRadius": 4,
        "padding": 16,
        "opacity": 1,
    }


def build_de_dash_style(
    *,
    accent: str,
    bg_slug: str,
    palette: tuple[str, ...] = DE_PALETTE_DEFAULT,
    canvas: str = DE_CANVAS,
    gap: Literal["sm", "md", "lg"] = "sm",
) -> dict[str, Any]:
    return {
        "surfaceKind": "dashboard",
        "colorScheme": "light",
        "seriesGradient": False,
        "gapPreset": gap,
        "canvasBackground": canvas,
        "canvasBackgroundCustom": True,
        "canvasBackgroundImage": de_bg(bg_slug),
        "canvasDecorPresetId": "none",
        "themeAccent": accent,
        "paletteId": "custom",
        "paletteColors": list(palette),
        "titleStyle": {
            "show": True,
            "color": DE_TITLE,
            "fontSize": 14,
            "fontWeight": 600,
            "shadow": False,
        },
        "chartLabelStyle": {"color": DE_LABEL},
        "filterChromeStyle": {"titleColor": DE_LABEL},
        "widgetStyle": de_card_widget_style(accent=accent),
    }


def build_de_chart_de_style(
    *,
    accent: str,
    chart_type: str,
    palette: tuple[str, ...] = DE_PALETTE_DEFAULT,
) -> dict[str, Any]:
    colors = list(palette)
    de_style: dict[str, Any] = {
        "seriesGradient": False,
        "label": {
            "show": chart_type not in ("kpi", "gauge"),
            "color": DE_LABEL,
            "fontSize": 12,
        },
        "legend": {
            "show": chart_type in ("pie", "bar", "line", "map"),
            "color": DE_LABEL,
            "fontSize": 12,
        },
        "border": {
            "show": False,
            "color": "#f0f0f0",
            "width": 0,
            "radius": 0,
        },
        "title": {"color": DE_TITLE, "fontSize": 14, "fontWeight": 600, "show": False},
    }
    if chart_type == "map":
        de_style["geo"] = {
            "mapArea": "china",
            "visualMap": True,
            "areaColor": f"{accent}22",
            "borderColor": f"{accent}99",
            "emphasisColor": f"{accent}44",
        }
    if chart_type in ("bar", "line", "pie", "gauge", "word-cloud", "kpi", "table-info"):
        de_style["paletteId"] = "custom"
        de_style["seriesColor"] = [
            {"name": f"series-{i}", "color": c} for i, c in enumerate(colors[:6])
        ]
    if chart_type == "gauge":
        de_style["gauge"] = {"axisColor": "#d9d9d9", "pointerColor": accent}
    return de_style
