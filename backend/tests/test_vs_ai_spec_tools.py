"""Smoke tests for vs-ai-spec CLI tools (no live API required for validate-only)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_TOOLS = REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "tools"
TREND_SAMPLE = REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "examples" / "custom-viz-trend-line.json"


def _run_tool(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["VITALSPAN_ROOT"] = str(REPO_ROOT)
    return subprocess.run(
        [sys.executable, str(SPEC_TOOLS / script), *args],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_mvp_upload_validate_only_trend_sample() -> None:
    proc = _run_tool(
        "mvp-upload.py",
        "--file",
        "examples/custom-viz-trend-line.json",
        "--validate-only",
        "--skip-health",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "preflight ok" in proc.stdout or "mvp ok validate-only" in proc.stdout


def test_publish_validate_only_on_trend_gold_sample() -> None:
    assert TREND_SAMPLE.is_file()
    proc = _run_tool(
        "publish-ai-viz-artifact.py",
        "--file",
        str(TREND_SAMPLE),
        "--validate-only",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "preflight ok" in proc.stdout
    assert "styleComplianceTier=full" in proc.stdout


def test_validate_only_via_upload_script() -> None:
    proc = _run_tool(
        "upload-ai-viz-artifact.py",
        "--file",
        str(TREND_SAMPLE),
        "--validate-only",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "preflight ok" in proc.stdout
