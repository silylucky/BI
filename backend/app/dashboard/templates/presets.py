"""内置可视化模板布局预设（对标 DataEase 模板市场视觉密度）。

内置模板 chart 的 SQL 须来自 ``official_demo_sql``，数据源占位 ``__demo:sample_db__``。
"""

from __future__ import annotations

import uuid
from typing import Any

from app.dashboard.templates.demo_datasource import TEMPLATE_DEMO_DATASOURCE_REF
from app.dashboard.templates.presets_gov_assets import (
    SCREEN_COMMAND_BG,
    SCREEN_GOV_BG,
    SCREEN_SALES_GEO_BG,
    SCREEN_TECH_BG,
    borderless_decor,
)
from app.dashboard.templates.presets_de_dash import (
    DE_BLUE,
    DE_CANVAS,
    DE_PALETTE_DEFAULT,
    DE_PALETTE_TEAL,
    DE_PALETTE_VIOLET,
    build_de_chart_de_style,
    build_de_dash_style,
)
from app.dashboard.templates.presets_dash_grids import (
    CHART_ROW,
    CHART_ROW_SM,
    KPI_ROW,
    grid_place,
)
from app.dashboard.templates.official_demo_sql import (
    SQL_DAILY_KPI,
    SQL_SALES_BY_CHANNEL,
    SQL_SALES_BY_PROVINCE,
    SQL_SALES_GEO_DRILL,
    SQL_SALES_TREND,
    SQL_TOP_CITIES,
)

SCREEN_BORDER_MARKER = "__vs_screen_border__"
SCREEN_CLOCK_MARKER = "__vs_screen_clock__"

DECOR_GRADIENT_DARK: dict[str, str] = {
    "gradient-soft": "linear-gradient(160deg, #0f172a 0%, #1e293b 48%, #172554 100%)",
    "gradient-brand": "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)",
    "gradient-radial": (
        "radial-gradient(ellipse 90% 70% at 50% -10%, #312e81 0%, #0f172a 55%, #020617 100%)"
    ),
}

DECOR_GRADIENT_LIGHT: dict[str, str] = {
    "gradient-soft": "linear-gradient(160deg, #eff6ff 0%, #f8fafc 45%, #fef3c7 100%)",
    "gradient-brand": "linear-gradient(135deg, #eef2ff 0%, #f8fafc 52%, #ffffff 100%)",
    "gradient-radial": (
        "radial-gradient(ellipse 90% 70% at 50% -10%, #e0e7ff 0%, #f8fafc 50%, #ffffff 100%)"
    ),
}

_TITLE_ACCENT_PALETTE: dict[str, str] = {
    "#22d3ee": "cyan",
    "#38bdf8": "royal",
    "#60a5fa": "royal",
    "#3b82f6": "cobalt",
    "#6366f1": "indigo",
    "#818cf8": "indigo",
    "#34d399": "emerald",
    "#f87171": "magenta",
    "#a78bfa": "violet",
    "#2dd4bf": "teal",
}


def _title_bar_palette(accent: str | None) -> str:
    if not accent:
        return "cobalt"
    return _TITLE_ACCENT_PALETTE.get(accent.lower(), "cobalt")


def _wid() -> str:
    return str(uuid.uuid4())


def _chart(
    *,
    chart_type: str,
    title: str,
    sql: str,
    dimensions: list[dict[str, str]] | None = None,
    metrics: list[dict[str, str]] | None = None,
    de_style: dict[str, Any] | None = None,
    data_source_ref: str | None = TEMPLATE_DEMO_DATASOURCE_REF,
    **geo: Any,
) -> dict[str, Any]:
    wid = _wid()
    cfg: dict[str, Any] = {
        "chartType": chart_type,
        "mode": "sql",
        "chartId": wid,
        "sql": sql,
    }
    if dimensions:
        cfg["dimensions"] = dimensions
    if metrics:
        cfg["metrics"] = metrics
    if data_source_ref:
        cfg["dataSourceId"] = data_source_ref
    if de_style:
        cfg["nativeBody"] = {"deStyle": de_style}
    return {
        "id": wid,
        "type": "chart",
        "title": title,
        "chartConfig": cfg,
        **geo,
    }


