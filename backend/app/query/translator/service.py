from __future__ import annotations

from app.core.config import get_settings
from app.designer.schemas import DESIGNER_FIELD_REGISTRY
from app.query.dialects import UnsupportedDialectError, get_sql_dialect
from app.query.capabilities import resolve_sql_dialect_type
from app.query.rls.guard import validate_identifier
from app.query.translator.latest_order import apply_latest_limit
from app.query.translator.schemas import (
    ALLOWED_LOGIC,
    L1_OPERATORS,
    TranslateConditionItem,
    TranslateConditions,
    TranslateError,
    TranslateRequest,
    TranslateResponse,
)


def _param_name(index: int) -> str:
    return f"p{index}"


def _placeholder(connector_type: str, name: str, value_type: str) -> str:
    if resolve_sql_dialect_type(connector_type) == "clickhouse":
        ch_type = "Int64" if value_type == "number" else "String"
        return f"{{{name}:{ch_type}}}"
    return f"%({name})s"


def _validate_identifiers(schema: str, table: str, columns: list[str]) -> None:
    try:
        if schema and schema.strip():
            validate_identifier(schema.strip())
        validate_identifier(table)
        for col in columns:
            validate_identifier(col)
    except Exception as exc:
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_IDENTIFIER",
            str(exc),
            422,
        ) from exc


def _validate_conditions(conditions: TranslateConditions | None) -> None:
    if conditions is None:
        return
    if conditions.logic not in ALLOWED_LOGIC:
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            f"logic must be one of {sorted(ALLOWED_LOGIC)}",
            422,
        )
    unknown: list[dict[str, str]] = []
    for item in conditions.conditions:
        if item.field_id not in DESIGNER_FIELD_REGISTRY:
            unknown.append({"field": "fieldId", "message": f"unknown field: {item.field_id}"})
        if item.operator not in L1_OPERATORS:
            raise TranslateError(
                "QUERY_TRANSLATE_INVALID_OPERATOR",
                f"unsupported operator: {item.operator}",
                422,
            )
    if unknown:
        raise TranslateError(
            "QUERY_TRANSLATE_UNKNOWN_FIELD",
            "Unknown condition field(s)",
            422,
            fields=unknown,
        )


def _condition_sql(
    item: TranslateConditionItem,
    *,
    connector_type: str,
    dialect,
    param_index: int,
    parameters: dict[str, object],
) -> tuple[str, int]:
    col = dialect.quote_identifier(item.field_id)
    op = item.operator
    if op in ("is_null", "is_not_null"):
        suffix = "IS NULL" if op == "is_null" else "IS NOT NULL"
        return f"{col} {suffix}", param_index
    if op == "in":
        if not isinstance(item.value, list):
            raise TranslateError("QUERY_TRANSLATE_INVALID_CONFIG", "in operator requires array value", 422)
        placeholders = []
        for val in item.value:
            pname = _param_name(param_index)
            placeholders.append(_placeholder(connector_type, pname, item.value_type))
            parameters[pname] = val
            param_index += 1
        return f"{col} IN ({', '.join(placeholders)})", param_index
    pname = _param_name(param_index)
    placeholder = _placeholder(connector_type, pname, item.value_type)
    parameters[pname] = item.value
    param_index += 1
    if op == "eq":
        return f"{col} = {placeholder}", param_index
    if op == "ne":
        return f"{col} <> {placeholder}", param_index
    if op == "gt":
        return f"{col} > {placeholder}", param_index
    if op == "gte":
        return f"{col} >= {placeholder}", param_index
    if op == "lt":
        return f"{col} < {placeholder}", param_index
    if op == "lte":
        return f"{col} <= {placeholder}", param_index
    if op == "like":
        return f"{col} LIKE {placeholder}", param_index
    raise TranslateError("QUERY_TRANSLATE_INVALID_OPERATOR", f"unsupported operator: {op}", 422)


def translate_config_to_sql(request: TranslateRequest) -> TranslateResponse:
    try:
        dialect = get_sql_dialect(request.connector_type)
    except UnsupportedDialectError as exc:
        raise TranslateError(
            "QUERY_TRANSLATE_UNSUPPORTED_DIALECT",
            f"Unsupported connector type: {exc.connector_type}",
            422,
        ) from exc

    if not request.columns:
        raise TranslateError("QUERY_TRANSLATE_INVALID_CONFIG", "columns must not be empty", 422)

    settings = get_settings()
    limit = request.limit if request.limit is not None else settings.query_default_limit
    if limit > settings.query_default_limit:
        raise TranslateError(
            "QUERY_TRANSLATE_INVALID_CONFIG",
            f"limit must be <= {settings.query_default_limit}",
            422,
        )

    _validate_identifiers(request.schema_name, request.table, request.columns)
    _validate_conditions(request.conditions)

    quoted_cols = ", ".join(dialect.quote_identifier(c) for c in request.columns)
    qualified = dialect.qualify_table(request.schema_name, request.table)
    sql = f"SELECT {quoted_cols} FROM {qualified}"
    parameters: dict[str, object] = {}

    if request.conditions and request.conditions.conditions:
        idx = 0
        parts: list[str] = []
        for cond in request.conditions.conditions:
            fragment, idx = _condition_sql(
                cond,
                connector_type=request.connector_type,
                dialect=dialect,
                param_index=idx,
                parameters=parameters,
            )
            parts.append(fragment)
        joiner = f" {request.conditions.logic} "
        sql = f"{sql} WHERE {joiner.join(parts)}"

    sql = apply_latest_limit(
        sql,
        dialect,
        request.columns,
        limit=limit,
        offset=request.offset,
    )
    return TranslateResponse(
        sql=sql,
        parameters=parameters,
        connector_type=request.connector_type,
    )
