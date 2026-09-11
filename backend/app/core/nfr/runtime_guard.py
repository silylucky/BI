from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.core.nfr.errors import NFR_RUNTIME_VIOLATION

_FORBIDDEN = frozenset({"superset", "dataease", "apache-superset"})
_FORBIDDEN_MODULES = frozenset({"superset", "dataease"})
SCAN_BUDGET_MS = 100


@dataclass(frozen=True)
class RuntimeCheckItem:
    id: str
    status: str
    message: str
    remediation: str | None = None


@dataclass(frozen=True)
class RuntimeComplianceReport:
    policy_version: str
    overall_status: str
    zero_third_party_bi_runtime: bool
    scanned_at: str
    items: tuple[RuntimeCheckItem, ...]


class RuntimeComplianceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


def _read_pyproject_text() -> str:
    path = Path(__file__).resolve().parents[3] / "pyproject.toml"
    return path.read_text(encoding="utf-8")


def _scan_pyproject(text: str) -> RuntimeCheckItem:
    lowered = text.lower()
    hit = next((name for name in _FORBIDDEN if name in lowered), None)
    if hit:
        return RuntimeCheckItem(
            "pyproject-dependencies",
            "fail",
            f"Forbidden BI dependency detected: {hit}",
            "Remove superset/dataease from pyproject dependencies",
        )
    return RuntimeCheckItem("pyproject-dependencies", "pass", "No forbidden BI dependencies in pyproject")


def _forbidden_module_loaded() -> str | None:
    for mod in _FORBIDDEN_MODULES:
        if mod in sys.modules:
            return mod
    return None


def _scan_modules() -> RuntimeCheckItem:
    loaded = _forbidden_module_loaded()
    if loaded:
        return RuntimeCheckItem(
            "loaded-modules",
            "fail",
            f"Forbidden module loaded: {loaded}",
            "Remove superset/dataease from runtime environment",
        )
    return RuntimeCheckItem("loaded-modules", "pass", "No forbidden BI modules loaded")


def build_runtime_report(pyproject_text: str | None = None) -> RuntimeComplianceReport:
    text = pyproject_text if pyproject_text is not None else _read_pyproject_text()
    items = (_scan_pyproject(text), _scan_modules(), RuntimeCheckItem("runtime-declaration", "pass", "zeroThirdPartyBiRuntime declared"))
    fails = [i for i in items if i.status == "fail"]
    overall = "non_compliant" if fails else "compliant"
    return RuntimeComplianceReport(
        policy_version="nfr08-l1",
        overall_status=overall,
        zero_third_party_bi_runtime=not fails,
        scanned_at=datetime.now(UTC).isoformat(),
        items=items,
    )


def assert_runtime_compliant(mode: str | None = None) -> RuntimeComplianceReport:
    del mode
    report = build_runtime_report()
    if report.overall_status != "compliant":
        raise RuntimeComplianceError(NFR_RUNTIME_VIOLATION, "Runtime compliance violation detected")
    return report
