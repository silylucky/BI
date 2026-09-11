"""政企风格内置模板：5 套数据大屏 + 5 套仪表板。"""

from __future__ import annotations

from typing import Any

from app.dashboard.templates import presets_gov_sql as sql
from app.dashboard.templates.presets import _chart
from app.dashboard.templates.presets_dash_grids import (
    CHART_ROW,
    CHART_ROW_SM,
    KPI_ROW,
    METRIC_ROW,
    grid_place,
)
from app.dashboard.templates.presets_gov_theme import (
    THEME_EFFICIENCY,
    THEME_FINANCE,
    THEME_GRID,
    THEME_INVESTMENT,
    THEME_SATISFACTION,
    GovDashTheme,
    build_gov_chart_de_style,
    build_gov_dash_style,
)
from app.dashboard.templates.presets_gov_screens import (
    build_gov_community_screen,
    build_gov_digital_cockpit_screen,
    build_gov_eco_monitor_screen,
    build_gov_emergency_command_screen,
    build_gov_smart_city_screen,
)

__all__ = [
    "build_gov_smart_city_screen",
    "build_gov_digital_cockpit_screen",
    "build_gov_emergency_command_screen",
    "build_gov_eco_monitor_screen",
    "build_gov_community_screen",
    "build_gov_efficiency_dashboard",
    "build_gov_satisfaction_dashboard",
    "build_gov_finance_dashboard",
    "build_gov_investment_dashboard",
    "build_gov_grid_dashboard",
]


def _gov_dash_chart(
    theme: GovDashTheme,
    chart_type: str,
    title: str,
    sql: str,
    dimensions: list[dict[str, str]] | None = None,
    metrics: list[dict[str, str]] | None = None,
    **geo: Any,
) -> dict[str, Any]:
    resolved_metrics = metrics
    if chart_type == "gauge" and not resolved_metrics:
        resolved_metrics = [{"field": "指数"}]
    return _chart(
        chart_type=chart_type,
        title=title,
        sql=sql,
        dimensions=dimensions,
        metrics=resolved_metrics,
        de_style=build_gov_chart_de_style(theme, chart_type),
        **geo,
    )


def _dash_layout(theme: GovDashTheme, widgets: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "version": 1,
        "widgets": widgets,
        "globalFilters": [],
        "styleConfig": build_gov_dash_style(theme),
    }


def build_gov_efficiency_dashboard() -> dict[str, Any]:
    """顶行 2 仪表 + KPI 条；下行柱线双图（官方 gov_service_metrics）。"""
    theme = THEME_EFFICIENCY
    return _dash_layout(theme, [
        grid_place(
            _gov_dash_chart(theme=theme, chart_type="gauge", title="综合满意度", sql=sql.SQL_GOV_GAUGE_SAT),
            x=0, y=0, w=3, h=METRIC_ROW, order=0,
        ),
        grid_place(
            _gov_dash_chart(theme=theme, chart_type="gauge", title="水质达标率", sql=sql.SQL_GOV_GAUGE_WATER),
            x=3, y=0, w=3, h=METRIC_ROW, order=1,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="kpi", title="政务核心指标",
                sql=sql.SQL_GOV_KPI,
                dimensions=[{"field": "指标"}], metrics=[{"field": "数值"}],
            ),
            x=6, y=0, w=6, h=METRIC_ROW, order=2,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="bar", title="部门满意度",
                sql=sql.SQL_GOV_DEPT_SAT,
                dimensions=[{"field": "部门"}], metrics=[{"field": "满意度"}],
            ),
            x=0, y=METRIC_ROW, w=7, h=CHART_ROW, order=3,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="line", title="满意度趋势",
                sql=sql.SQL_GOV_SAT_TREND,
                dimensions=[{"field": "日期"}], metrics=[{"field": "满意度"}],
            ),
            x=7, y=METRIC_ROW, w=5, h=CHART_ROW, order=4,
        ),
    ])


