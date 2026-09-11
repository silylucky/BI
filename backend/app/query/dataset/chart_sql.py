"""Chart encoding overlay: WHERE → GROUP BY/AGG → LIMIT (DataEase order)."""

from __future__ import annotations

from typing import Literal

from app.metadata.dataset.computed_sql import augment_select_sql
from app.metadata.dataset.schemas import DatasetComputedField
from app.query.config_store.schemas import DatasetQueryConfigPayload
from app.query.dataset.schemas import ChartExecuteEncoding
from app.query.dialects import UnsupportedDialectError, get_sql_dialect
from app.query.rls.guard import merge_where_clause, validate_identifier
from app.query.translator.latest_order import apply_latest_limit, pick_latest_order_column
from app.query.translator.schemas import TranslateError

DETAIL_CHART_TYPES = frozenset({"table-info", "table", "table-normal", "table-pivot"})
CHART_FILTER_OPS = frozenset({"eq", "neq", "gt", "gte", "lt", "lte", "in"})
CHART_METRIC_AGGS = frozenset({"sum", "avg", "max", "min", "count"})


def _param_name(index: int) -> str:
    return f"p{index}"


def _placeholder(connector_type: str, name: str) -> str:
    from app.query.capabilities import resolve_sql_dialect_type

    if resolve_sql_dialect_type(connector_type) == "clickhouse":
        return f"{{{name}:String}}"
    return f"%({name})s"


def _validate_field(field: str, allowed: set[str]) -> None:
    try:
        validate_identifier(field)
    except Exception as exc:
        raise TranslateError(
            "QUERY_CHART_INVALID_FIELD",
            str(exc),
            422,
        ) from exc
    if field not in allowed:
        raise TranslateError(
            "QUERY_CHART_INVALID_FIELD",
            f"unknown field: {field}",
            422,
        )


def _skip_filter_value(value: object | None) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def _filter_sql(
    field: str,
    operator: str,
    value: object | None,
    *,
    connector_type: str,
    dialect,
    param_index: int,
    parameters: dict[str, object],
) -> tuple[str | None, int]:
    if operator not in CHART_FILTER_OPS:
        raise TranslateError(
            "QUERY_CHART_INVALID_OPERATOR",
            f"unsupported operator: {operator}",
            422,
        )
    if _skip_filter_value(value):
        return None, param_index

    col = dialect.quote_identifier(field)
    if operator == "in":
        raw_vals: list[object]
        if isinstance(value, list):
            raw_vals = value
        elif isinstance(value, str):
            raw_vals = [v.strip() for v in value.split(",") if v.strip()]
        else:
            raw_vals = [value]
        if not raw_vals:
            return None, param_index
        placeholders: list[str] = []
        for val in raw_vals:
            pname = _param_name(param_index)
            placeholders.append(_placeholder(connector_type, pname))
            parameters[pname] = val
            param_index += 1
        return f"{col} IN ({', '.join(placeholders)})", param_index

    pname = _param_name(param_index)
    placeholder = _placeholder(connector_type, pname)
    parameters[pname] = value
    param_index += 1
    op_map = {
        "eq": "=",
        "neq": "<>",
        "gt": ">",
        "gte": ">=",
        "lt": "<",
        "lte": "<=",
    }
    return f"{col} {op_map[operator]} {placeholder}", param_index


def _time_range_sql(
    time_range,
    *,
    connector_type: str,
    dialect,
    param_index: int,
    parameters: dict[str, object],
) -> tuple[str | None, int]:
    if not time_range or not time_range.enabled:
        return None, param_index
    field = (time_range.field or "").strip()
    start = (time_range.start or "").strip()
    end = (time_range.end or "").strip()
    if not field or not start or not end:
        return None, param_index
    col = dialect.quote_identifier(field)
    p_start = _param_name(param_index)
    param_index += 1
    p_end = _param_name(param_index)
    param_index += 1
    parameters[p_start] = start
    parameters[p_end] = end
    ph_start = _placeholder(connector_type, p_start)
    ph_end = _placeholder(connector_type, p_end)
    return f"{col} BETWEEN {ph_start} AND {ph_end}", param_index


def _apply_where(sql: str, parts: list[str]) -> str:
    if not parts:
        return sql
    return merge_where_clause(sql, " AND ".join(parts))


def _agg_expr(agg: str, quoted: str) -> str:
    key = agg.lower()
    if key not in CHART_METRIC_AGGS:
        raise TranslateError(
            "QUERY_CHART_INVALID_AGG",
            f"unsupported aggregation: {agg}",
            422,
        )
    if key == "count":
        return f"COUNT({quoted})"
    return f"{key.upper()}({quoted})"


def _apply_grouped_limit(
    sql: str,
    dialect,
    order_column: str | None,
    *,
    limit: int,
    offset: int,
) -> str:
    if not order_column:
        return dialect.wrap_limit(sql, limit=limit, offset=offset)
    quoted = dialect.quote_identifier(order_column)
    limited = dialect.wrap_limit(
        f"{sql} ORDER BY {quoted} DESC",
        limit=limit,
        offset=offset,
    )
    inner = limited.strip().rstrip(";")
    return f"SELECT * FROM ({inner}) _vs_grp ORDER BY {quoted} ASC"


