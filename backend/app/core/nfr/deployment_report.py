from __future__ import annotations

import pathlib
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from app.core.nfr.runtime_guard import RuntimeCheckItem, RuntimeComplianceReport, build_runtime_report

SCAN_BUDGET_MS = 100
REPORT_VERSION = "nfr08-deployment-v1"
SCHEMA_VERSION = "1.0"
FORBIDDEN_COMPOSE_TOKENS = ("superset", "dataease", "apache-superset")


@dataclass(frozen=True)
class DeploymentAcceptanceReport:
    report_version: str
    schema_version: str
    generated_at: str
    runtime: RuntimeComplianceReport
    acceptance_checklist: tuple[RuntimeCheckItem, ...]
    overall_acceptance: Literal["accepted", "rejected", "conditional"]
    ops_summary: str
    remediation_index: dict[str, str]
    compose_services: tuple[str, ...]
    forbidden_compose_hits: tuple[str, ...]


def _read_compose_text() -> str:
    path = pathlib.Path(__file__).resolve().parents[4] / "docker-compose.yml"
    return path.read_text(encoding="utf-8")


def _parse_compose_services(compose_text: str) -> tuple[str, ...]:
    names: list[str] = []
    for line in compose_text.splitlines():
        stripped = line.strip()
        if (
            line.startswith("  ")
            and not line.startswith("    ")
            and stripped.endswith(":")
            and stripped.rstrip(":") != "services"
        ):
            names.append(stripped.rstrip(":"))
    return tuple(names)


def _scan_forbidden_compose_hits(compose_text: str, services: tuple[str, ...]) -> tuple[str, ...]:
    hits: list[str] = []
    for svc in services:
        lowered = svc.lower()
        if any(tok in lowered for tok in FORBIDDEN_COMPOSE_TOKENS):
            hits.append(svc)
    for line in compose_text.splitlines():
        if "image:" in line.lower():
            fragment = line.split(":", 1)[1].strip()
            lowered = fragment.lower()
            if any(tok in lowered for tok in FORBIDDEN_COMPOSE_TOKENS):
                hits.append(fragment)
    return tuple(dict.fromkeys(hits))


def render_nfr08_deployment_markdown(report: DeploymentAcceptanceReport) -> str:
    lines = [
        "## 零第三方 BI 部署验收报告",
        "",
        f"- schemaVersion: {report.schema_version}",
        f"- reportVersion: {report.report_version}",
        f"- generatedAt: {report.generated_at}",
        f"- overallAcceptance: {report.overall_acceptance}",
        "",
        "### Runtime 摘要",
        f"- overallStatus: {report.runtime.overall_status}",
        f"- zeroThirdPartyBiRuntime: {report.runtime.zero_third_party_bi_runtime}",
        "",
        "### Compose 服务",
    ]
    for svc in report.compose_services:
        lines.append(f"- {svc}")
    lines.extend(["", "### 禁入命中"])
    if report.forbidden_compose_hits:
        for hit in report.forbidden_compose_hits:
            lines.append(f"- {hit}")
    else:
        lines.append("- （无）")
    if report.remediation_index:
        lines.extend(["", "### remediation_index"])
        for key, val in report.remediation_index.items():
            lines.append(f"- {key}: {val}")
    lines.extend(["", "### 门禁", "- 运行时与 compose 违规即 rejected（无 permissive 模式）"])
    return "\n".join(lines)


def build_deployment_acceptance_report(
    pyproject_text: str | None = None,
    *,
    mode: str | None = None,
    compose_text: str | None = None,
) -> DeploymentAcceptanceReport:
    del mode
    runtime = build_runtime_report(pyproject_text)
    compose_raw = compose_text if compose_text is not None else _read_compose_text()
    compose_services = _parse_compose_services(compose_raw)
    forbidden_hits = _scan_forbidden_compose_hits(compose_raw, compose_services)
    compose_item = RuntimeCheckItem(
        "compose-forbidden-services",
        "pass" if not forbidden_hits else "fail",
        "docker-compose must not include Superset/DataEase images or service names",
    )
    extra = (
        compose_item,
        RuntimeCheckItem(
            "deployment-ready",
            "pass" if runtime.overall_status == "compliant" else "fail",
            "Runtime must be compliant for deployment",
        ),
    )
    checklist = runtime.items + extra
    remediation = {i.id: i.remediation for i in checklist if i.remediation and i.status == "fail"}
    if forbidden_hits:
        remediation["compose-forbidden-services"] = (
            "Remove Superset/DataEase services or images from docker-compose.yml"
        )
    if runtime.overall_status == "compliant" and not forbidden_hits:
        overall: Literal["accepted", "rejected", "conditional"] = "accepted"
        ops = "Runtime compliance accepted; compose scan clean; ready for deployment verification."
    else:
        overall = "rejected"
        ops = "Deployment rejected; remediate runtime or compose violations."
    return DeploymentAcceptanceReport(
        report_version=REPORT_VERSION,
        schema_version=SCHEMA_VERSION,
        generated_at=datetime.now(UTC).isoformat(),
        runtime=runtime,
        acceptance_checklist=checklist,
        overall_acceptance=overall,
        ops_summary=ops,
        remediation_index=remediation,
        compose_services=compose_services,
        forbidden_compose_hits=forbidden_hits,
    )


def probe_deployment_report_budget_ms() -> float:
    start = time.perf_counter()
    build_deployment_acceptance_report("dependencies = []\n", compose_text="services:\n  postgres:\n")
    return (time.perf_counter() - start) * 1000.0