def _border(variant: str, accent: str | None = None, **geo: Any) -> dict[str, Any]:
    wid = _wid()
    border_style: dict[str, Any] = {"variant": variant}
    if accent:
        border_style["accentColor"] = accent
    return {
        "id": wid,
        "type": "text",
        "title": "边框装饰",
        "textConfig": {
            "content": SCREEN_BORDER_MARKER,
            "variant": "plain",
            "screenStyle": {"border": border_style},
        },
        **geo,
    }


def _clock(
    *,
    screen_style: dict[str, Any] | None = None,
    **geo: Any,
) -> dict[str, Any]:
    wid = _wid()
    text_config: dict[str, Any] = {
        "content": SCREEN_CLOCK_MARKER,
        "variant": "plain",
    }
    if screen_style:
        text_config["screenStyle"] = screen_style
    return {
        "id": wid,
        "type": "text",
        "title": "时钟",
        "textConfig": text_config,
        **geo,
    }


_TITLE_VARIANT_TO_BORDERLESS: dict[str, str] = {
    "de-trapezoid-wing": "decor-twin-swoosh",
    "de-circuit-sym": "decor-wave-soft",
    "de-cloud-center": "decor-glow-streak",
    "de-glow-plaque": "decor-arc-swoosh",
    "de-glow-plate": "decor-arc-swoosh",
    "simple": "decor-arc-top",
}


def _title_bar(
    accent: str | None = None,
    *,
    variant: str = "de-trapezoid-wing",
    screen_style: dict[str, Any] | None = None,
    **geo: Any,
) -> dict[str, Any]:
    """大屏顶栏：普通富文本 + widgetStyle 背景图（对标 DataEase 组件背景）。"""
    wid = _wid()
    merged_style = dict(screen_style or {})
    title_bar = dict(merged_style.get("titleBar") or {})
    if accent:
        title_bar.setdefault("accentColor", accent)
    resolved_variant = str(title_bar.get("variant") or variant)
    palette = str(title_bar.get("palette") or _title_bar_palette(accent))
    decor_style = _TITLE_VARIANT_TO_BORDERLESS.get(resolved_variant, "decor-bow-deep")
    bg_url = borderless_decor(decor_style, palette)
    return {
        "id": wid,
        "type": "text",
        "title": "数据大屏标题",
        "textConfig": {
            "content": "",
            "variant": "plain",
            "widgetStyle": {
                "backgroundShow": True,
                "backgroundMode": "image",
                "backgroundImage": bg_url,
                "backgroundImageOpacity": 1,
                "backgroundImageFit": "widthFit",
                "backgroundImagePosition": "top center",
            },
        },
        **geo,
    }


def _accent_canvas_gradient(accent: str, canvas: str) -> str:
    """模板画布底色：accent 光晕 + 深色底，与 SVG 底图叠加。"""
    return (
        f"radial-gradient(ellipse 100% 85% at 50% -5%, {accent}40 0%, "
        f"{canvas} 42%, #020617 100%)"
    )