def _is_detail_chart(chart_type: str) -> bool:
    return chart_type in DETAIL_CHART_TYPES


def _unique_names(names: list[str]) -> list[str]:
    return list(dict.fromkeys(names))


def _metric_alias_exprs(metrics: list, dialect, reserved: set[str]) -> list[str]:
    used = set(reserved)
    exprs: list[str] = []
    for metric in metrics:
        field = metric.field.strip()
        alias = field
        suffix = 2
        while alias in used:
            alias = f"{field}_{suffix}"
            suffix += 1
        used.add(alias)
        exprs.append(
            f"{_agg_expr(metric.agg, dialect.quote_identifier(field))} AS {dialect.quote_identifier(alias)}"
        )
    return exprs


def build_chart_sql(
    payload: DatasetQueryConfigPayload,
    encoding: ChartExecuteEncoding,
    *,
    computed_fields: list[DatasetComputedField],
    limit: int,
    offset: int,
) -> tuple[str, dict[str, object]]:
    try:
        dialect = get_sql_dialect(payload.connector_type)
    except UnsupportedDialectError as exc:
        raise TranslateError(
            "QUERY_TRANSLATE_UNSUPPORTED_DIALECT",
            f"Unsupported connector type: {exc.connector_type}",
            422,
        ) from exc

    computed_names = {f.name for f in computed_fields}
    allowed = set(payload.columns) | computed_names

    dimensions = _unique_names([d.strip() for d in encoding.dimensions if d and d.strip()])
    metrics = [m for m in encoding.metrics if m.field and m.field.strip()]

    for field in dimensions:
        _validate_field(field, allowed)
    for metric in metrics:
        _validate_field(metric.field.strip(), allowed)
    for filt in encoding.filters:
        _validate_field(filt.field.strip(), allowed)
    if encoding.time_range and encoding.time_range.field:
        _validate_field(encoding.time_range.field.strip(), allowed)

    parameters: dict[str, object] = {}
    where_parts: list[str] = []
    idx = 0
    for filt in encoding.filters:
        fragment, idx = _filter_sql(
            filt.field.strip(),
            filt.operator,
            filt.value,
            connector_type=payload.connector_type,
            dialect=dialect,
            param_index=idx,
            parameters=parameters,
        )
        if fragment:
            where_parts.append(fragment)
    time_part, idx = _time_range_sql(
        encoding.time_range,
        connector_type=payload.connector_type,
        dialect=dialect,
        param_index=idx,
        parameters=parameters,
    )
    if time_part:
        where_parts.append(time_part)

    qualified = dialect.qualify_table(payload.schema_name, payload.table)

    if _is_detail_chart(encoding.chart_type):
        detail_cols = dimensions + [m.field.strip() for m in metrics]
        if not detail_cols:
            detail_cols = list(payload.columns)
        select_cols = ", ".join(dialect.quote_identifier(c) for c in detail_cols)
        sql = f"SELECT {select_cols} FROM {qualified}"
        allowed_ids = set(payload.columns) | {t for t in detail_cols}
        sql = augment_select_sql(sql, computed_fields, allowed_ids)
        sql = _apply_where(sql, where_parts)
        sql = apply_latest_limit(
            sql,
            dialect,
            detail_cols,
            limit=limit,
            offset=offset,
        )
        return sql, parameters

    metric_fields = [m.field.strip() for m in metrics]
    base_cols = list(dict.fromkeys(dimensions + metric_fields))
    if not base_cols and not metric_fields:
        base_cols = list(payload.columns)
    base_select = ", ".join(dialect.quote_identifier(c) for c in base_cols) if base_cols else "*"
    inner = f"SELECT {base_select} FROM {qualified}"
    inner = augment_select_sql(inner, computed_fields, set(payload.columns) | computed_names)
    inner = _apply_where(inner, where_parts)

    if not metric_fields:
        sql = inner
        order_col = pick_latest_order_column(dimensions) if dimensions else None
        sql = _apply_grouped_limit(sql, dialect, order_col, limit=limit, offset=offset)
        return sql, parameters

    dim_exprs = [dialect.quote_identifier(d) for d in dimensions]
    metric_exprs = _metric_alias_exprs(metrics, dialect, set(dimensions))
    select_list = ", ".join([*dim_exprs, *metric_exprs])
    sql = f"SELECT {select_list} FROM ({inner}) _src"
    if dimensions:
        group_by = ", ".join(dim_exprs)
        sql = f"{sql} GROUP BY {group_by}"
    order_col = pick_latest_order_column(dimensions) if dimensions else None
    sql = _apply_grouped_limit(sql, dialect, order_col, limit=limit, offset=offset)
    return sql, parameters
