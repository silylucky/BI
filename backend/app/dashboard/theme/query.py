from __future__ import annotations

import re
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.auth.deps import UserContext
from app.auth.rls.predicate import RlsConfigError, validate_column_name
from app.dashboard.theme.errors import ThemeAnalysisError
from app.dashboard.theme.schemas import EntityThemeConfig
from app.dashboard.theme import service as theme_service
from app.metadata.physical import service as physical_service
from app.reports.engine import execute as engine_execute

_UNSAFE_LITERAL = re.compile(r"[;]|--|/\*")


def _safe_sql_literal(value: str | int | float) -> str:
    text = str(value)
    if _UNSAFE_LITERAL.search(text):
        raise ThemeAnalysisError("DASH_THEME_FILTER_UNSAFE", "Unsafe filter value", 422)
    return text.replace("'", "''")


def _safe_identifier(name: str, *, code: str = "DASH_THEME_FILTER_UNSAFE") -> str:
    try:
        validate_column_name(name)
    except RlsConfigError as exc:
        raise ThemeAnalysisError(code, str(exc), 422) from exc
    return name


def build_drill_query(config: EntityThemeConfig, dimension_id: str, filters: dict[str, Any] | None) -> str:
    dim = next((d for d in config.dimensions if d.dimension_id == dimension_id), None)
    if dim is None:
        raise ThemeAnalysisError("DASH_THEME_DIMENSION_UNKNOWN", f"unknown dimensionId={dimension_id}", 422)
    col = _safe_identifier(dimension_id, code="DASH_THEME_DIMENSION_UNKNOWN")
    where = ""
    if filters:
        clauses: list[str] = []
        for key, value in filters.items():
            if not isinstance(value, (str, int, float)):
                continue
            safe_key = _safe_identifier(str(key))
            clauses.append(f"{safe_key} = '{_safe_sql_literal(value)}'")
        if clauses:
            where = " WHERE " + " AND ".join(clauses)
    return f"SELECT {col}, COUNT(*) AS cnt FROM {{table}}{where} GROUP BY {col}"


def _safe_table_ref(table_ref: str) -> str:
    parts = [p for p in table_ref.split(".") if p]
    if not parts:
        raise ThemeAnalysisError("DASH_THEME_ENTITY_NOT_READY", "invalid physical table ref", 404)
    return ".".join(_safe_identifier(p, code="DASH_THEME_ENTITY_NOT_READY") for p in parts)


def execute_theme_drill(
    db: Session,
    user: UserContext,
    ref_type: str,
    ref_id: uuid.UUID,
    dimension_id: str,
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from app.dashboard.theme.acl import assert_theme_action

    assert_theme_action(user, "read")
    try:
        config = theme_service.get_theme_config(db, ref_type, ref_id, user)
    except ThemeAnalysisError as exc:
        if exc.code == "CONFIG_NOT_FOUND":
            raise ThemeAnalysisError("CONFIG_NOT_FOUND", exc.message, 404) from exc
        raise
    except Exception as exc:
        from app.query.config_store.schemas import ConfigError

        if isinstance(exc, ConfigError) and exc.code == "CONFIG_NOT_FOUND":
            raise ThemeAnalysisError("CONFIG_NOT_FOUND", exc.message, 404) from exc
        raise
    sql_template = build_drill_query(config, dimension_id, filters)
    listed = physical_service.list_physical_tables(entity_type_code=config.entity_type, limit=1, offset=0)
    if not listed.items:
        raise ThemeAnalysisError("DASH_THEME_ENTITY_NOT_READY", "no physical table for entityType", 404)
    pt = listed.items[0]
    table_ref = (
        f"{pt.source_schema}.{pt.source_table}"
        if pt.source_schema and pt.source_table
        else pt.table_fqn.split(".", 1)[-1]
    )
    sql = sql_template.format(table=_safe_table_ref(table_ref))
    payload = engine_execute.execute_section(db, user, pt.data_source_id, sql, limit=100)
    return {"columns": payload["columns"], "rows": payload["rows"]}
