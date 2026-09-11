"""Live E2E for wf3 LRC compose (rhythm-cv-stage + 2 customViz)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
import urllib.error
import urllib.request

REPO_ROOT = Path(__file__).resolve().parents[2]
_env_root = os.environ.get("DEEPTALK_VITALSPAN_PLUGIN_ROOT", "").strip()
PLUGIN_ROOT = Path(_env_root).expanduser() if _env_root else Path()
if not _env_root or not PLUGIN_ROOT.is_dir():
    candidate = REPO_ROOT.parent / "deeptalk-plugins" / "plugins" / "vitalspan"
    if candidate.is_dir():
        PLUGIN_ROOT = candidate


def _health_ok(url: str = "http://127.0.0.1:8000/health") -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


@pytest.mark.integration
def test_wf3_lrc_compose_live_e2e() -> None:
    if not _health_ok():
        pytest.skip("VitalSpan :8000 not reachable")
    script = PLUGIN_ROOT / "scripts" / "compose-rhythm-e2e.mjs"
    if not script.is_file():
        pytest.skip(f"missing plugin e2e script: {script}")
    dist = PLUGIN_ROOT / "dist" / "composeDashboard.js"
    if not dist.is_file():
        subprocess.run(
            ["npm", "run", "build"],
            cwd=str(PLUGIN_ROOT),
            check=True,
            shell=os.name == "nt",
        )
    env = os.environ.copy()
    env.setdefault("VITALSPAN_USERNAME", "admin")
    env.setdefault("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme")
    env["VITALSPAN_ROOT"] = str(REPO_ROOT)
    proc = subprocess.run(
        ["node", str(script)],
        cwd=str(PLUGIN_ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
        shell=os.name == "nt",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "ok e2e rhythm compose" in proc.stdout
    assert "kpi=0" in proc.stdout
    assert "rhythm=rhythm-cv-stage" in proc.stdout


def test_completion_gate_wf3_blocks_legacy_template_stdout() -> None:
    lib = str(REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "deeptalk-product" / "lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    from completion_gate import check_completion

    dash_id = "550e8400-e29b-41d4-a716-446655440000"
    stdout = (
        f"ok dashboardId={dash_id}\n"
        "template=de-classic-cockpit\n"
        "[warn] LEGACY_TEMPLATE → prefer rhythm + blocks\n"
        "layout widgets: 12 (chart=8 customViz=1 kpi=4)\n"
        "data binding: manual\n"
        "done: compose complete"
    )
    result = check_completion("3", f"完成 dashboardId={dash_id}", stdout)
    assert result.ok is False
    assert any("LEGACY" in r or "template" in r.lower() or "removed" in r.lower() for r in result.reasons)


def test_completion_gate_wf3_passes_upload_stdout() -> None:
    lib = str(REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "deeptalk-product" / "lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    from completion_gate import check_completion

    dash_id = "550e8400-e29b-41d4-a716-446655440000"
    stdout = (
        f"ok dashboardId={dash_id}\n"
        "layout widgets: 12 (chart=7 customViz=3 kpi=4)\n"
        "done: layout saved via upload — pass tool_stdout to completion_gate (wf3 default completion)"
    )
    result = check_completion("3", f"完成 dashboardId={dash_id}", stdout)
    assert result.ok is True


def test_route_request_wf3_returns_free_layout_not_template() -> None:
    lib = str(REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "deeptalk-product" / "lib")
    if lib not in sys.path:
        sys.path.insert(0, lib)
    from route_request import route_request

    payload = route_request("用两个组件拼数据大屏").to_dict()
    assert payload["ok"] is True
    assert payload["workflow"] == "3"
    assert payload.get("redirect") == "create_dashboard"
    assert "template" not in payload
    assert "rhythm" not in payload
