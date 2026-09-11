"""Offline bundle preflight (docs/api/vs-ai-spec/tools/bundle_preflight.py)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "docs/api/vs-ai-spec/tools"
sys.path.insert(0, str(TOOLS))

from bundle_preflight import preflight_bundle  # noqa: E402

_BACKEND = ROOT / "backend"
_GOLDEN = ROOT / "docs/api/vs-ai-spec/examples/custom-viz-d3-bundle.json"


def _load_golden() -> dict:
    return json.loads(_GOLDEN.read_text(encoding="utf-8"))


def test_preflight_golden_d3_example_ok() -> None:
    result = preflight_bundle(_load_golden(), backend_root=_BACKEND)
    assert result.ok is True
    assert result.style_compliance_tier == "full"
    assert result.errors == []
    assert result.warnings == []


def test_preflight_rejects_d3_without_mount() -> None:
    bundle = _load_golden()
    bundle["files"]["index.html"] = bundle["files"]["index.html"].replace("vsCv.mount", "onPayload")
    result = preflight_bundle(bundle, backend_root=_BACKEND)
    assert result.ok is False
    assert any(item.code == "AIVIZ_MOUNT_REQUIRED" for item in result.errors)


def test_preflight_rejects_html_without_mount() -> None:
    path = ROOT / "docs/api/vs-ai-spec/examples/generic-blank-html.json"
    bundle = json.loads(path.read_text(encoding="utf-8"))
    bundle["files"]["index.html"] = bundle["files"]["index.html"].replace("vsCv.mount", "onPayload")
    result = preflight_bundle(bundle, backend_root=_BACKEND)
    assert result.ok is False
    assert any(item.code == "AIVIZ_MOUNT_REQUIRED" for item in result.errors)


def test_preflight_warns_d3_transition_without_interrupt() -> None:
    bundle = _load_golden()
    html = bundle["files"]["index.html"]
    html = html.replace("svg.selectAll('*').remove()", "clipPath.transition();svg.selectAll('*').remove()")
    bundle["files"]["index.html"] = html
    result = preflight_bundle(bundle, backend_root=_BACKEND)
    assert result.ok is True
    assert any(w["code"] == "AIVIZ_WARN_D3_INTERRUPT" for w in result.warnings)


def test_preflight_rejects_files_content_object() -> None:
    bundle = _load_golden()
    bundle["files"]["index.html"] = {"content": "<html></html>"}
    result = preflight_bundle(bundle, backend_root=_BACKEND)
    assert result.ok is False
    assert any(item.code == "AIVIZ_INVALID_FILES" for item in result.errors)


def test_preflight_trend_line_gold_sample_ok() -> None:
    path = ROOT / "docs/api/vs-ai-spec/examples/custom-viz-trend-line.json"
    bundle = json.loads(path.read_text(encoding="utf-8"))
    result = preflight_bundle(bundle, backend_root=_BACKEND)
    assert result.ok is True
    assert result.style_compliance_tier == "full"
    assert result.warnings == []


def test_preflight_no_backend_returns_actionable_error() -> None:
    bundle = _load_golden()
    result = preflight_bundle(bundle, backend_root=Path("/nonexistent/vitalspan/backend"))
    assert result.ok is False
    assert len(result.errors) == 1
    assert result.errors[0].code == "AIVIZ_PREFLIGHT_NO_BACKEND"
    assert "VITALSPAN_ROOT" in result.errors[0].message
