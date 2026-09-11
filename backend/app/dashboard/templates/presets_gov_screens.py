"""政企数据大屏 L3 布局 — 主题化配色 + 官方演示数据。"""

from __future__ import annotations

from typing import Any

from app.dashboard.templates import presets_gov_sql as sql
from app.dashboard.templates.presets_gov_theme import (
    THEME_COMMUNITY,
    THEME_DIGITAL_COCKPIT,
    THEME_ECO,
    THEME_EMERGENCY,
    THEME_SMART_CITY,
    GovScreenTheme,
    build_gov_chart_de_style,
    build_gov_screen_chrome_style,
    build_gov_screen_style,
)
from app.dashboard.templates.presets import _chart, _clock, _title_bar

_L3 = {
    "left_x": 40,
    "left_w": 420,
    "center_x": 480,
    "center_w": 960,
    "right_x": 1460,
    "right_w": 420,
    "row1_y": 100,
    "row1_h": 320,
    "row2_y": 440,
    "row2_h": 320,
    "map_y": 100,
    "map_h": 660,
    "bottom_y": 780,
    "bottom_h": 260,
    "bottom_x": 40,
    "bottom_w": 1840,
}


def _gov_chart(
    *,
    theme: GovScreenTheme,
    chart_type: str,
    title: str,
    query: str,
    dimensions: list[dict[str, str]] | None = None,
    metrics: list[dict[str, str]] | None = None,
    **geo: Any,
) -> dict[str, Any]:
    return _chart(
        chart_type=chart_type,
        title=title,
        sql=query,
        dimensions=dimensions,
        metrics=metrics,
        de_style=build_gov_chart_de_style(theme, chart_type),
        **geo,
    )


def _l3_chrome(theme: GovScreenTheme) -> list[dict[str, Any]]:
    chrome_style = build_gov_screen_chrome_style(theme)
    return [
        _title_bar(
            accent=theme.accent,
            screen_style=chrome_style,
            x=0,
            y=0,
            width=1920,
            height=100,
            order=0,
        ),
        _clock(
            screen_style=chrome_style,
            x=1680,
            y=32,
            width=200,
            height=56,
            order=1,
        ),
    ]


def _screen_layout(theme: GovScreenTheme, widgets: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "version": 2,
        "canvas": {"width": 1920, "height": 1080},
        "widgets": widgets,
        "globalFilters": [],
        "styleConfig": build_gov_screen_style(theme),
    }


def build_gov_smart_city_screen() -> dict[str, Any]:
    theme = THEME_SMART_CITY
    p = _L3
    return _screen_layout(theme, [
        *_l3_chrome(theme),
        _gov_chart(theme=theme, chart_type="gauge", title="城市安全指数",
            query=sql.SQL_GOV_GAUGE_SAT, metrics=[{"field": "指数"}],
            x=p["left_x"] + 12, y=p["row1_y"] + 12, width=p["left_w"] - 24, height=p["row1_h"] - 24, order=2),
        _gov_chart(theme=theme, chart_type="bar", title="产业结构占比",
            query=sql.SQL_GOV_INVEST, dimensions=[{"field": "产业"}], metrics=[{"field": "投资额"}],
            x=p["left_x"] + 12, y=p["row2_y"] + 12, width=p["left_w"] - 24, height=p["row2_h"] - 24, order=3),
        _gov_chart(theme=theme, chart_type="map", title="全国城市运行态势",
            query=sql.SQL_GOV_REGION,
            dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}], metrics=[{"field": "服务量"}],
            x=p["center_x"] + 12, y=p["map_y"] + 12, width=p["center_w"] - 24, height=p["map_h"] - 24, order=4),
        _gov_chart(theme=theme, chart_type="word-cloud", title="部门热词",
            query=sql.SQL_GOV_HOTWORDS, dimensions=[{"field": "热词"}], metrics=[{"field": "权重"}],
            x=p["right_x"] + 12, y=p["row1_y"] + 12, width=p["right_w"] - 24, height=p["row1_h"] - 24, order=5),
        _gov_chart(theme=theme, chart_type="pie", title="事件类型",
            query=sql.SQL_GOV_INCIDENT, dimensions=[{"field": "事件类型"}], metrics=[{"field": "数量"}],
            x=p["right_x"] + 12, y=p["row2_y"] + 12, width=p["right_w"] - 24, height=p["row2_h"] - 24, order=6),
        _gov_chart(theme=theme, chart_type="table-info", title="发现问题及整改数据",
            query=sql.SQL_GOV_ISSUES, dimensions=[{"field": "问题类型"}, {"field": "地点"}],
            metrics=[{"field": "状态"}, {"field": "进度"}],
            x=p["bottom_x"] + 12, y=p["bottom_y"] + 12, width=p["bottom_w"] - 24, height=p["bottom_h"] - 24, order=7),
    ])


