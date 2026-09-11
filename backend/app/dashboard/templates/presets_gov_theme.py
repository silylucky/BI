"""政企模板视觉主题：深浅双系 + 差异化组件样式。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.dashboard.templates.presets import _materialize_dash_style
from app.dashboard.templates.presets_de_dash import (
    DE_BLUE,
    DE_CANVAS,
    DE_GREEN,
    DE_PALETTE_DEFAULT,
    DE_PALETTE_GREEN,
    DE_PALETTE_INDIGO,
    DE_PALETTE_SLATE,
    DE_PALETTE_VIOLET,
    DE_PURPLE,
    DE_SLATE,
    build_de_chart_de_style,
    build_de_dash_style,
)
from app.dashboard.templates.presets_gov_assets import (
    COMMUNITY_BG,
    DIGITAL_COCKPIT_BG,
    ECO_MONITOR_BG,
    EMERGENCY_BG,
    SMART_CITY_BG,
)

WidgetVariant = Literal["glass", "elevated", "ribbon", "float", "minimal"]

_BRAND = "#465fff"
_SLATE_300 = "#cbd5e1"
_SLATE_400 = "#94a3b8"
_SLATE_500 = "#64748b"
_SLATE_600 = "#475569"
_TITLE_LIGHT = "#1e293b"
_TITLE_DARK = "#f1f5f9"
_LABEL_LIGHT = "#64748b"
_LABEL_DARK = "#94a3b8"


@dataclass(frozen=True)
class GovScreenTheme:
    accent: str
    canvas: str
    bg_image: str
    palette: tuple[str, ...]
    scheme: Literal["light", "dark"] = "light"
    widget_variant: WidgetVariant = "elevated"


@dataclass(frozen=True)
class GovDashTheme:
    accent: str
    scheme: Literal["light", "dark"]
    canvas: str
    bg_slug: str
    palette: tuple[str, ...]
    widget_variant: WidgetVariant = "elevated"


# —— 大屏：2 深色指挥 + 3 浅色政务 ——
THEME_SMART_CITY = GovScreenTheme(
    scheme="dark",
    accent="#22d3ee",
    canvas="#041016",
    bg_image=SMART_CITY_BG,
    palette=("#22d3ee", "#38bdf8", "#0ea5e9", "#67e8f9", "#94a3b8", "#475569"),
    widget_variant="glass",
)
THEME_DIGITAL_COCKPIT = GovScreenTheme(
    scheme="light",
    accent="#4f46e5",
    canvas="#f8fafc",
    bg_image=DIGITAL_COCKPIT_BG,
    palette=("#4f46e5", "#6366f1", "#818cf8", "#312e81", _SLATE_600, _SLATE_400),
    widget_variant="elevated",
)
THEME_EMERGENCY = GovScreenTheme(
    scheme="dark",
    accent="#fb7185",
    canvas="#1a0509",
    bg_image=EMERGENCY_BG,
    palette=("#fb7185", "#f43f5e", "#fda4af", "#fbbf24", "#94a3b8", "#64748b"),
    widget_variant="glass",
)
THEME_ECO = GovScreenTheme(
    scheme="light",
    accent="#059669",
    canvas="#f0fdf4",
    bg_image=ECO_MONITOR_BG,
    palette=("#059669", "#10b981", "#34d399", "#047857", _SLATE_600, "#86efac"),
    widget_variant="ribbon",
)
THEME_COMMUNITY = GovScreenTheme(
    scheme="light",
    accent="#7c3aed",
    canvas="#faf5ff",
    bg_image=COMMUNITY_BG,
    palette=("#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", _SLATE_600, "#c4b5fd"),
    widget_variant="float",
)

# —— 看板（DataEase 浅灰 + 白卡片）——
THEME_EFFICIENCY = GovDashTheme(
    accent=DE_BLUE,
    scheme="light",
    canvas=DE_CANVAS,
    bg_slug="gov-efficiency",
    palette=DE_PALETTE_DEFAULT,
)
THEME_SATISFACTION = GovDashTheme(
    accent=DE_PURPLE,
    scheme="light",
    canvas=DE_CANVAS,
    bg_slug="gov-satisfaction",
    palette=DE_PALETTE_VIOLET,
)
THEME_FINANCE = GovDashTheme(
    accent=DE_GREEN,
    scheme="light",
    canvas=DE_CANVAS,
    bg_slug="gov-finance",
    palette=DE_PALETTE_GREEN,
)
THEME_INVESTMENT = GovDashTheme(
    accent="#597ef7",
    scheme="light",
    canvas=DE_CANVAS,
    bg_slug="gov-investment",
    palette=DE_PALETTE_INDIGO,
)
THEME_GRID = GovDashTheme(
    accent=DE_SLATE,
    scheme="light",
    canvas=DE_CANVAS,
    bg_slug="gov-grid",
    palette=DE_PALETTE_SLATE,
)


def _widget_style_for_variant(variant: WidgetVariant, *, accent: str, dark: bool) -> dict[str, Any]:
    if variant == "glass" or dark:
        return {
            "background": "rgba(15, 23, 42, 0.52)",
            "backgroundShow": True,
            "borderEnabled": True,
            "borderColor": f"{accent}66",
            "borderWidth": 1,
            "borderStyle": "solid",
            "borderRadius": 10,
            "backdropBlur": 10,
            "padding": 12,
            "opacity": 1,
        }
    if variant == "float":
        return {
            "background": "rgba(255, 255, 255, 0.88)",
            "backgroundShow": True,
            "borderEnabled": False,
            "borderRadius": 16,
            "backdropBlur": 4,
            "padding": 14,
            "opacity": 1,
        }
    if variant == "ribbon":
        return {
            "background": "#ffffff",
            "backgroundShow": True,
            "borderEnabled": True,
            "borderColor": "#e2e8f0",
            "borderWidth": 1,
            "borderStyle": "solid",
            "borderRadius": 10,
            "borderTopColor": accent,
            "borderTopWidth": 3,
            "padding": 12,
            "opacity": 1,
        }
    if variant == "minimal":
        return {
            "background": "rgba(255, 255, 255, 0.72)",
            "backgroundShow": True,
            "borderEnabled": True,
            "borderColor": "#e2e8f0",
            "borderWidth": 1,
            "borderStyle": "dashed",
            "borderRadius": 8,
            "padding": 10,
            "opacity": 1,
        }
    return {
        "background": "#ffffff",
        "backgroundShow": True,
        "borderEnabled": True,
        "borderColor": "#e2e8f0",
        "borderWidth": 1,
        "borderStyle": "solid",
        "borderRadius": 12,
        "padding": 14,
        "opacity": 1,
    }


def _apply_gov_style(
    style: dict[str, Any],
    *,
    theme: GovScreenTheme | GovDashTheme,
    surface_kind: str,
) -> dict[str, Any]:
    dark = theme.scheme == "dark"
    style["surfaceKind"] = surface_kind
    style["colorScheme"] = "dark" if dark else "light"
    style["seriesGradient"] = dark
    style["gapPreset"] = "md"
    style["canvasBackground"] = theme.canvas
    style["canvasBackgroundCustom"] = True
    style["canvasDecorPresetId"] = "none"
    style["themeAccent"] = theme.accent
    style["titleStyle"] = {
        "color": _TITLE_DARK if dark else _TITLE_LIGHT,
        "fontSize": 13 if surface_kind == "dashboard" else 14,
        "fontWeight": 600,
        "shadow": dark,
    }
    style["chartLabelStyle"] = {"color": _LABEL_DARK if dark else _LABEL_LIGHT}
    style["filterChromeStyle"] = {"titleColor": _LABEL_DARK if dark else _LABEL_LIGHT}
    style["widgetStyle"] = _widget_style_for_variant(
        theme.widget_variant, accent=theme.accent, dark=dark
    )
    style["paletteId"] = "custom"
    style["paletteColors"] = list(theme.palette)
    return style


def build_gov_screen_chrome_style(theme: GovScreenTheme) -> dict[str, Any]:
    dark = theme.scheme == "dark"
    if dark:
        return {
            "clock": {
                "color": theme.accent,
                "fontSize": 15,
                "showWeekday": True,
                "showSeconds": True,
            },
        }
    return {
        "clock": {
            "color": _SLATE_500,
            "fontSize": 14,
            "showWeekday": True,
            "showSeconds": True,
        },
    }


def build_gov_screen_style(theme: GovScreenTheme) -> dict[str, Any]:
    style = _materialize_dash_style(
        scheme=theme.scheme,
        accent=theme.accent,
        decor=None,
        bg_image=theme.bg_image,
        palette_colors=list(theme.palette),
    )
    return _apply_gov_style(style, theme=theme, surface_kind="data-screen")


def build_gov_dash_style(theme: GovDashTheme) -> dict[str, Any]:
    return build_de_dash_style(
        accent=theme.accent,
        bg_slug=theme.bg_slug,
        palette=theme.palette,
        canvas=theme.canvas,
    )


def build_gov_chart_de_style(
    theme: GovScreenTheme | GovDashTheme,
    chart_type: str,
) -> dict[str, Any]:
    if isinstance(theme, GovDashTheme):
        return build_de_chart_de_style(
            accent=theme.accent,
            chart_type=chart_type,
            palette=theme.palette,
        )
    colors = list(theme.palette)
    accent = theme.accent
    dark = theme.scheme == "dark"
    label_color = _LABEL_DARK if dark else _LABEL_LIGHT
    title_color = _TITLE_DARK if dark else _TITLE_LIGHT

    de_style: dict[str, Any] = {
        "seriesGradient": dark,
        "label": {"show": chart_type not in ("kpi",), "color": label_color, "fontSize": 11},
        "legend": {
            "show": chart_type in ("pie", "bar", "line", "map"),
            "color": label_color,
            "fontSize": 11,
        },
        "border": {
            "show": dark,
            "color": f"{accent}44" if dark else "#e2e8f0",
            "width": 1,
            "radius": 8,
        },
        "title": {"color": title_color, "fontSize": 13, "fontWeight": 600},
    }
    if chart_type == "map":
        de_style["geo"] = {
            "mapArea": "china",
            "visualMap": True,
            "areaColor": f"{accent}22" if dark else f"{accent}18",
            "borderColor": accent if dark else f"{accent}99",
            "emphasisColor": f"{accent}55",
        }
    if chart_type in ("bar", "line", "pie", "gauge", "word-cloud", "kpi", "table-info"):
        de_style["paletteId"] = "custom"
        de_style["seriesColor"] = [
            {"name": f"series-{i}", "color": c} for i, c in enumerate(colors[:6])
        ]
    if chart_type == "gauge":
        de_style["gauge"] = {"axisColor": _SLATE_400, "pointerColor": accent}
    return de_style