def _materialize_screen_style(
    *,
    accent: str = "#22d3ee",
    canvas: str = "#0f172a",
    decor: str | None = "gradient-soft",
    bg_image: str | None = None,
    palette_colors: list[str] | None = None,
) -> dict[str, Any]:
    """写入 FE 可直接渲染的 styleConfig（渐变/底图/调色板）。"""
    style = _screen_style(
        accent=accent,
        canvas=canvas,
        decor=None if bg_image else decor,
        bg_image=bg_image,
    )
    if bg_image:
        # 有底图时用纯色垫底，避免渐变盖住 SVG 背景
        style["canvasBackground"] = canvas
    else:
        style["canvasBackground"] = _accent_canvas_gradient(accent, canvas)
        if decor and decor in DECOR_GRADIENT_DARK:
            style["canvasBackground"] = DECOR_GRADIENT_DARK[decor]
    style["seriesGradient"] = True
    if palette_colors:
        style["paletteId"] = "custom"
        style["paletteColors"] = palette_colors
    widget = style.setdefault("widgetStyle", {})
    if isinstance(widget, dict):
        if bg_image:
            widget["background"] = "rgba(15, 23, 42, 0.45)"
            widget["borderEnabled"] = False
            widget["borderRadius"] = 8
        else:
            widget["background"] = f"{accent}12"
            widget["borderColor"] = f"{accent}80"
            widget["borderWidth"] = 1
            widget["borderEnabled"] = True
            widget["borderRadius"] = 10
    return style


def _materialize_dash_style(
    *,
    scheme: str = "light",
    accent: str = "#465fff",
    decor: str | None = "gradient-soft",
    canvas: str | None = None,
    bg_image: str | None = None,
    palette_colors: list[str] | None = None,
) -> dict[str, Any]:
    is_dark = scheme == "dark"
    gradient_map = DECOR_GRADIENT_DARK if is_dark else DECOR_GRADIENT_LIGHT
    resolved_canvas = canvas
    if not resolved_canvas and decor and decor in gradient_map:
        resolved_canvas = gradient_map[decor]
    style = _dash_style(
        scheme=scheme,
        accent=accent,
        decor=decor,
        canvas=resolved_canvas,
    )
    if bg_image:
        style["canvasBackgroundImage"] = bg_image
        style["canvasBackgroundCustom"] = True
        style["canvasBackground"] = "#0f172a" if is_dark else "#f8fafc"
        style["canvasDecorPresetId"] = "none"
    elif resolved_canvas:
        style["canvasBackgroundCustom"] = True
    style["seriesGradient"] = True
    if palette_colors:
        style["paletteId"] = "custom"
        style["paletteColors"] = palette_colors
    if bg_image:
        widget = style.setdefault("widgetStyle", {})
        if isinstance(widget, dict):
            widget["borderEnabled"] = False
            widget["borderRadius"] = 8
            widget["background"] = (
                "rgba(15, 23, 42, 0.45)" if is_dark else "rgba(255, 255, 255, 0.78)"
            )
    return style