def build_gov_satisfaction_dashboard() -> dict[str, Any]:
    """三栏：区域地图 + 事件饼图 + 网格明细（官方演示库）。"""
    theme = THEME_SATISFACTION
    return _dash_layout(theme, [
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="map", title="服务区域分布",
                sql=sql.SQL_GOV_REGION,
                dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}],
                metrics=[{"field": "服务量"}],
            ),
            x=0, y=0, w=5, h=CHART_ROW, order=0,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="pie", title="事件类型占比",
                sql=sql.SQL_GOV_INCIDENT,
                dimensions=[{"field": "事件类型"}], metrics=[{"field": "数量"}],
            ),
            x=5, y=0, w=4, h=CHART_ROW, order=1,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="table-info", title="网格服务 TOP10",
                sql=sql.SQL_GOV_GRID,
                dimensions=[{"field": "网格"}],
                metrics=[{"field": "事件数"}, {"field": "已办结"}],
            ),
            x=9, y=0, w=3, h=CHART_ROW, order=2,
        ),
    ])


def build_gov_finance_dashboard() -> dict[str, Any]:
    """KPI 条 + 地图/支出柱图双栏 + 预算明细表（官方 gov_budget）。"""
    theme = THEME_FINANCE
    body_row = KPI_ROW
    return _dash_layout(theme, [
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="kpi", title="财政运行 KPI",
                sql=sql.SQL_GOV_KPI,
                dimensions=[{"field": "指标"}], metrics=[{"field": "数值"}],
            ),
            x=0, y=0, w=12, h=KPI_ROW, order=0,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="map", title="区域服务热力",
                sql=sql.SQL_GOV_REGION,
                dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}],
                metrics=[{"field": "服务量"}],
            ),
            x=0, y=body_row, w=7, h=CHART_ROW, order=1,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="bar", title="分类支出执行",
                sql=sql.SQL_GOV_BUDGET,
                dimensions=[{"field": "类别"}], metrics=[{"field": "支出金额"}],
            ),
            x=7, y=body_row, w=5, h=CHART_ROW_SM, order=2,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="table-info", title="预算执行对比",
                sql=sql.SQL_GOV_BUDGET_COMPARE,
                dimensions=[{"field": "类别"}],
                metrics=[{"field": "预算"}, {"field": "已支出"}],
            ),
            x=7, y=body_row + CHART_ROW_SM, w=5, h=CHART_ROW_SM, order=3,
        ),
    ])


def build_gov_investment_dashboard() -> dict[str, Any]:
    """地图 + 产业柱图双栏；底行 KPI 条（官方 gov_investment / region）。"""
    theme = THEME_INVESTMENT
    return _dash_layout(theme, [
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="map", title="招商区域分布",
                sql=sql.SQL_GOV_REGION,
                dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}],
                metrics=[{"field": "服务量"}],
            ),
            x=0, y=0, w=7, h=CHART_ROW, order=0,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="bar", title="产业投资额",
                sql=sql.SQL_GOV_INVEST,
                dimensions=[{"field": "产业"}], metrics=[{"field": "投资额"}],
            ),
            x=7, y=0, w=5, h=CHART_ROW, order=1,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="kpi", title="招商核心指标",
                sql=sql.SQL_GOV_KPI,
                dimensions=[{"field": "指标"}], metrics=[{"field": "数值"}],
            ),
            x=0, y=CHART_ROW, w=12, h=KPI_ROW, order=2,
        ),
    ])


def build_gov_grid_dashboard() -> dict[str, Any]:
    """台账 + 地图 + 分类柱图三栏（官方 gov_grid / incidents）。"""
    theme = THEME_GRID
    return _dash_layout(theme, [
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="table-info", title="网格事件台账",
                sql=sql.SQL_GOV_GRID,
                dimensions=[{"field": "网格"}],
                metrics=[{"field": "事件数"}, {"field": "已办结"}],
            ),
            x=0, y=0, w=4, h=CHART_ROW, order=0,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="map", title="区域事件热力",
                sql=sql.SQL_GOV_REGION,
                dimensions=[{"field": "省份"}, {"field": "城市"}, {"field": "区县"}],
                metrics=[{"field": "服务量"}],
            ),
            x=4, y=0, w=5, h=CHART_ROW, order=1,
        ),
        grid_place(
            _gov_dash_chart(
                theme=theme, chart_type="bar", title="事件类型分布",
                sql=sql.SQL_GOV_INCIDENT,
                dimensions=[{"field": "事件类型"}], metrics=[{"field": "数量"}],
            ),
            x=9, y=0, w=3, h=CHART_ROW, order=2,
        ),
    ])
