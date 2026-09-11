from __future__ import annotations

import pathlib
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.config import Settings, get_settings
from app.core.nfr.errors import NFR_PROBE_TIMEOUT, XINCHUANG_NON_COMPLIANT
from app.core.nfr.plugin_extension import PLUGIN_EXTENSION_POINTS
from app.datasources.registry import registry

_XINCHUANG_DB_TYPES = frozenset({"gbase", "dm", "gaussdb", "kingbase"})
EXPECTED_XINCHUANG_TYPES = ("dm", "kingbase", "gbase", "oceanbase", "tidb", "gaussdb")
_FORBIDDEN_MODULES = frozenset({"superset", "dataease"})

_REMEDIATION: dict[str, str] = {
    "xc-db-connector": "Register xinchuang dialect via register_connector_plugin (e.g. gbase, dm, gaussdb)",
    "xc-platform-db": "Set DATABASE_URL to postgresql://, mysql://, or sqlite+ for dev",
    "xc-forbidden-runtime": "Remove superset/dataease from runtime dependencies",
    "xc-connector-plugin": "Declare PLUGIN_EXTENSION_POINTS in plugin_extension module",
    "xc-crypto-sm4-only": "Use CREDENTIAL_SM4_KEY only; run migrate-credentials-to-sm4.py",
    "xc-crypto-sm3-only": "Ensure auth_users.password_hash uses $sm3$ prefix",
    "xc-crypto-jwt-sm2": "Configure JWT_SM2_PRIVATE_KEY and JWT_SM2_PUBLIC_KEY (ADR-17)",
}


class XinchuangComplianceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class XinchuangChecklistItem:
    id: str
    status: str  # pass|fail|warn
    message: str
    remediation: str | None = None


@dataclass(frozen=True)
class ComplianceProbeResult:
    probe_status: str  # ok|timeout
    elapsed_ms: float
    report: ComplianceReport | None
    code: str | None = None


@dataclass(frozen=True)
class ComplianceReport:
    mode: str
    overall_status: str  # compliant|non_compliant|degraded
    items: tuple[XinchuangChecklistItem, ...]
    registered_xinchuang_connectors: tuple[str, ...]


def _registered_xinchuang() -> list[str]:
    return sorted(t.type for t in registry.list_types() if t.type in _XINCHUANG_DB_TYPES)


def _check_platform_db(settings: Settings) -> XinchuangChecklistItem:
    url = settings.database_url
    if url.startswith(
        (
            "postgresql://",
            "postgresql+psycopg://",
            "mysql://",
            "mysql+pymysql://",
            "sqlite+",
        )
    ):
        return XinchuangChecklistItem("xc-platform-db", "pass", "platform meta db protocol ok")
    return XinchuangChecklistItem("xc-platform-db", "fail", f"non-compliant platform db: {url.split(':', 1)[0]}")


def _with_remediation(item: XinchuangChecklistItem) -> XinchuangChecklistItem:
    if item.status != "fail":
        return item
    return XinchuangChecklistItem(
        item.id, item.status, item.message, _REMEDIATION.get(item.id, item.message)
    )


def enumerate_non_compliant(report: ComplianceReport) -> list[XinchuangChecklistItem]:
    return [i for i in report.items if i.status == "fail"]


def probe_compliance_non_blocking(
    settings: Settings | None = None, max_ms: int = 100
) -> ComplianceProbeResult:
    settings = settings or get_settings()
    started = time.perf_counter()
    report = build_compliance_report(settings)
    elapsed_ms = (time.perf_counter() - started) * 1000
    if elapsed_ms >= max_ms:
        return ComplianceProbeResult("timeout", elapsed_ms, None, NFR_PROBE_TIMEOUT)
    return ComplianceProbeResult("ok", elapsed_ms, report, None)


def _check_forbidden_runtime() -> XinchuangChecklistItem:
    for name in _FORBIDDEN_MODULES:
        if name in sys.modules:
            return XinchuangChecklistItem("xc-forbidden-runtime", "fail", f"forbidden module loaded: {name}")
    return XinchuangChecklistItem("xc-forbidden-runtime", "pass", "no forbidden BI runtime modules")


def _check_crypto_guomi(settings: Settings) -> tuple[XinchuangChecklistItem, ...]:
    from app.auth.jwt import ALGORITHM

    sm4_ok = bool(settings.credential_sm4_key)
    jwt_ok = ALGORITHM == "SM2" and bool(settings.jwt_sm2_private_key)
    return (
        XinchuangChecklistItem(
            "xc-crypto-sm4-only",
            "pass" if sm4_ok else "fail",
            "credential encryption uses SM4 key",
        ),
        XinchuangChecklistItem(
            "xc-crypto-jwt-sm2",
            "pass" if jwt_ok else "fail",
            f"jwt algorithm is {ALGORITHM}",
        ),
    )


