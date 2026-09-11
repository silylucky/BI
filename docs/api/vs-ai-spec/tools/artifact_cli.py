"""Shared publish/list/delete logic for vs-ai-spec CLI tools."""

from __future__ import annotations

import json
import sys
from argparse import Namespace
from pathlib import Path
from typing import Any

from bundle_preflight import (
    PreflightResult,
    format_preflight_lines,
    load_bundle,
    preflight_bundle,
    preflight_to_payload,
)
from vitalspan_http import (
    create_artifact,
    default_api,
    health_check,
    login,
    pack_dir,
    resolve_spec_path,
    update_artifact,
)


def resolve_bundle_path(pack: Path, file_arg: Path) -> Path:
    return resolve_spec_path(pack, file_arg)


def run_preflight(
    bundle: dict[str, Any],
    *,
    skip: bool = False,
    json_out: bool = False,
) -> tuple[bool, PreflightResult | None]:
    if skip:
        return True, None
    preflight = preflight_bundle(bundle)
    if json_out:
        print(json.dumps(preflight_to_payload(preflight), ensure_ascii=False, indent=2))
    else:
        for line in format_preflight_lines(preflight):
            print(line)
    tier_ok = preflight.style_compliance_tier == "full" and not preflight.warnings
    return preflight.ok and tier_ok, preflight


def publish_bundle(args: Namespace) -> dict[str, Any]:
    pack = pack_dir()
    path = resolve_bundle_path(pack, args.file)
    bundle = load_bundle(path)
    api = default_api() if args.api is None else str(args.api).rstrip("/")
    json_out = getattr(args, "json", False)

    if getattr(args, "health_first", False):
        health_check(api)

    ok, _ = run_preflight(bundle, skip=getattr(args, "skip_preflight", False), json_out=json_out)
    if not ok:
        raise SystemExit(1)

    if getattr(args, "validate_only", False):
        return preflight_to_payload(preflight_bundle(bundle)) if json_out else {}

    token = login(api, args.username, args.password)
    artifact_id = getattr(args, "artifact_id", None)
    if artifact_id:
        print(f"upload target: PUT {api}/ai-viz/artifacts/{artifact_id}")
        result = update_artifact(api, token, str(artifact_id), bundle)
    else:
        print(f"upload target: POST {api}/ai-viz/artifacts (platform DB, not this folder)")
        result = create_artifact(api, token, bundle)

    return result


def print_publish_result(result: dict[str, Any], api: str, *, json_out: bool = False) -> None:
    artifact_id = result.get("artifactId") or result.get("artifact_id")
    tier = result.get("styleComplianceTier") or result.get("style_compliance_tier")
    warnings = result.get("warnings") or []

    if json_out:
        payload = dict(result)
        payload.setdefault("ok", bool(artifact_id))
        if warnings and tier != "full":
            from aiviz_publish_hints import fixes_for_issues

            payload["fixes"] = fixes_for_issues(None, warnings)
            payload["nextTools"] = ["vitalspan_validate_artifact", "vitalspan_get_contract_card"]
        elif payload.get("ok"):
            payload["nextTools"] = ["vitalspan_completion_gate"]
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    print(f"ok artifactId={artifact_id}")
    if tier:
        print(f"styleComplianceTier={tier}")
    if warnings:
        print(f"warnings ({len(warnings)}):")
        for warn in warnings:
            print(f"  - {warn.get('code', '?')}: {warn.get('message', '')}")
    else:
        print("warnings: none")
    print(f"entry GET {api}/ai-viz/artifacts/{artifact_id}/entry")
    print("--- next (workflow ③, optional) ---")
    print("component is in platform library; reuse artifactId on any dashboard:")
    print(f"  customVizConfig.artifactId = {artifact_id}")
    print("  then: upload-dashboard-layout.py --dashboard-id <uuid> --file <layout.json>")
