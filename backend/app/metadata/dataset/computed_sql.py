from __future__ import annotations

import re

from app.metadata.dataset.errors import DatasetError
from app.metadata.dataset.schemas import DatasetComputedField

_IDENT_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
_TOKEN_RE = re.compile(r"[a-z][a-z0-9_]{1,63}|\d+(?:\.\d+)?|[+\-*/()]|\s+")


def _tokenize(expression: str) -> list[str]:
    pos = 0
    tokens: list[str] = []
    while pos < len(expression):
        match = _TOKEN_RE.match(expression, pos)
        if not match:
            raise DatasetError(
                "META_DATASET_INVALID_EXPRESSION",
                f"Invalid token near: {expression[pos: pos + 8]!r}",
                422,
            )
        token = match.group(0)
        if not token.isspace():
            tokens.append(token)
        pos = match.end()
    if not tokens:
        raise DatasetError("META_DATASET_INVALID_EXPRESSION", "Expression must not be empty", 422)
    return tokens


def validate_computed_expression(expression: str, allowed_identifiers: set[str]) -> str:
    tokens = _tokenize(expression.strip())
    for token in tokens:
        if _IDENT_RE.match(token) and token not in allowed_identifiers:
            raise DatasetError(
                "META_DATASET_INVALID_EXPRESSION",
                f"Unknown identifier: {token}",
                422,
                fields=[{"field": "expression", "message": f"unknown: {token}"}],
            )
    return expression.strip()


def augment_select_sql(
    sql: str,
    computed_fields: list[DatasetComputedField],
    allowed_identifiers: set[str],
) -> str:
    if not computed_fields:
        return sql
    upper = sql.upper()
    from_idx = upper.find(" FROM ")
    if from_idx < 0:
        return sql
    extras: list[str] = []
    for field in computed_fields:
        safe_expr = validate_computed_expression(field.expression, allowed_identifiers)
        extras.append(f"({safe_expr}) AS `{field.name}`")
    return f"{sql[:from_idx]}, {', '.join(extras)}{sql[from_idx:]}"