def build_gov_digital_cockpit_screen() -> dict[str, Any]:
    theme = THEME_DIGITAL_COCKPIT
    return _screen_layout(theme, [
        *_l3_chrome(theme),
        _gov_chart(theme=theme, chart_type="kpi", title="政务核心 KPI",
            query=sql.SQL_GOV_KPI, dimensions=[{"field": "指标"}], metrics=[{"field": "数值"}],
            x=56, y=116, width=1808, height=88, order=2),
        _gov_chart(theme=theme, chart_type="line", title="公共服务满意度走势",
            query=sql.SQL_GOV_SAT_TREND, dimensions=[{"field": "日期"}], metrics=[{"field": "满意度"}],
            x=56, y=256, width=1808, height=368, order=3),
        _gov_chart(theme=theme, chart_type="bar", title="部门效能",
            query=sql.SQL_GOV_DEPT_SAT, dimensions=[{"field": "部门"}], metrics=[{"field": "满意度"}],
            x=56, y=676, width=548, height=348, order=4),
        _gov_chart(theme=theme, chart_type="pie", title="事件类型",
            query=sql.SQL_GOV_INCIDENT, dimensions=[{"field": "事件类型"}], metrics=[{"field": "数量"}],
            x=676, y=676, width=548, height=348, order=5),
        _gov_chart(theme=theme, chart_type="gauge", title="综合满意度",
            query=sql.SQL_GOV_GAUGE_SAT, metrics=[{"field": "指数"}],
            x=1296, y=676, width=568, height=348, order=6),
    ])


def build_gov_emergency_command_screen() -> dict[str, Any]:
    theme = THEME_EMERGENCY
    p = _L3
    alert_y, alert_h = 100, 150
    main_y, main_h = 270, 490
    return _screen_layout(theme, [
        *_l3_chrome(theme),
        _gov_chart(theme=theme, chart_type="table-info", title="实时告警滚动",
            query=sql.SQL_GOV_ALERTS, dimensions=[{"field": "地点"}],
            metrics=[{"field": "内容"}, {"field": "状态"}],
            x=p["bottom_x"] + 12, y=alert_y + 12, width=p["bottom_w"] - 24, height=alert_h - 24, order=2),
        _gov_chart(theme=theme, chart_type="bar", title="事件分类",
            query=sql.SQL_GOV_INCIDENT, dimensions=[{"field": "事件类型"}], metrics=[{"field": "数量"}],
            x=p["left_x"] + 12, y=main_y + 12, width=p["left_w"] - 24, height=main_h - 24, order=3),
        _gov_chart(theme=theme, chart_type="map", title="区域态势",
            query=sql.SQL_GOV_REGION,
            dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}], metrics=[{"field": "服务量"}],
            x=p["center_x"] + 12, y=main_y + 12, width=p["center_w"] - 24, height=main_h - 24, order=4),
        _gov_chart(theme=theme, chart_type="line", title="满意度监测",
            query=sql.SQL_GOV_SAT_TREND, dimensions=[{"field": "日期"}], metrics=[{"field": "满意度"}],
            x=p["right_x"] + 12, y=main_y + 12, width=p["right_w"] - 24, height=240, order=5),
        _gov_chart(theme=theme, chart_type="pie", title="支出结构",
            query=sql.SQL_GOV_BUDGET, dimensions=[{"field": "类别"}], metrics=[{"field": "支出金额"}],
            x=p["right_x"] + 12, y=main_y + 264, width=p["right_w"] - 24, height=main_h - 276, order=6),
        _gov_chart(theme=theme, chart_type="table-info", title="网格待办",
            query=sql.SQL_GOV_GRID, dimensions=[{"field": "网格"}],
            metrics=[{"field": "事件数"}, {"field": "已办结"}],
            x=p["bottom_x"] + 12, y=p["bottom_y"] + 12, width=p["bottom_w"] - 24, height=p["bottom_h"] - 24, order=7),
    ])


