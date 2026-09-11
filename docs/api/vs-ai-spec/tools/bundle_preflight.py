"""Offline preflight for customViz bundles — same rules as POST /ai-viz/artifacts."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class PreflightIssue:
    code: str
    message: str
    http_status: int = 422


@dataclass
class PreflightResult:
    ok: bool
    errors: list[PreflightIssue] = field(default_factory=list)
    warnings: list[dict[str, str]] = field(default_factory=list)
    style_compliance_tier: str | None = None


def pack_dir() -> Path:
    here = Path(__file__).resolve().parent
    for candidate in (here.parent, here.parent / "docs" / "api" / "vs-ai-spec"):
        if (candidate / "examples" / "custom-viz-d3-bundle.json").is_file():
            return candidate
    raise SystemExit("cannot find examples/custom-viz-d3-bundle.json")


def find_vitalspan_backend(start: Path | None = None) -> Path | None:
    env_root = __import__("os").environ.get("VITALSPAN_ROOT")
    if env_root:
        backend = Path(env_root) / "backend"
        if (backend / "app" / "ai_viz" / "models.py").is_file():
            return backend
    cursor = (start or Path(__file__).resolve()).resolve()
    for parent in (cursor, *cursor.parents):
        backend = parent / "backend"
        if (backend / "app" / "ai_viz" / "models.py").is_file():
            return backend
    return None


def load_bundle(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit("bundle root must be a JSON object")
    if "manifest" not in raw or "files" not in raw:
        raise SystemExit("bundle must be {manifest, files}; vanilla/iife packages are rejected")
    return raw


def _minimal_structure_errors(bundle: dict[str, Any]) -> list[PreflightIssue]:
    issues: list[PreflightIssue] = []
    manifest = bundle.get("manifest")
    files = bundle.get("files")
    if not isinstance(manifest, dict):
        issues.append(PreflightIssue("AIVIZ_INVALID_MANIFEST", "manifest must be an object"))
        return issues
    if not isinstance(files, dict) or not files:
        issues.append(PreflightIssue("AIVIZ_INVALID_FILES", "files must be a non-empty object"))
        return issues
    for name, content in files.items():
        if isinstance(content, dict):
            issues.append(
                PreflightIssue(
                    "AIVIZ_INVALID_FILES",
                    f'files[{name!r}] must be a string, not an object with "content"',
                )
            )
            break
    entry = manifest.get("entry") or "index.html"
    if entry not in files:
        issues.append(PreflightIssue("AIVIZ_MISSING_ENTRY", f"files must include entry {entry!r}"))
    return issues


def preflight_bundle(bundle: dict[str, Any], *, backend_root: Path | None = None) -> PreflightResult:
    structure_errors = _minimal_structure_errors(bundle)
    if structure_errors:
        return PreflightResult(ok=False, errors=structure_errors)

    backend = backend_root or find_vitalspan_backend()
    if backend is not None and not (backend / "app" / "ai_viz" / "models.py").is_file():
        backend = None
    if backend is None:
        return PreflightResult(
            ok=False,
            errors=[
                PreflightIssue(
                    "AIVIZ_PREFLIGHT_NO_BACKEND",
                    "cannot import VitalSpan backend for full lint. "
                    "Set VITALSPAN_ROOT to your VitalSpan clone, e.g. "
                    "VITALSPAN_ROOT=C:\\Users\\you\\Desktop\\VitalSpan "
                    "(PowerShell: $env:VITALSPAN_ROOT='C:\\...\\VitalSpan'), "
                    "or run validate/upload from inside the VitalSpan repo.",
                    500,
                )
            ],
        )

    backend_str = str(backend)
    if backend_str not in sys.path:
        sys.path.insert(0, backend_str)

    from pydantic import ValidationError

    from app.ai_viz.errors import AiVizError
    from app.ai_viz.models import validate_bundle_files, validate_manifest
    from app.ai_viz.schemas import AiVizArtifactCreateIn
    from app.ai_viz.style_compliance import (
        collect_bundle_style_compliance_warnings,
        resolve_style_compliance_tier,
    )

    errors: list[PreflightIssue] = []
    try:
        payload = AiVizArtifactCreateIn.model_validate(bundle)
    except ValidationError as exc:
        for item in exc.errors():
            loc = ".".join(str(part) for part in item.get("loc", ()))
            errors.append(
                PreflightIssue(
                    "AIVIZ_VALIDATION_ERROR",
                    f"{loc}: {item.get('msg', 'invalid')}",
                )
            )
        return PreflightResult(ok=False, errors=errors)

    manifest_dict = payload.manifest.model_dump(by_alias=True)
    entry = payload.manifest.entry or "index.html"
    try:
        validate_manifest(manifest_dict)
        validate_bundle_files(payload.files, entry, manifest_dict)
    except AiVizError as exc:
        errors.append(PreflightIssue(exc.code, exc.message, exc.status))
        return PreflightResult(ok=False, errors=errors)

    raw_warnings = collect_bundle_style_compliance_warnings(payload.files, entry, manifest_dict)
    warnings = [{"code": w.code, "message": w.message} for w in raw_warnings]
    tier = resolve_style_compliance_tier(raw_warnings, manifest_dict)
    return PreflightResult(ok=True, warnings=warnings, style_compliance_tier=tier)


def preflight_to_payload(result: PreflightResult) -> dict[str, Any]:
    from aiviz_publish_hints import fixes_for_issues

    errors = [
        {"code": e.code, "message": e.message, "httpStatus": e.http_status}
        for e in result.errors
    ]
    warnings = list(result.warnings)
    tier = result.style_compliance_tier
    ok = result.ok and tier == "full" and not warnings
    next_tools = (
        ["vitalspan_publish_artifact"]
        if ok
        else ["vitalspan_get_contract_card", "vitalspan_validate_artifact"]
    )
    return {
        "ok": ok,
        "preflightOk": result.ok,
        "errors": errors,
        "warnings": warnings,
        "fixes": fixes_for_issues(errors, warnings),
        "styleComplianceTier": tier,
        "nextTools": next_tools,
    }


def format_preflight_lines(result: PreflightResult) -> list[str]:
    from aiviz_publish_hints import format_error_block

    lines: list[str] = []
    if result.errors:
        lines.append("preflight FAILED:")
        for item in result.errors:
            lines.extend(format_error_block(item.code, item.message, item.http_status))
        lines.append("  → 下一步: vitalspan_get_contract_card · 按 fix/snippet 改 bundle 后重跑 validate")
        return lines
    lines.append("preflight ok")
    if result.style_compliance_tier:
        lines.append(f"  styleComplianceTier={result.style_compliance_tier}")
    if result.warnings:
        lines.append(f"  warnings ({len(result.warnings)}):")
        for warn in result.warnings:
            lines.append(f"    - {warn['code']}: {warn['message']}")
    else:
        lines.append("  warnings: none")
    return lines
