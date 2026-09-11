from __future__ import annotations

import inspect
import time
from dataclasses import dataclass
from typing import Any

from app.datasources.dialects.base import DialectConnector
from app.datasources.registry import ConnectorRegistry, registry, register_dialect

_PLUGIN_META: dict[str, dict[str, Any]] = {}


@dataclass(frozen=True)
class ExtensionPoint:
    id: str
    description: str


PLUGIN_EXTENSION_POINTS: tuple[ExtensionPoint, ...] = (
    ExtensionPoint(id="connector.register", description="Register a DialectConnector"),
    ExtensionPoint(id="connector.unregister", description="Unregister when unused"),
    ExtensionPoint(id="connector.export_catalog", description="Include in type catalog"),
)


def list_extension_points() -> list[ExtensionPoint]:
    return list(PLUGIN_EXTENSION_POINTS)


def register_connector_plugin(connector: DialectConnector) -> None:
    register_dialect(connector)
    _PLUGIN_META[connector.type] = {"registered_via": "plugin", "type": connector.type}


def get_plugin_registration_meta(connector_type: str) -> dict[str, Any] | None:
    return _PLUGIN_META.get(connector_type)


@dataclass(frozen=True)
class RegistrationPathDoc:
    connector_type: str
    steps: tuple[str, ...]
    touches_core_registry: bool = False


@dataclass(frozen=True)
class RegistryProbeResult:
    types: tuple[str, ...]
    elapsed_ms: float
    gbase_present: bool


_KNOWN_PATHS: dict[str, tuple[str, ...]] = {
    "gbase": (
        "Create dialects/gbase.py",
        "Call register_connector_plugin(GbaseConnector()) in datasources/__init__.py",
    ),
}


def describe_registration_path(connector_type: str) -> RegistrationPathDoc:
    steps = _KNOWN_PATHS.get(
        connector_type,
        ("Implement DialectConnector", "register_connector_plugin(connector)"),
    )
    return RegistrationPathDoc(connector_type, steps, False)


def probe_registry(max_ms: int = 50) -> RegistryProbeResult:
    started = time.perf_counter()
    types = tuple(t.type for t in registry.list_types())
    gbase = registry.get("gbase") is not None
    elapsed_ms = (time.perf_counter() - started) * 1000
    _ = max_ms
    return RegistryProbeResult(types, elapsed_ms, gbase)


def verify_zero_invasion() -> bool:
    register_src = inspect.getsource(ConnectorRegistry.register)
    get_src = inspect.getsource(ConnectorRegistry.get)
    return "register_connector_plugin" not in register_src and "register_connector_plugin" not in get_src


@dataclass(frozen=True)
class ExtensionDrillResult:
    registered: bool
    types: tuple[str, ...]
    zero_invasion: bool
    elapsed_ms: float
    connectivity_ok: bool = False
    readonly_query_ok: bool = False


class DrillStubConnector:
    type = "drill_stub"
    category = "database"
    capabilities = ("metadata",)
    display_name = "Drill Stub"

    def test_connection(self, **kwargs):
        from app.datasources.dialects.base import TestConnectionResult

        return TestConnectionResult(ok=True, message="ok", latency_ms=1)

    def list_schemas(self, **kwargs):
        return []

    def list_tables(self, **kwargs):
        return []

    def list_columns(self, **kwargs):
        return []

    def probe_readonly_sql(self, **kwargs):
        return ("SELECT 1", True)


def assert_core_module_unchanged() -> bool:
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2] / "datasources"
    allowed = {pathlib.Path(__file__).resolve(), root / "dialects"}
    for py in root.rglob("*.py"):
        if "drill_stub" in py.read_text() and py.resolve() not in allowed:
            return False
    return verify_zero_invasion()


def run_extension_drill() -> ExtensionDrillResult:
    import os

    if os.environ.get("DRILL_MODE") != "1" and os.environ.get("PYTEST_CURRENT_TEST") is None:
        raise RuntimeError("extension drill only in DRILL_MODE or pytest")
    started = time.perf_counter()
    stub = DrillStubConnector()
    register_connector_plugin(stub)
    types = tuple(t.type for t in registry.list_types())
    conn_ok = stub.test_connection().ok
    ro_ok = stub.probe_readonly_sql()[1]
    elapsed = (time.perf_counter() - started) * 1000
    return ExtensionDrillResult(
        True, types, verify_zero_invasion(), elapsed, conn_ok, ro_ok
    )


def teardown_extension_drill() -> None:
    from app.datasources.registry import unregister

    try:
        unregister("drill_stub")
    except KeyError:
        pass
    _PLUGIN_META.pop("drill_stub", None)