def _screen_chart(
    *,
    accent: str,
    palette: list[str] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    chart_type = kwargs.get("chart_type", "bar")
    de = _chart_de_style_for_accent(accent, chart_type=chart_type, palette=palette)
    return _chart(de_style=de, **kwargs)


def _chart_de_style_for_accent(
    accent: str,
    *,
    chart_type: str,
    palette: list[str] | None = None,
) -> dict[str, Any]:
    """模板默认 chart deStyle（深色大屏）。"""
    colors = palette or [accent, "#38bdf8", "#6366f1", "#34d399", "#fbbf24", "#f472b6"]
    de_style: dict[str, Any] = {
        "seriesGradient": True,
        "label": {"show": True, "color": "#cbd5e1", "fontSize": 12},
        "legend": {"show": True, "color": "#94a3b8", "fontSize": 11},
        "border": {"show": True, "color": f"{accent}59", "width": 1, "radius": 8},
    }
    if chart_type == "map":
        de_style["geo"] = {
            "mapArea": "china",
            "visualMap": True,
            "areaColor": f"{accent}22",
            "borderColor": accent,
        }
    if chart_type in ("bar", "line", "pie", "gauge", "word-cloud", "kpi"):
        de_style["paletteId"] = "custom"
        de_style["seriesColor"] = [
            {"name": f"series-{index}", "color": color}
            for index, color in enumerate(colors[:6])
        ]
    return de_style


def _screen_style(
    *,
    accent: str = "#22d3ee",
    canvas: str = "#020617",
    decor: str | None = "gradient-radial",
    bg_image: str | None = None,
) -> dict[str, Any]:
    style: dict[str, Any] = {
        "surfaceKind": "data-screen",
        "colorScheme": "dark",
        "canvasBackground": canvas,
        "canvasBackgroundCustom": True,
        "paletteId": "default",
        "gapPreset": "md",
        "widgetStyle": {
            "background": "rgba(15, 23, 42, 0.78)",
            "borderColor": f"{accent}59",
            "borderWidth": 1,
            "borderEnabled": True,
            "borderStyle": "solid",
            "borderRadius": 10,
        },
        "titleStyle": {"color": "#e2e8f0", "fontSize": 14, "fontWeight": 600},
        "chartLabelStyle": {"color": "#cbd5e1"},
    }
    if decor:
        style["canvasDecorPresetId"] = decor
    if bg_image:
        style["canvasBackgroundImage"] = bg_image
    return style


def _dash_style(
    *,
    scheme: str = "light",
    accent: str = "#465fff",
    decor: str | None = "gradient-radial",
    canvas: str | None = None,
) -> dict[str, Any]:
    is_dark = scheme == "dark"
    style: dict[str, Any] = {
        "surfaceKind": "dashboard",
        "colorScheme": scheme,
        "paletteId": "default",
        "gapPreset": "md",
        "widgetStyle": {
            "background": "#ffffff" if not is_dark else "#1e293b",
            "borderColor": "#e4e7ec" if not is_dark else "#334155",
            "borderWidth": 1,
            "borderEnabled": True,
            "borderStyle": "solid",
            "borderRadius": 12,
        },
        "titleStyle": {"color": "#1d2939" if not is_dark else "#f2f4f7", "fontSize": 14, "fontWeight": 600},
        "chartLabelStyle": {"color": "#667085" if not is_dark else "#98a2b3"},
    }
    if canvas:
        style["canvasBackground"] = canvas
        style["canvasBackgroundCustom"] = True
    if decor:
        style["canvasDecorPresetId"] = decor
    return style


def build_screen_blank_layout() -> dict[str, Any]:
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": [],
        "globalFilters": [],
        "styleConfig": _materialize_screen_style(
            accent="#22d3ee",
            canvas="#041016",
            bg_image=SCREEN_COMMAND_BG,
            palette_colors=["#22d3ee", "#38bdf8", "#6366f1", "#34d399", "#fbbf24", "#a78bfa"],
        ),
    }


def build_command_center_layout() -> dict[str, Any]:
    accent = "#22d3ee"
    palette = ["#22d3ee", "#38bdf8", "#6366f1", "#34d399", "#fbbf24", "#a78bfa"]
    left = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="bar",
        title="渠道销售",
        sql=SQL_SALES_BY_CHANNEL,
        dimensions=[{"field": "渠道"}],
        metrics=[{"field": "销售额"}],
        x=48,
        y=128,
        width=520,
        height=380,
        order=2,
    )
    center = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="map",
        title="区域销售地图",
        sql=SQL_SALES_GEO_DRILL,
        dimensions=[
            {"field": "省份"},
            {"field": "城市"},
            {"field": "区县"},
        ],
        metrics=[{"field": "销售额"}],
        x=600,
        y=128,
        width=720,
        height=520,
        order=3,
    )
    right = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="line",
        title="销售趋势",
        sql=SQL_SALES_TREND,
        dimensions=[{"field": "日期"}],
        metrics=[{"field": "销售额"}],
        x=1352,
        y=128,
        width=520,
        height=380,
        order=4,
    )
    bottom = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="pie",
        title="省份占比",
        sql=SQL_SALES_BY_PROVINCE,
        dimensions=[{"field": "省份"}],
        metrics=[{"field": "销售额"}],
        x=600,
        y=680,
        width=720,
        height=320,
        order=5,
    )
    widgets = [
        _title_bar(x=0, y=0, width=1920, height=100, order=0),
        _clock(x=1680, y=24, width=200, height=56, order=1),
        _border("border-3", x=32, y=104, width=552, height=420, order=6),
        _border("border-3", x=584, y=104, width=752, height=560, order=7),
        _border("border-3", x=1336, y=104, width=552, height=420, order=8),
        left,
        center,
        right,
        bottom,
    ]
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": widgets,
        "globalFilters": [],
        "styleConfig": _materialize_screen_style(
            accent=accent,
            canvas="#041016",
            bg_image=SCREEN_COMMAND_BG,
            palette_colors=palette,
        ),
    }