def build_compliance_report(settings: Settings | None = None) -> ComplianceReport:
    settings = settings or get_settings()
    xc_registered = _registered_xinchuang()
    items = [
        XinchuangChecklistItem(
            "xc-db-connector",
            "pass" if xc_registered else "fail",
            "xinchuang db connectors registered" if xc_registered else "no xinchuang connector registered",
        ),
        _check_platform_db(settings),
        _check_forbidden_runtime(),
        XinchuangChecklistItem(
            "xc-connector-plugin",
            "pass" if PLUGIN_EXTENSION_POINTS else "fail",
            "plugin extension points declared",
        ),
        *_check_crypto_guomi(settings),
    ]
    fails = [i for i in items if i.status == "fail"]
    warns = [i for i in items if i.status == "warn"]
    if fails:
        overall = "non_compliant"
    elif warns:
        overall = "degraded"
    else:
        overall = "compliant"
    remediated = tuple(_with_remediation(i) for i in items)
    return ComplianceReport(
        mode="strict",
        overall_status=overall,
        items=remediated,
        registered_xinchuang_connectors=tuple(xc_registered),
    )


def assert_xinchuang_compliant(settings: Settings | None = None) -> None:
    report = build_compliance_report(settings)
    if report.overall_status == "non_compliant":
        raise XinchuangComplianceError(XINCHUANG_NON_COMPLIANT, "xinchuang compliance check failed")


@dataclass(frozen=True)
class XinchuangDeploymentReport:
    schema_version: str
    generated_at: str
    missing_expected_types: tuple[str, ...]
    components: tuple[dict, ...]
    registered_xinchuang_connectors: tuple[str, ...]
    compose_services: tuple[str, ...]
    dialect_readonly_smoke: tuple[dict, ...]
    overall_acceptance: str


@dataclass(frozen=True)
class DeploymentProbeResult:
    elapsed_ms: float
    ok: bool


def _parse_compose_services() -> tuple[str, ...]:
    path = pathlib.Path(__file__).resolve().parents[4] / "docker-compose.yml"
    names: list[str] = []
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if (
            line.startswith("  ")
            and not line.startswith("    ")
            and stripped.endswith(":")
            and "services" not in stripped
        ):
            names.append(stripped.rstrip(":"))
    return tuple(n for n in names if n != "services")


def build_xinchuang_deployment_report() -> XinchuangDeploymentReport:
    xc = _registered_xinchuang()
    registered_set = set(xc)
    missing = sorted(set(EXPECTED_XINCHUANG_TYPES) - registered_set)
    smoke = []
    for t in xc:
        conn = registry.get(t)
        ok = conn is not None
        smoke.append({"type": t, "ok": ok})
    overall = "accepted" if xc else "conditional"
    if not xc:
        raise XinchuangComplianceError(XINCHUANG_NON_COMPLIANT, "missing xinchuang connectors")
    return XinchuangDeploymentReport(
        schema_version="1.0",
        generated_at=datetime.now(UTC).isoformat(),
        missing_expected_types=tuple(missing),
        components=(
            {"kind": "db", "name": "postgres", "status": "sample"},
            {"kind": "middleware", "name": "none", "status": "warn"},
            {"kind": "os", "name": "linux", "status": "stub"},
        ),
        registered_xinchuang_connectors=tuple(xc),
        compose_services=_parse_compose_services(),
        dialect_readonly_smoke=tuple(smoke),
        overall_acceptance=overall,
    )


def render_deployment_report_markdown(report: XinchuangDeploymentReport) -> str:
    lines = [
        "## 信创部署验收报告",
        "",
        f"- schemaVersion: {report.schema_version}",
        f"- generatedAt: {report.generated_at}",
        f"- overallAcceptance: {report.overall_acceptance}",
        "",
        "### 已注册信创连接器",
    ]
    for conn in report.registered_xinchuang_connectors:
        lines.append(f"- {conn}")
    if report.missing_expected_types:
        lines.extend(["", "### 缺失预期类型"])
        for missing in report.missing_expected_types:
            lines.append(f"- {missing}")
    lines.extend(["", "### Compose 服务"])
    for svc in report.compose_services:
        lines.append(f"- {svc}")
    lines.extend(["", "### 方言只读 smoke"])
    for item in report.dialect_readonly_smoke:
        lines.append(f"- {item['type']}: {'ok' if item['ok'] else 'fail'}")
    return "\n".join(lines)


def probe_deployment_report_budget_ms() -> DeploymentProbeResult:
    started = time.perf_counter()
    build_xinchuang_deployment_report()
    elapsed = (time.perf_counter() - started) * 1000
    return DeploymentProbeResult(elapsed_ms=elapsed, ok=elapsed < 100)
