from plugins.base import BasePlugin


class ChartGeneratorPlugin(BasePlugin):
    """图表生成插件 - 返回 ECharts 配置供前端渲染"""

    @property
    def name(self) -> str:
        return "generate_chart"

    @property
    def description(self) -> str:
        return (
            "根据数据生成可视化图表配置，支持柱状图(bar)、折线图(line)、饼图(pie)。"
            "返回 ECharts option 配置，前端直接渲染。"
            "通常配合 query_database 的结果使用。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "pie"],
                    "description": "图表类型"
                },
                "title": {
                    "type": "string",
                    "description": "图表标题"
                },
                "x_field": {
                    "type": "string",
                    "description": "X轴/分类字段名"
                },
                "y_field": {
                    "type": "string",
                    "description": "Y轴/数值字段名"
                },
                "data": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "数据集（来自 SQL 查询结果的 rows 字段）"
                }
            },
            "required": ["chart_type", "x_field", "y_field", "data"]
        }

    def execute(self, chart_type: str, x_field: str, y_field: str, data: list, title: str = "") -> dict:
        if not data:
            return {"error": "数据集为空，无法生成图表"}

        x_data = [str(row.get(x_field, "")) for row in data]
        y_data = []
        for row in data:
            v = row.get(y_field)
            try:
                y_data.append(float(v) if v is not None else 0)
            except (ValueError, TypeError):
                y_data.append(0)

        if chart_type == "pie":
            option = {
                "title": {"text": title, "left": "center"},
                "tooltip": {"trigger": "item", "formatter": "{b}: {c} ({d}%)"},
                "legend": {"orient": "vertical", "left": "left"},
                "series": [{
                    "name": title,
                    "type": "pie",
                    "radius": "60%",
                    "data": [
                        {"name": x_data[i], "value": y_data[i]}
                        for i in range(len(x_data))
                    ],
                    "emphasis": {
                        "itemStyle": {
                            "shadowBlur": 10,
                            "shadowOffsetX": 0,
                            "shadowColor": "rgba(0, 0, 0, 0.5)"
                        }
                    }
                }]
            }
        else:
            # bar / line 通用配置
            option = {
                "title": {"text": title, "left": "center"},
                "tooltip": {"trigger": "axis"},
                "grid": {"left": "10%", "right": "10%", "bottom": "15%", "containLabel": True},
                "xAxis": {
                    "type": "category",
                    "data": x_data,
                    "axisLabel": {"rotate": x_data and len(x_data[0]) > 4 and len(x_data) > 5 and 30 or 0}
                },
                "yAxis": {"type": "value"},
                "series": [{
                    "name": y_field,
                    "type": chart_type,
                    "data": y_data,
                    "itemStyle": {"borderRadius": [4, 4, 0, 0]} if chart_type == "bar" else {},
                }]
            }

        return {
            "chart_type": chart_type,
            "title": title,
            "echarts_option": option
        }