def build_tech_blue_layout() -> dict[str, Any]:
    accent = "#38bdf8"
    palette = ["#38bdf8", "#22d3ee", "#6366f1", "#818cf8", "#34d399", "#f472b6"]
    main = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="line",
        title="核心指标趋势",
        sql=SQL_SALES_TREND,
        dimensions=[{"field": "日期"}],
        metrics=[{"field": "销售额"}],
        x=120,
        y=160,
        width=1680,
        height=780,
        order=2,
    )
    kpi_left = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="bar",
        title="渠道对比",
        sql=SQL_SALES_BY_CHANNEL,
        dimensions=[{"field": "渠道"}],
        metrics=[{"field": "销售额"}],
        x=120,
        y=960,
        width=520,
        height=80,
        order=3,
    )
    kpi_right = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="pie",
        title="区域结构",
        sql=SQL_SALES_BY_PROVINCE,
        dimensions=[{"field": "省份"}],
        metrics=[{"field": "销售额"}],
        x=1280,
        y=960,
        width=520,
        height=80,
        order=4,
    )
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": [
            _title_bar(accent=accent, x=0, y=0, width=1920, height=100, order=0),
            _clock(x=1680, y=28, width=200, height=56, order=1),
            _border("border-5", accent=accent, x=80, y=120, width=1760, height=840, order=5),
            main,
            kpi_left,
            kpi_right,
        ],
        "globalFilters": [],
        "styleConfig": _materialize_screen_style(
            accent=accent,
            canvas="#0c1222",
            bg_image=SCREEN_TECH_BG,
            palette_colors=palette,
        ),
    }


def build_gov_minimal_layout() -> dict[str, Any]:
    accent = "#818cf8"
    palette = ["#818cf8", "#6366f1", "#a78bfa", "#34d399", "#22d3ee", "#f472b6"]
    center_map = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="map",
        title="全国销售分布",
        sql=SQL_SALES_GEO_DRILL,
        dimensions=[
            {"field": "省份"},
            {"field": "城市"},
            {"field": "区县"},
        ],
        metrics=[{"field": "销售额"}],
        x=360,
        y=200,
        width=1200,
        height=640,
        order=2,
    )
    left_kpi = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="bar",
        title="重点城市",
        sql=SQL_TOP_CITIES,
        dimensions=[{"field": "城市"}],
        metrics=[{"field": "销售额"}],
        x=64,
        y=200,
        width=280,
        height=300,
        order=3,
    )
    right_kpi = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="line",
        title="月度趋势",
        sql=SQL_SALES_TREND,
        dimensions=[{"field": "日期"}],
        metrics=[{"field": "销售额"}],
        x=1576,
        y=200,
        width=280,
        height=300,
        order=4,
    )
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": [
            _title_bar(accent=accent, x=0, y=0, width=1920, height=100, order=0),
            _clock(x=1680, y=48, width=200, height=56, order=1),
            _border("border-2", accent=accent, x=340, y=176, width=1240, height=688, order=5),
            left_kpi,
            center_map,
            right_kpi,
        ],
        "globalFilters": [],
        "styleConfig": _materialize_screen_style(
            accent=accent,
            canvas="#0f172a",
            bg_image=SCREEN_GOV_BG,
            palette_colors=palette,
        ),
    }


