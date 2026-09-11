from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.designer.schemas import DesignerError, SqlModeSpec
from app.query.config_store import service as config_store
from app.query.config_store.schemas import ConfigError, ConfigUpsert
from app.query.readonly import assert_readonly_sql
from app.query.schemas import QueryError

_MAX_SQL_LEN = 65536

_REMEDIATION: dict[str, str] = {
    "DESIGN_SQL_NOT_READONLY": "Use SELECT-only SQL; remove DML/DDL clauses",
    "DESIGN_SQL_EMPTY": "Provide a non-empty SELECT statement",
    "DESIGN_SQL_TOO_LONG": "Reduce SQL length below 65536 characters",
}

probe_sql_mode_validate_budget_ms = 50


@dataclass(frozen=True)
class SqlModeProbeResult:
    elapsed_ms: float
    ok: bool


def _raise_sql_error(code: str, message: str, status: int = 422) -> None:
    raise DesignerError(code, message, status, remediation=_REMEDIATION.get(code))


def validate_sql_mode(spec: SqlModeSpec) -> SqlModeSpec:
    if not spec.sql.strip():
        _raise_sql_error("DESIGN_SQL_EMPTY", "SQL must not be empty")
    try:
        assert_readonly_sql(spec.sql)
    except QueryError as exc:
        if exc.code == "QUERY_SQL_TOO_LONG":
            _raise_sql_error("DESIGN_SQL_TOO_LONG", exc.message, 422)
        _raise_sql_error("DESIGN_SQL_NOT_READONLY", exc.message)
    return spec


def probe_validate_sql_mode(sql: str = "SELECT 1") -> SqlModeProbeResult:
    started = time.perf_counter()
    dummy = SqlModeSpec(
        dataSourceId=uuid.uuid4(),
        sql=sql,
        refId=uuid.uuid4(),
    )
    try:
        validate_sql_mode(dummy)
        ok = True
    except DesignerError:
        ok = False
    return SqlModeProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)


def sql_mode_capabilities() -> dict[str, object]:
    return {
        "allowedStatements": ["SELECT"],
        "maxSqlLength": _MAX_SQL_LEN,
        "highlightSupported": False,
    }


def _payload(spec: SqlModeSpec) -> dict:
    return {
        "schemaVersion": spec.schema_version,
        "dataSourceId": str(spec.data_source_id),
        "sql": spec.sql,
        "parameters": spec.parameters,
    }


def save_sql_mode(session: Session, spec: SqlModeSpec, owner_id: uuid.UUID | None = None):
    validate_sql_mode(spec)
    record = config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type="sql_mode",
            schema_version=spec.schema_version,
            ref_type=spec.ref_type,
            ref_id=spec.ref_id,
            payload=_payload(spec),
        ),
        owner_id=owner_id,
    )
    return spec, record


def get_sql_mode(session: Session, ref_type: str, ref_id: uuid.UUID) -> SqlModeSpec:
    record = config_store.get_config_by_ref(session, "sql_mode", ref_type, ref_id)
    payload = record.payload
    return SqlModeSpec(
        schema_version=payload.get("schemaVersion", "1.0"),
        data_source_id=uuid.UUID(payload["dataSourceId"]),
        sql=payload["sql"],
        parameters=payload.get("parameters", {}),
        ref_type=ref_type,
        ref_id=ref_id,
    )


_DESIGN_MODE_TYPE = "design_mode"
_DEFAULT_MODE = "visual"


def get_design_mode(session: Session, ref_type: str, ref_id: uuid.UUID) -> str:
    try:
        record = config_store.get_config_by_ref(session, _DESIGN_MODE_TYPE, ref_type, ref_id)
        return record.payload.get("mode", _DEFAULT_MODE)
    except ConfigError:
        return _DEFAULT_MODE


def set_design_mode(
    session: Session,
    ref_type: str,
    ref_id: uuid.UUID,
    mode: str,
    owner_id: uuid.UUID | None = None,
) -> dict:
    if mode not in ("visual", "sql"):
        raise DesignerError("DESIGN_MODE_INVALID", "mode must be visual or sql", 422)
    config_store.upsert_config(
        session,
        ConfigUpsert(
            config_type=_DESIGN_MODE_TYPE,
            schema_version="1.0",
            ref_type=ref_type,
            ref_id=ref_id,
            payload={"mode": mode},
        ),
        owner_id=owner_id,
    )
    return {"refId": str(ref_id), "mode": mode}
