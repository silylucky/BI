"""官方演示 SQL 注册表 — 内置可视化模板唯一数据源契约。

规则：
1. 内置模板 chart widget 须使用 ``TEMPLATE_DEMO_DATASOURCE_REF``（``__demo:sample_db__``）。
2. SQL 须来自本模块（政务域见 ``DOMAIN_GOV`` 分区）。
3. 禁止新增第二演示库或硬编码 UUID 数据源。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------------------
# 政务域 SQL（政企模板 · 列别名中文）
# ---------------------------------------------------------------------------

SQL_GOV_KPI = (
    "SELECT metric_name AS 指标, AVG(value) AS 数值\n"
    "FROM gov_service_metrics\n"
    "WHERE metric_code IN ('cases_handled', 'online_rate', 'response_time')\n"
    "  AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)\n"
    "GROUP BY metric_name"
)
SQL_GOV_DEPT_SAT = (
    "SELECT department AS 部门, AVG(value) AS 满意度\n"
    "FROM gov_service_metrics\n"
    "WHERE metric_code = 'satisfaction'\n"
    "GROUP BY department\n"
    "ORDER BY 满意度 DESC"
)
SQL_GOV_SAT_TREND = (
    "SELECT stat_date AS 日期, AVG(value) AS 满意度\n"
    "FROM gov_service_metrics\n"
    "WHERE metric_code = 'satisfaction'\n"
    "GROUP BY stat_date\n"
    "ORDER BY 日期"
)
SQL_GOV_GAUGE_SAT = (
    "SELECT ROUND(AVG(value), 1) AS 指数\n"
    "FROM gov_service_metrics\n"
    "WHERE metric_code = 'satisfaction'"
)
SQL_GOV_GAUGE_WATER = (
    "SELECT ROUND(AVG(index_value), 1) AS 指数\n"
    "FROM gov_eco_monitor\n"
    "WHERE index_code = 'water'\n"
    "  AND monitor_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
)
SQL_GOV_BUDGET = (
    "SELECT category AS 类别, spent_amount AS 支出金额\n"
    "FROM gov_budget_items\n"
    "WHERE fiscal_year = YEAR(CURDATE())\n"
    "ORDER BY 支出金额 DESC"
)
SQL_GOV_BUDGET_COMPARE = (
    "SELECT category AS 类别, budget_amount AS 预算, spent_amount AS 已支出\n"
    "FROM gov_budget_items\n"
    "WHERE fiscal_year = YEAR(CURDATE())"
)
SQL_GOV_INCIDENT = (
    "SELECT incident_type AS 事件类型, SUM(count) AS 数量\n"
    "FROM gov_incidents\n"
    "GROUP BY incident_type\n"
    "ORDER BY 数量 DESC"
)
SQL_GOV_REGION = (
    "SELECT province AS 省份, city AS 城市, district AS 区县, SUM(service_volume) AS 服务量\n"
    "FROM v_gov_region_service\n"
    "GROUP BY province, city, district"
)
SQL_GOV_GRID = (
    "SELECT grid_name AS 网格, event_count AS 事件数, resolved_count AS 已办结\n"
    "FROM gov_grid_stats\n"
    "ORDER BY 事件数 DESC\n"
    "LIMIT 10"
)
SQL_GOV_INVEST = (
    "SELECT industry AS 产业, SUM(investment_amount) AS 投资额\n"
    "FROM gov_investment\n"
    "GROUP BY industry\n"
    "ORDER BY 投资额 DESC"
)
SQL_GOV_ECO = (
    "SELECT monitor_point AS 监测点, AVG(index_value) AS 指数\n"
    "FROM gov_eco_monitor\n"
    "WHERE monitor_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)\n"
    "GROUP BY monitor_point"
)
SQL_GOV_ECO_TREND = (
    "SELECT monitor_date AS 日期, AVG(index_value) AS 指数\n"
    "FROM gov_eco_monitor\n"
    "WHERE index_code = 'aqi'\n"
    "  AND monitor_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)\n"
    "GROUP BY monitor_date\n"
    "ORDER BY 日期"
)
SQL_GOV_HOTWORDS = (
    "SELECT word AS 热词, weight AS 权重\n"
    "FROM gov_hotwords\n"
    "ORDER BY 权重 DESC\n"
    "LIMIT 20"
)
SQL_GOV_ISSUES = (
    "SELECT issue_type AS 问题类型, location AS 地点, unit AS 责任单位, "
    "status AS 状态, progress AS 进度\n"
    "FROM gov_issues\n"
    "ORDER BY seq\n"
    "LIMIT 10"
)
SQL_GOV_ALERTS = (
    "SELECT alert_time AS 告警时间, location AS 地点, content AS 内容, status AS 状态\n"
    "FROM gov_alerts\n"
    "ORDER BY sort_order\n"
    "LIMIT 8"
)

# ---------------------------------------------------------------------------
# 销售 BI 域（presets 兼容别名）
# ---------------------------------------------------------------------------

SQL_SALES_BY_PROVINCE = (
    "SELECT province AS 省份, SUM(amount) AS 销售额\n"
    "FROM de_sales_wide\n"
    "GROUP BY province"
)
SQL_SALES_TREND = (
    "SELECT sale_date AS 日期, SUM(amount) AS 销售额\n"
    "FROM de_sales_wide\n"
    "GROUP BY sale_date\n"
    "ORDER BY 日期"
)
SQL_SALES_BY_CHANNEL = (
    "SELECT channel AS 渠道, SUM(amount) AS 销售额\n"
    "FROM de_sales_wide\n"
    "GROUP BY channel"
)
SQL_SALES_GEO_DRILL = (
    "SELECT province AS 省份, city AS 城市, district AS 区县, SUM(amount) AS 销售额\n"
    "FROM de_sales_wide\n"
    "GROUP BY province, city, district"
)
SQL_DAILY_KPI = (
    "SELECT metric_name AS 指标, AVG(value) AS 数值\n"
    "FROM daily_kpi\n"
    "WHERE stat_date >= '2025-01-01'\n"
    "GROUP BY metric_name"
)
SQL_TOP_CITIES = (
    "SELECT city AS 城市, SUM(amount) AS 销售额\n"
    "FROM de_sales_wide\n"
    "GROUP BY city\n"
    "ORDER BY 销售额 DESC\n"
    "LIMIT 10"
)


@dataclass(frozen=True)
class OfficialDemoChartQuery:
    chart_type: str
    title: str
    sql: str
    dimensions: tuple[dict[str, str], ...] = ()
    metrics: tuple[dict[str, str], ...] = ()


def _dim(field: str) -> dict[str, str]:
    return {"field": field}


def _met(field: str) -> dict[str, str]:
    return {"field": field}


def _q(
    chart_type: str,
    title: str,
    sql: str,
    *,
    dimensions: tuple[str, ...] = (),
    metrics: tuple[str, ...] = (),
) -> OfficialDemoChartQuery:
    return OfficialDemoChartQuery(
        chart_type=chart_type,
        title=title,
        sql=sql.strip(),
        dimensions=tuple(_dim(f) for f in dimensions),
        metrics=tuple(_met(f) for f in metrics),
    )


def _build_official_chart_queries() -> dict[str, OfficialDemoChartQuery]:
    cartesian_date = _q(
        "line",
        "销售趋势",
        SQL_SALES_TREND,
        dimensions=("日期",),
        metrics=("销售额",),
    )
    cartesian_region = _q(
        "bar",
        "省份销售",
        SQL_SALES_BY_PROVINCE,
        dimensions=("省份",),
        metrics=("销售额",),
    )
    cartesian_channel = _q(
        "bar-horizontal",
        "渠道销售",
        SQL_SALES_BY_CHANNEL,
        dimensions=("渠道",),
        metrics=("销售额",),
    )
    stack_region_channel = (
        "SELECT province AS 省份, channel AS 渠道, SUM(amount) AS 销售额\n"
        "FROM de_sales_wide\n"
        "GROUP BY province, channel"
    )
    stack_date_category = (
        "SELECT sale_date AS 日期, category_name AS 类别, SUM(amount) AS 销售额\n"
        "FROM de_sales_wide\n"
        "GROUP BY sale_date, category_name\n"
        "ORDER BY 日期"
    )
    group_date_channel = (
        "SELECT sale_date AS 日期, channel AS 渠道, SUM(amount) AS 销售额\n"
        "FROM de_sales_wide\n"
        "GROUP BY sale_date, channel\n"
        "ORDER BY 日期"
    )
    mix_date = (
        "SELECT sale_date AS 日期, SUM(amount) AS 销售额, SUM(quantity) AS 销量\n"
        "FROM de_sales_wide\n"
        "GROUP BY sale_date\n"
        "ORDER BY 日期"
    )
    mix_group = (
        "SELECT sale_date AS 日期, channel AS 渠道, SUM(amount) AS 销售额, SUM(quantity) AS 销量\n"
        "FROM de_sales_wide\n"
        "GROUP BY sale_date, channel\n"
        "ORDER BY 日期"
    )
    radar_sql = (
        "SELECT province AS 地区,\n"
        "  SUM(CASE WHEN channel = '电商平台' THEN amount ELSE 0 END) AS 电商,\n"
        "  SUM(CASE WHEN channel = '线下门店' THEN amount ELSE 0 END) AS 线下,\n"
        "  SUM(CASE WHEN channel = '企业直销' THEN amount ELSE 0 END) AS 直销\n"
        "FROM de_sales_wide\n"
        "GROUP BY province"
    )
    pivot_sql = (
        "SELECT province AS 行维度, channel AS 列维度, SUM(amount) AS 销售额\n"
        "FROM de_sales_wide\n"
        "GROUP BY province, channel"
    )
    table_normal_sql = (
        "SELECT province AS 省份, channel AS 渠道, SUM(amount) AS 销售额\n"
        "FROM de_sales_wide\n"
        "GROUP BY province, channel"
    )
    table_info_sql = (
        "SELECT order_no AS 订单号, customer_name AS 客户, order_date AS 日期,\n"
        "       order_status AS 状态, order_amount AS 金额, province_name AS 省份\n"
        "FROM vs_official_order_detail\n"
        "ORDER BY 日期 DESC\n"
        "LIMIT 20"
    )
    map_sql = (
        "SELECT region_map AS 省份, amount AS 销售额\n"
        "FROM de_map_province"
    )
    gis_map_scatter_sql = (
        "SELECT point_name, lng, lat, amount, province, city\n"
        "FROM de_map_heat\n"
        "WHERE lng IS NOT NULL AND lat IS NOT NULL\n"
        "LIMIT 500"
    )
    pie_sql = (
        "SELECT region_name AS 地区, total_amount AS 销售额\n"
        "FROM vs_official_region_share"
    )
    entries: list[OfficialDemoChartQuery] = [
        _q("line", "折线图", cartesian_date.sql, dimensions=("日期",), metrics=("销售额",)),
        _q("area", "面积图", cartesian_date.sql, dimensions=("日期",), metrics=("销售额",)),
        _q(
            "area-stack",
            "堆叠面积图",
            stack_date_category,
            dimensions=("日期", "类别"),
            metrics=("销售额",),
        ),
        _q("bar", "柱状图", cartesian_region.sql, dimensions=("省份",), metrics=("销售额",)),
        _q(
            "bar-stack",
            "堆叠柱状图",
            stack_region_channel,
            dimensions=("省份", "渠道"),
            metrics=("销售额",),
        ),
        _q(
            "percentage-bar-stack",
            "百分比柱状图",
            stack_region_channel,
            dimensions=("省份", "渠道"),
            metrics=("销售额",),
        ),
        _q(
            "bar-group",
            "分组柱状图",
            group_date_channel,
            dimensions=("日期", "渠道"),
            metrics=("销售额",),
        ),
        _q(
            "bar-group-stack",
            "分组堆叠柱状图",
            stack_date_category,
            dimensions=("日期", "类别"),
            metrics=("销售额",),
        ),
        _q(
            "waterfall",
            "瀑布图",
            "SELECT step_name AS 步骤, step_value AS 数值 FROM vs_official_waterfall",
            dimensions=("步骤",),
            metrics=("数值",),
        ),
        _q("bar-horizontal", "条形图", cartesian_channel.sql, dimensions=("渠道",), metrics=("销售额",)),
        _q(
            "bar-stack-horizontal",
            "堆叠条形图",
            stack_region_channel,
            dimensions=("省份", "渠道"),
            metrics=("销售额",),
        ),
        _q(
            "percentage-bar-stack-horizontal",
            "百分比条形图",
            stack_region_channel,
            dimensions=("省份", "渠道"),
            metrics=("销售额",),
        ),
        _q(
            "bar-range",
            "区间条形图",
            "SELECT range_region AS 地区, range_min AS 下限, range_max AS 上限\n"
            "FROM vs_official_bar_range",
            dimensions=("地区",),
            metrics=("下限", "上限"),
        ),
        _q(
            "bidirectional-bar",
            "对称条形图",
            "SELECT dept_name AS 部门, positive_value AS 正向, negative_value AS 负向\n"
            "FROM vs_official_bidirectional",
            dimensions=("部门",),
            metrics=("正向", "负向"),
        ),
        _q(
            "progress-bar",
            "进度条",
            "SELECT progress_name AS 项目, actual_value AS 实际, target_value AS 目标\n"
            "FROM vs_official_progress",
            dimensions=("项目",),
            metrics=("实际", "目标"),
        ),
        _q(
            "stock-line",
            "K 线图",
            "SELECT trade_date AS 日期, open_price AS 开盘, close_price AS 收盘,\n"
            "       low_price AS 最低, high_price AS 最高\n"
            "FROM vs_official_stock_ohlc",
            dimensions=("日期",),
            metrics=("开盘", "收盘", "最低", "最高"),
        ),
        _q(
            "bullet-graph",
            "子弹图",
            "SELECT bullet_category AS 类别, actual_value AS 实际, target_value AS 目标\n"
            "FROM vs_official_bullet",
            dimensions=("类别",),
            metrics=("实际", "目标"),
        ),
        _q("pie", "饼图", pie_sql, dimensions=("地区",), metrics=("销售额",)),
        _q("pie-donut", "环形图", pie_sql, dimensions=("地区",), metrics=("销售额",)),
        _q("pie-rose", "玫瑰图", pie_sql, dimensions=("地区",), metrics=("销售额",)),
        _q("pie-donut-rose", "玫瑰环形图", pie_sql, dimensions=("地区",), metrics=("销售额",)),
        _q(
            "radar",
            "雷达图",
            radar_sql,
            dimensions=("地区",),
            metrics=("电商", "线下", "直销"),
        ),
        _q(
            "treemap",
            "矩形树图",
            "SELECT parent_category AS 一级类别, child_name AS 二级名称, tree_amount AS 销售额\n"
            "FROM vs_official_category_tree",
            dimensions=("一级类别", "二级名称"),
            metrics=("销售额",),
        ),
        _q(
            "word-cloud",
            "词云图",
            "SELECT word_text AS 热词, word_weight AS 权重 FROM vs_official_word",
            dimensions=("热词",),
            metrics=("权重",),
        ),
        _q(
            "scatter",
            "散点图",
            "SELECT product_name AS 产品, unit_price AS 单价, sale_qty AS 销量\n"
            "FROM vs_official_scatter",
            dimensions=("产品",),
            metrics=("单价", "销量"),
        ),
        _q(
            "quadrant",
            "象限图",
            "SELECT product_name AS 产品, unit_price AS 单价, sale_qty AS 销量\n"
            "FROM vs_official_scatter",
            dimensions=("产品",),
            metrics=("单价", "销量"),
        ),
        _q(
            "funnel",
            "漏斗图",
            "SELECT funnel_stage AS 阶段, stage_count AS 数量 FROM vs_official_funnel",
            dimensions=("阶段",),
            metrics=("数量",),
        ),
        _q(
            "sankey",
            "桑基图",
            "SELECT flow_source AS 起始, flow_target AS 终点, flow_weight AS 权重\n"
            "FROM vs_official_flow",
            dimensions=("起始", "终点"),
            metrics=("权重",),
        ),
        _q(
            "circle-packing",
            "圆形填充图",
            "SELECT parent_category AS 一级类别, child_name AS 二级名称, tree_amount AS 销售额\n"
            "FROM vs_official_category_tree",
            dimensions=("一级类别", "二级名称"),
            metrics=("销售额",),
        ),
        _q(
            "multi-scatter",
            "多维散点图",
            "SELECT product_name AS 产品, category_name AS 类别, unit_price AS 单价, sale_qty AS 销量\n"
            "FROM vs_official_scatter",
            dimensions=("产品", "类别"),
            metrics=("单价", "销量"),
        ),
        _q(
            "graph",
            "关系图",
            "SELECT graph_source AS 源节点, graph_target AS 目标节点, edge_weight AS 权重\n"
            "FROM vs_official_graph_edges",
            dimensions=("源节点", "目标节点"),
            metrics=("权重",),
        ),
        _q("map", "区域地图", map_sql, dimensions=("省份",), metrics=("销售额",)),
        _q("map-3d", "3D 区域地图", map_sql, dimensions=("省份",), metrics=("销售额",)),
        _q(
            "gis-map",
            "GIS 地图",
            gis_map_scatter_sql,
            dimensions=("lng", "lat", "point_name"),
            metrics=("amount",),
        ),
        _q("table-info", "明细表", table_info_sql),
        _q(
            "table-normal",
            "汇总表",
            table_normal_sql,
            dimensions=("省份", "渠道"),
            metrics=("销售额",),
        ),
        _q(
            "table-pivot",
            "透视表",
            pivot_sql,
            dimensions=("行维度", "列维度"),
            metrics=("销售额",),
        ),
        _q(
            "t-heatmap",
            "矩阵热力图",
            "SELECT x_dim AS 横轴, y_dim AS 纵轴, heat_value AS 数值\n"
            "FROM vs_official_matrix_heat",
            dimensions=("横轴", "纵轴"),
            metrics=("数值",),
        ),
        _q(
            "gauge",
            "仪表盘",
            "SELECT gauge_value AS 达成率 FROM vs_official_gauge",
            metrics=("达成率",),
        ),
        _q(
            "liquid",
            "水波图",
            "SELECT gauge_value AS 达成率 FROM vs_official_gauge",
            metrics=("达成率",),
        ),
        _q(
            "kpi",
            "指标卡",
            "SELECT ROUND(AVG(value), 0) AS 成交额\n"
            "FROM daily_kpi WHERE metric_code = 'gmv'",
            metrics=("成交额",),
        ),
        _q(
            "chart-mix",
            "柱线组合图",
            mix_date,
            dimensions=("日期",),
            metrics=("销售额", "销量"),
        ),
        _q(
            "chart-mix-group",
            "分组柱线组合图",
            mix_group,
            dimensions=("日期", "渠道"),
            metrics=("销售额", "销量"),
        ),
        _q(
            "chart-mix-stack",
            "堆叠柱线组合图",
            stack_date_category,
            dimensions=("日期", "类别"),
            metrics=("销售额",),
        ),
        _q(
            "chart-mix-dual-line",
            "双线组合图",
            mix_date,
            dimensions=("日期",),
            metrics=("销售额", "销量"),
        ),
    ]
    return {item.chart_type: item for item in entries}


OFFICIAL_DEMO_CHART_QUERIES: dict[str, OfficialDemoChartQuery] = _build_official_chart_queries()


def get_official_sql(chart_type: str) -> OfficialDemoChartQuery:
    try:
        return OFFICIAL_DEMO_CHART_QUERIES[chart_type]
    except KeyError as exc:
        raise KeyError(f"official demo SQL not registered for chart type: {chart_type}") from exc


def all_covered_chart_types() -> frozenset[str]:
    return frozenset(OFFICIAL_DEMO_CHART_QUERIES.keys())


def chart_query_binding(query: OfficialDemoChartQuery) -> dict[str, Any]:
    out: dict[str, Any] = {"sql": query.sql}
    if query.dimensions:
        out["dimensions"] = [dict(d) for d in query.dimensions]
    if query.metrics:
        out["metrics"] = [dict(m) for m in query.metrics]
    return out
