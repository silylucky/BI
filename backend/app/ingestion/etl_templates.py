"""同步任务内置 ETL 演示模板。"""

from __future__ import annotations

DIRTY_ORDERS_DEMO_SOURCE_TABLE = "dirty_orders"
REST_API_SAMPLE_ORDERS_PATH = "/sample-api/orders"

DIRTY_ORDERS_DEMO_ETL_RULES: list[dict[str, str]] = [
    {"type": "cast_type", "column": "amount", "to": "float"},
    {"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"},
]


def default_etl_rules_for_source(source_type: str, source_table: str) -> list[dict[str, str]]:
    """按源对象返回演示默认清洗规则；其它源返回空列表。"""
    normalized = source_table.strip().lower()
    if source_type == "mysql" and normalized == DIRTY_ORDERS_DEMO_SOURCE_TABLE:
        return [dict(rule) for rule in DIRTY_ORDERS_DEMO_ETL_RULES]
    if source_type == "rest_api":
        if normalized in {
            REST_API_SAMPLE_ORDERS_PATH.lower(),
            "/sample-api/v1/orders",
            "/sample-api/protected/orders",
        }:
            return [dict(rule) for rule in DIRTY_ORDERS_DEMO_ETL_RULES]
        if normalized.endswith("/orders"):
            return [dict(rule) for rule in DIRTY_ORDERS_DEMO_ETL_RULES]
    return []
