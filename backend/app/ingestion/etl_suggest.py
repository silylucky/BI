"""根据源表列元数据生成建议 ETL 清洗规则。"""

from __future__ import annotations

import re
from typing import Any, TypedDict


class EtlColumnMeta(TypedDict, total=False):
    name: str
    dataType: str


NUMERIC_FLOAT_NAME = re.compile(
    r"(?:^|_)(amount|price|qty|quantity|total|cost|rate|weight|budget|spent|"
    r"revenue|salary|fee|value|score|metric|measure|percent|ratio|balance|"
    r"lat|lng|lon|latitude|longitude)(?:$|_)",
    re.IGNORECASE,
)
NUMERIC_INT_NAME = re.compile(
    r"(?:^|_)(id|year|month|day|age|rank|seq|index|count|num|no)(?:$|_)",
    re.IGNORECASE,
)
RENAME_SUFFIX = re.compile(
    r"^([a-z][a-z0-9_]*)_(name|title|label|desc|description)$",
    re.IGNORECASE,
)
FILL_NULL_NAME = re.compile(
    r"(?:^|_)(note|notes|comment|comments|remark|remarks|memo)(?:$|_)",
    re.IGNORECASE,
)
BOOLEAN_NAME = re.compile(
    r"^(is_|has_|can_|should_|enabled|active|deleted|visible|valid)",
    re.IGNORECASE,
)
FILL_NULL_DEFAULT = "无备注"

# 常见源字段前缀，整列去掉后与现有列名冲突则跳过
_SKIP_RENAME_BASES = frozenset({"id", "uuid", "guid", "pk", "key", "code", "type", "status"})


def _is_string_like_data_type(data_type: str | None) -> bool:
    dt = (data_type or "").lower()
    if not dt:
        return True
    return bool(re.search(r"char|text|json|blob|string|enum|set", dt))


def _suggest_rename_target(name: str, column_names: set[str]) -> str | None:
    match = RENAME_SUFFIX.match(name)
    if not match:
        return None
    target = match.group(1).lower()
    if target == name.lower() or target in _SKIP_RENAME_BASES:
        return None
    if target in column_names and target != name.lower():
        return None
    return match.group(1)


def suggest_etl_rules_from_columns(columns: list[EtlColumnMeta]) -> list[dict[str, Any]]:
    """扫描全部源列，为每一列生成可落地的清洗规则（rename / fill / cast / filter）。"""
    rules: list[dict[str, Any]] = []
    seen: set[str] = set()
    column_names = {(col.get("name") or "").strip().lower() for col in columns if (col.get("name") or "").strip()}
    rename_targets: set[str] = set()
    renamed_columns: set[str] = set()

    for col in columns:
        name = (col.get("name") or "").strip()
        if not name:
            continue

        rename_target = _suggest_rename_target(name, column_names)
        if rename_target:
            target_key = rename_target.lower()
            key = f"rename:{name}"
            if key not in seen and target_key not in rename_targets:
                seen.add(key)
                rename_targets.add(target_key)
                renamed_columns.add(name.lower())
                rules.append({"type": "rename_column", "from": name, "to": rename_target})

        if FILL_NULL_NAME.search(name):
            key = f"fill:{name}"
            if key not in seen:
                seen.add(key)
                rules.append({"type": "fill_null", "column": name, "value": FILL_NULL_DEFAULT})

        if name.lower() in renamed_columns:
            continue

        if not _is_string_like_data_type(col.get("dataType")):
            continue

        cast_target: str | None = None
        if BOOLEAN_NAME.search(name):
            cast_target = "boolean"
        elif NUMERIC_INT_NAME.search(name):
            cast_target = "integer"
        elif NUMERIC_FLOAT_NAME.search(name):
            cast_target = "float"
        if cast_target:
            key = f"cast:{name}"
            if key not in seen:
                seen.add(key)
                rules.append({"type": "cast_type", "column": name, "to": cast_target})

    if any((col.get("name") or "").strip().lower() == "status" for col in columns):
        rules.append({"type": "filter_rows", "column": "status", "op": "ne", "value": "deleted"})

    return rules