def build_gov_eco_monitor_screen() -> dict[str, Any]:
    theme = THEME_ECO
    p = _L3
    return _screen_layout(theme, [
        *_l3_chrome(theme),
        _gov_chart(theme=theme, chart_type="gauge", title="水质达标率",
            query=sql.SQL_GOV_GAUGE_WATER, metrics=[{"field": "指数"}],
            x=p["left_x"] + 12, y=p["row1_y"] + 12, width=p["left_w"] - 24, height=p["row1_h"] - 24, order=2),
        _gov_chart(theme=theme, chart_type="bar", title="监测站点",
            query=sql.SQL_GOV_ECO, dimensions=[{"field": "监测点"}], metrics=[{"field": "指数"}],
            x=p["left_x"] + 12, y=p["row2_y"] + 12, width=p["left_w"] - 24, height=p["row2_h"] - 24, order=3),
        _gov_chart(theme=theme, chart_type="line", title="AQI 趋势",
            query=sql.SQL_GOV_ECO_TREND, dimensions=[{"field": "日期"}], metrics=[{"field": "指数"}],
            x=p["center_x"] + 12, y=p["map_y"] + 12, width=p["center_w"] - 24, height=p["map_h"] - 24, order=4),
        _gov_chart(theme=theme, chart_type="map", title="区域生态指数",
            query=sql.SQL_GOV_REGION,
            dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}], metrics=[{"field": "服务量"}],
            x=p["right_x"] + 12, y=p["row1_y"] + 12, width=p["right_w"] - 24, height=p["row1_h"] - 24, order=5),
        _gov_chart(theme=theme, chart_type="pie", title="支出结构",
            query=sql.SQL_GOV_BUDGET, dimensions=[{"field": "类别"}], metrics=[{"field": "支出金额"}],
            x=p["right_x"] + 12, y=p["row2_y"] + 12, width=p["right_w"] - 24, height=p["row2_h"] - 24, order=6),
        _gov_chart(theme=theme, chart_type="table-info", title="生态问题清单",
            query=sql.SQL_GOV_ISSUES, dimensions=[{"field": "问题类型"}, {"field": "地点"}],
            metrics=[{"field": "状态"}, {"field": "进度"}],
            x=p["bottom_x"] + 12, y=p["bottom_y"] + 12, width=p["bottom_w"] - 24, height=p["bottom_h"] - 24, order=7),
    ])


def build_gov_community_screen() -> dict[str, Any]:
    theme = THEME_COMMUNITY
    p = _L3
    return _screen_layout(theme, [
        *_l3_chrome(theme),
        _gov_chart(theme=theme, chart_type="table-info", title="网格事件明细",
            query=sql.SQL_GOV_GRID, dimensions=[{"field": "网格"}],
            metrics=[{"field": "事件数"}, {"field": "已办结"}],
            x=p["left_x"] + 12, y=p["map_y"] + 12, width=p["left_w"] - 24, height=p["map_h"] - 24, order=2),
        _gov_chart(theme=theme, chart_type="word-cloud", title="治理热词",
            query=sql.SQL_GOV_HOTWORDS, dimensions=[{"field": "热词"}], metrics=[{"field": "权重"}],
            x=p["center_x"] + 12, y=p["map_y"] + 12, width=p["center_w"] - 24, height=400, order=3),
        _gov_chart(theme=theme, chart_type="bar", title="部门服务满意度",
            query=sql.SQL_GOV_DEPT_SAT, dimensions=[{"field": "部门"}], metrics=[{"field": "满意度"}],
            x=p["center_x"] + 12, y=p["map_y"] + 424, width=p["center_w"] - 24, height=224, order=4),
        _gov_chart(theme=theme, chart_type="gauge", title="综合满意度",
            query=sql.SQL_GOV_GAUGE_SAT, metrics=[{"field": "指数"}],
            x=p["right_x"] + 12, y=p["map_y"] + 12, width=p["right_w"] - 24, height=400, order=5),
        _gov_chart(theme=theme, chart_type="pie", title="事件类型",
            query=sql.SQL_GOV_INCIDENT, dimensions=[{"field": "事件类型"}], metrics=[{"field": "数量"}],
            x=p["right_x"] + 12, y=p["map_y"] + 424, width=p["right_w"] - 24, height=224, order=6),
        _gov_chart(theme=theme, chart_type="line", title="满意度变化",
            query=sql.SQL_GOV_SAT_TREND, dimensions=[{"field": "日期"}], metrics=[{"field": "满意度"}],
            x=p["bottom_x"] + 12, y=p["bottom_y"] + 12, width=p["bottom_w"] - 24, height=p["bottom_h"] - 24, order=7),
    ])