def _dash_chart_de(
    *,
    accent: str = DE_BLUE,
    palette: tuple[str, ...] = DE_PALETTE_DEFAULT,
    chart_type: str,
    **kwargs: Any,
) -> dict[str, Any]:
    de = build_de_chart_de_style(accent=accent, chart_type=chart_type, palette=palette)
    return _chart(de_style=de, chart_type=chart_type, **kwargs)


def build_dash_blank_layout() -> dict[str, Any]:
    return {
        "version": 1,
        "widgets": [],
        "globalFilters": [],
        "styleConfig": build_de_dash_style(
            accent=DE_BLUE,
            bg_slug="dash-blank",
            palette=DE_PALETTE_DEFAULT,
            canvas=DE_CANVAS,
        ),
    }


def build_dual_kpi_layout() -> dict[str, Any]:
    """双栏 KPI 条 + 柱线对比（官方 sample_db 销售演示）。"""
    palette = DE_PALETTE_DEFAULT
    accent = DE_BLUE
    return {
        "version": 1,
        "widgets": [
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="kpi",
                    title="核心 KPI",
                    sql=SQL_DAILY_KPI,
                    dimensions=[{"field": "指标"}],
                    metrics=[{"field": "数值"}],
                ),
                x=0, y=0, w=12, h=KPI_ROW, order=0,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="bar",
                    title="渠道销售对比",
                    sql=SQL_SALES_BY_CHANNEL,
                    dimensions=[{"field": "渠道"}],
                    metrics=[{"field": "销售额"}],
                ),
                x=0, y=KPI_ROW, w=6, h=CHART_ROW, order=1,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="line",
                    title="销售趋势",
                    sql=SQL_SALES_TREND,
                    dimensions=[{"field": "日期"}],
                    metrics=[{"field": "销售额"}],
                ),
                x=6, y=KPI_ROW, w=6, h=CHART_ROW, order=2,
            ),
        ],
        "globalFilters": [],
        "styleConfig": build_de_dash_style(
            accent=accent,
            bg_slug="dash-dual-kpi",
            palette=palette,
            canvas=DE_CANVAS,
        ),
    }


def build_triple_analysis_layout() -> dict[str, Any]:
    """三栏：地图 + 饼图 + 明细表（官方 sample_db）。"""
    palette = DE_PALETTE_VIOLET
    accent = "#722ed1"
    return {
        "version": 1,
        "widgets": [
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="map",
                    title="区域销售分布",
                    sql=SQL_SALES_GEO_DRILL,
                    dimensions=[
                        {"field": "省份"},
                        {"field": "城市"},
                        {"field": "区县"},
                    ],
                    metrics=[{"field": "销售额"}],
                ),
                x=0, y=0, w=5, h=CHART_ROW, order=0,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="pie",
                    title="渠道结构",
                    sql=SQL_SALES_BY_CHANNEL,
                    dimensions=[{"field": "渠道"}],
                    metrics=[{"field": "销售额"}],
                ),
                x=5, y=0, w=4, h=CHART_ROW, order=1,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="table-info",
                    title="城市 TOP10",
                    sql=SQL_TOP_CITIES,
                    dimensions=[{"field": "城市"}],
                    metrics=[{"field": "销售额"}],
                ),
                x=9, y=0, w=3, h=CHART_ROW, order=2,
            ),
        ],
        "globalFilters": [],
        "styleConfig": build_de_dash_style(
            accent=accent,
            bg_slug="dash-triple",
            palette=palette,
            canvas=DE_CANVAS,
        ),
    }


