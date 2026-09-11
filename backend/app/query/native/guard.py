from __future__ import annotations

import re
import time
from dataclasses import dataclass

from app.datasources.registry import export_type_catalog
from app.query.capabilities import resolve_query_mode_for_connector
from app.query.native.schemas import (
    NativeQuerySpec,
    NativeValidateOut,
    ReadonlyGuardIn,
    ReadonlyGuardOut,
    RoutingModeItem,
    RoutingModesOut,
)
from app.query.readonly import assert_readonly_sql, assert_safe_sql_parameters
from app.query.schemas import QueryError

NATIVE_CATEGORIES = frozenset({"search", "document", "timeseries", "api", "file"})

probe_native_routing_budget_ms = 50

_NATIVE_INJECTION = re.compile(r";\s*DROP\b|\$where", re.IGNORECASE)


@dataclass(frozen=True)
class NativeProbeResult:
    elapsed_ms: float
    ok: bool


def _catalog_by_type() -> dict[str, str]:
    return {item["type"]: item["category"] for item in export_type_catalog()}


def resolve_query_mode(connector_type: str) -> str:
    explicit = resolve_query_mode_for_connector(connector_type)
    if explicit is not None:
        return explicit
    category = _catalog_by_type().get(connector_type)
    if category is None:
        raise QueryError("QUERY_NATIVE_UNSUPPORTED_CONNECTOR", f"Unknown connector: {connector_type}", 422)
    return "native" if category in NATIVE_CATEGORIES else "sql"


def list_routing_modes() -> RoutingModesOut:
    modes = [
        RoutingModeItem(connectorType=item["type"], mode=resolve_query_mode(item["type"]))
        for item in export_type_catalog()
    ]
    return RoutingModesOut(modes=sorted(modes, key=lambda m: m.connector_type))


def _iter_string_leaves(obj: object):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_string_leaves(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from _iter_string_leaves(item)


def guard_native_injection(body: dict, parameters: dict[str, object] | None = None) -> None:
    for leaf in _iter_string_leaves(body):
        if '"; DROP' in leaf or _NATIVE_INJECTION.search(leaf):
            raise QueryError("QUERY_NATIVE_INJECTION_SUSPECT", "Suspicious native query body", 422)
    if parameters:
        assert_safe_sql_parameters(parameters)


def validate_native_spec(spec: NativeQuerySpec) -> NativeValidateOut:
    guard_native_injection(spec.body, spec.parameters)
    if spec.sql is not None:
        raise QueryError("QUERY_NATIVE_SQL_DISGUISE", "sql field is not allowed in native mode", 422)
    mode = resolve_query_mode(spec.connector_type)
    if mode != "native":
        raise QueryError("QUERY_NATIVE_WRONG_MODE", f"{spec.connector_type} requires sql mode", 422)
    if not spec.body:
        raise QueryError("QUERY_NATIVE_EMPTY_BODY", "Native query body must not be empty", 422)
    if not isinstance(spec.body, dict):
        raise QueryError("QUERY_NATIVE_INVALID_BODY", "body must be a JSON object", 422)
    return NativeValidateOut(
        connectorType=spec.connector_type,
        body=spec.body,
        index=spec.index,
        resolvedMode=mode,
    )


def assert_readonly_route_guard(spec: ReadonlyGuardIn) -> ReadonlyGuardOut:
    mode = resolve_query_mode(spec.connector_type)
    if mode == "sql":
        try:
            assert_readonly_sql(spec.sql)
        except QueryError as exc:
            if exc.code == "QUERY_NOT_READONLY" and exc.status == 400:
                raise QueryError(exc.code, exc.message, 422) from exc
            raise
        if spec.parameters:
            assert_safe_sql_parameters(spec.parameters)
        return ReadonlyGuardOut(ok=True, mode="sql")
    if spec.sql:
        raise QueryError("QUERY_NATIVE_SQL_DISGUISE", "sql field is not allowed in native mode", 422)
    return ReadonlyGuardOut(ok=True, mode="native")


def probe_list_routing_modes() -> NativeProbeResult:
    started = time.perf_counter()
    try:
        out = list_routing_modes()
        ok = len(out.modes) > 0
    except Exception:
        ok = False
    return NativeProbeResult(elapsed_ms=(time.perf_counter() - started) * 1000, ok=ok)
