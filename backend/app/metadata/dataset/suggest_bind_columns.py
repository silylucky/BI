"""出图绑定列推荐（与 fe datasetFieldClassification.suggestDatasetBindColumns 对齐）。"""

from __future__ import annotations

import re

_METRIC_PATTERN = re.compile(
    r"(?:^|_)(amount|amt|count|cnt|qty|quantity|price|total|sum|avg|rate|score|记录数)(?:$|_)",
    re.IGNORECASE,
)
_DIMENSION_PATTERN = re.compile(
    r"(?:^|_)(date|time|day|month|year|week|region|area|city|province|country|"
    r"product|category|channel|name|type|status|label|dim|code)(?:$|_)|^id$|_id$",
    re.IGNORECASE,
)


def _classify_field(field: str) -> str:
    normalized = field.strip()
    if not normalized:
        return "dimension"
    if normalized == "记录数" or normalized.endswith("*"):
        return "metric"
    if _DIMENSION_PATTERN.search(normalized):
        return "dimension"
    if _METRIC_PATTERN.search(normalized):
        return "metric"
    return "dimension"


def suggest_bind_columns(columns: list[str]) -> list[str]:
    if not columns:
        return []
    dimensions: list[str] = []
    metrics: list[str] = []
    for col in columns:
        if _classify_field(col) == "metric":
            metrics.append(col)
        else:
            dimensions.append(col)
    picked = list(dict.fromkeys([*dimensions, *metrics]))
    return picked if picked else list(columns)