def build_sales_geo_screen_layout() -> dict[str, Any]:
    """销售地理大屏：地图居中 + 两侧指标。"""
    accent = "#34d399"
    palette = ["#34d399", "#10b981", "#6ee7b7", "#22d3ee", "#38bdf8", "#a78bfa"]
    map_w = _screen_chart(
        accent=accent,
        palette=palette,
        chart_type="map",
        title="销售地理分布",
        sql=SQL_SALES_GEO_DRILL,
        dimensions=[
            {"field": "省份"},
            {"field": "城市"},
            {"field": "区县"},
        ],
        metrics=[{"field": "销售额"}],
        x=480,
        y=140,
        width=960,
        height=720,
        order=2,
    )
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": [
            _title_bar(accent=accent, x=0, y=0, width=1920, height=100, order=0),
            _clock(x=1680, y=32, width=200, height=56, order=1),
            _border("border-7", accent=accent, x=440, y=112, width=1040, height=776, order=5),
            _screen_chart(
                accent=accent,
                palette=palette,
                chart_type="bar",
                title="省份 TOP",
                sql=SQL_SALES_BY_PROVINCE,
                dimensions=[{"field": "省份"}],
                metrics=[{"field": "销售额"}],
                x=48,
                y=140,
                width=400,
                height=340,
                order=3,
            ),
            _screen_chart(
                accent=accent,
                palette=palette,
                chart_type="line",
                title="趋势",
                sql=SQL_SALES_TREND,
                dimensions=[{"field": "日期"}],
                metrics=[{"field": "销售额"}],
                x=48,
                y=520,
                width=400,
                height=340,
                order=4,
            ),
            map_w,
            _screen_chart(
                accent=accent,
                palette=palette,
                chart_type="pie",
                title="渠道",
                sql=SQL_SALES_BY_CHANNEL,
                dimensions=[{"field": "渠道"}],
                metrics=[{"field": "销售额"}],
                x=1472,
                y=140,
                width=400,
                height=340,
                order=6,
            ),
            _screen_chart(
                accent=accent,
                palette=palette,
                chart_type="bar",
                title="城市 TOP10",
                sql=SQL_TOP_CITIES,
                dimensions=[{"field": "城市"}],
                metrics=[{"field": "销售额"}],
                x=1472,
                y=520,
                width=400,
                height=340,
                order=7,
            ),
        ],
        "globalFilters": [],
        "styleConfig": _materialize_screen_style(
            accent=accent,
            canvas="#041016",
            bg_image=SCREEN_SALES_GEO_BG,
            palette_colors=palette,
        ),
    }


def build_ops_dashboard_layout() -> dict[str, Any]:
    """运营分析看板：KPI 条 + 地图/趋势/明细（官方 sample_db）。"""
    palette = DE_PALETTE_TEAL
    accent = "#13c2c2"
    body_row = KPI_ROW
    return {
        "version": 1,
        "widgets": [
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="kpi",
                    title="运营 KPI",
                    sql=SQL_DAILY_KPI,
                    dimensions=[{"field": "指标"}],
                    metrics=[{"field": "数值"}],
                ),
                x=0, y=0, w=12, h=KPI_ROW, order=0,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="map",
                    title="区域销售热力",
                    sql=SQL_SALES_GEO_DRILL,
                    dimensions=[
                        {"field": "省份"},
                        {"field": "城市"},
                        {"field": "区县"},
                    ],
                    metrics=[{"field": "销售额"}],
                ),
                x=0, y=body_row, w=7, h=CHART_ROW, order=1,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="line",
                    title="销售走势",
                    sql=SQL_SALES_TREND,
                    dimensions=[{"field": "日期"}],
                    metrics=[{"field": "销售额"}],
                ),
                x=7, y=body_row, w=5, h=CHART_ROW_SM, order=2,
            ),
            grid_place(
                _dash_chart_de(
                    accent=accent,
                    palette=palette,
                    chart_type="table-info",
                    title="城市 TOP 明细",
                    sql=SQL_TOP_CITIES,
                    dimensions=[{"field": "城市"}],
                    metrics=[{"field": "销售额"}],
                ),
                x=7, y=body_row + CHART_ROW_SM, w=5, h=CHART_ROW_SM, order=3,
            ),
        ],
        "globalFilters": [],
        "styleConfig": build_de_dash_style(
            accent=accent,
            bg_slug="dash-ops",
            palette=palette,
            canvas=DE_CANVAS,
        ),
    }
