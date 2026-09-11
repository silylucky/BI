"""Gov data-screen compose template export (vs-ai-spec assets)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPORT_SCRIPT = REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "tools" / "export-gov-compose-templates.py"
ASSETS = REPO_ROOT / "docs" / "api" / "vs-ai-spec" / "assets" / "layout-templates"


def test_gov_compose_templates_exported() -> None:
    assert EXPORT_SCRIPT.is_file()
    proc = subprocess.run(
        [sys.executable, str(EXPORT_SCRIPT), "--rebuild-index"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout

    index = json.loads((ASSETS / "index.json").read_text(encoding="utf-8"))
    assert index["version"] == 3
    assert len(index["recommendedGovDataScreen"]) == 6
    assert len(index["templates"]) == 21

    eco = json.loads((ASSETS / "gov-eco-monitor.json").read_text(encoding="utf-8"))
    assert eco["platformTemplateKey"] == "builtin-gov-eco-monitor"
    assert eco["composeHints"]["preserveCoordinates"] is True
    chart_slots = [slot for slot in eco["slots"] if slot["type"] == "chart"]
    assert len(chart_slots) == 7
    assert chart_slots[0]["defaultChartType"] == "map-3d"
