"""In-memory crosstab pivot for report template sections."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from decimal import Decimal
from typing import Any, Literal

AggFn = Literal["sum", "count", "max", "min"]

_AGG_INIT: dict[AggFn, Callable[[], Any]] = {
    "sum": lambda: 0.0,
    "count": lambda: 0,
    "max": lambda: None,
    "min": lambda: None,
}


def _to_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return float(int(value))
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    try:
        return float(str(value).strip().replace(",", ""))
    except ValueError:
        return None


def _apply_agg(current: Any, value: float | None, agg: AggFn) -> Any:
    if agg == "count":
        return int(current) + 1
    if value is None:
        return current
    if agg == "sum":
        return float(current) + value
    if agg == "max":
        return value if current is None else max(float(current), value)
    if agg == "min":
        return value if current is None else min(float(current), value)
    return current


def _col_index(columns: list[str], field: str) -> int:
    try:
        return columns.index(field)
    except ValueError as exc:
        raise ValueError(f"字段不存在：{field}") from exc


def pivot_table(
    columns: list[str],
    rows: list[list[Any]],
    *,
    row_field: str,
    col_field: str,
    value_field: str,
    agg: AggFn = "sum",
) -> dict[str, Any]:
    """Pivot long table into crosstab matrix (row × col → aggregated value)."""
    if not columns:
        raise ValueError("缺少列定义")
    row_i = _col_index(columns, row_field)
    col_i = _col_index(columns, col_field)
    val_i = _col_index(columns, value_field)

    bucket: dict[tuple[str, str], Any] = defaultdict(_AGG_INIT[agg])
    row_labels: list[str] = []
    col_labels: list[str] = []
    row_seen: set[str] = set()
    col_seen: set[str] = set()

    for row in rows:
        if not row or max(row_i, col_i, val_i) >= len(row):
            continue
        r_key = str(row[row_i] if row[row_i] is not None else "")
        c_key = str(row[col_i] if row[col_i] is not None else "")
        if r_key not in row_seen:
            row_seen.add(r_key)
            row_labels.append(r_key)
        if c_key not in col_seen:
            col_seen.add(c_key)
            col_labels.append(c_key)
        key = (r_key, c_key)
        num = _to_number(row[val_i]) if agg != "count" else None
        bucket[key] = _apply_agg(bucket[key], num, agg)

    matrix: list[list[Any]] = []
    for r_key in row_labels:
        line: list[Any] = []
        for c_key in col_labels:
            val = bucket.get((r_key, c_key), _AGG_INIT[agg]())
            if agg in {"max", "min"} and val is None:
                line.append("")
            else:
                line.append(val)
        matrix.append(line)

    return {
        "kind": "crosstab",
        "rowField": row_field,
        "colField": col_field,
        "valueField": value_field,
        "agg": agg,
        "rowLabels": row_labels,
        "colLabels": col_labels,
        "matrix": matrix,
        "columns": [""] + col_labels,
        "rows": [[row_labels[i], *matrix[i]] for i in range(len(row_labels))],
    }
