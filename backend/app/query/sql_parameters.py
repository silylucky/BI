"""SQL {{key}} 参数注入 — 与 FE dashboardFilterUtils.injectSqlParameters 对称。"""
from __future__ import annotations

import re

from app.query.schemas import QueryError

_UNSAFE = re.compile(r"[;]|--|/\*")
_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


def inject_sql_parameters(sql: str, params: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        value = params.get(key)
        if value is None:
            return match.group(0)
        if _UNSAFE.search(value):
            raise QueryError("QUERY_FILTER_UNSAFE", "Unsafe filter value", 422)
        return value.replace("'", "''")

    return _PLACEHOLDER.sub(repl, sql)


def build_widget_filter_params(
    widget_id: str,
    linkage: dict,
    filter_values: dict[str, str],
) -> dict[str, str]:
    out: dict[str, str] = {}
    for rule in linkage.get("linkageRules") or []:
        if widget_id not in rule.get("targetWidgetIds") or []:
            continue
        src = rule.get("sourceFilterId")
        key = rule.get("parameterKey")
        if not src or not key:
            continue
        value = filter_values.get(src)
        if value not in (None, ""):
            out[key] = value
    return out
