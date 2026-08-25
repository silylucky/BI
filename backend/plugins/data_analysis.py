from plugins.base import BasePlugin


class DataAnalysisPlugin(BasePlugin):
    """数据分析插件 - 对查询结果进行统计分析"""

    @property
    def name(self) -> str:
        return "analyze_data"

    @property
    def description(self) -> str:
        return (
            "对数据集进行分析统计。支持求和、平均值、最大值、最小值、计数、分组统计。"
            "通常配合 query_database 的结果使用。"
        )

    @property
    def parameters(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "data": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "要分析的数据集（来自 SQL 查询结果的 rows 字段）"
                },
                "operation": {
                    "type": "string",
                    "enum": ["sum", "avg", "max", "min", "count", "group_by"],
                    "description": "分析操作类型"
                },
                "field": {
                    "type": "string",
                    "description": "要分析的数值字段名"
                },
                "group_field": {
                    "type": "string",
                    "description": "分组字段名（仅 group_by 操作时需要）"
                }
            },
            "required": ["data", "operation", "field"]
        }

    def execute(self, data: list, operation: str, field: str, group_field: str = None) -> dict:
        if not data:
            return {"error": "数据集为空"}

        values = []
        for row in data:
            v = row.get(field)
            if v is not None:
                try:
                    values.append(float(v))
                except (ValueError, TypeError):
                    pass

        if operation == "sum":
            return {"operation": "sum", "field": field, "result": sum(values)}
        elif operation == "avg":
            return {"operation": "avg", "field": field, "result": sum(values) / len(values) if values else 0}
        elif operation == "max":
            return {"operation": "max", "field": field, "result": max(values) if values else None}
        elif operation == "min":
            return {"operation": "min", "field": field, "result": min(values) if values else None}
        elif operation == "count":
            return {"operation": "count", "field": field, "result": len(values)}
        elif operation == "group_by":
            if not group_field:
                return {"error": "group_by 操作需要提供 group_field 参数"}
            groups = {}
            for row in data:
                key = str(row.get(group_field, "unknown"))
                v = row.get(field)
                if v is not None:
                    try:
                        groups.setdefault(key, []).append(float(v))
                    except (ValueError, TypeError):
                        pass
            return {
                "operation": "group_by",
                "field": field,
                "group_field": group_field,
                "result": {k: sum(v) for k, v in groups.items()}
            }
        else:
            return {"error": f"不支持的操作类型: {operation}"}
