"""Tests for DeepTalk product integration (plugin contract + vs-ai-spec tools)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_ROOT = REPO_ROOT / "docs" / "api" / "vs-ai-spec"
SPEC_TOOLS = SPEC_ROOT / "tools"
DEEPTALK_LIB = SPEC_ROOT / "deeptalk-product" / "lib"
TREND_SAMPLE = SPEC_ROOT / "examples" / "custom-viz-trend-line.json"
GENERIC_HTML = SPEC_ROOT / "examples" / "generic-blank-html.json"
CONTRACT_CARD = SPEC_ROOT / "assets" / "contract_card.json"


def _env() -> dict[str, str]:
    env = os.environ.copy()
    env["VITALSPAN_ROOT"] = str(REPO_ROOT)
    return env


def _run_tool(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SPEC_TOOLS / script), *args],
        cwd=str(SPEC_ROOT),
        env=_env(),
        capture_output=True,
        text=True,
        check=False,
    )


def _with_lib() -> None:
    lib = str(DEEPTALK_LIB)
    if lib not in sys.path:
        sys.path.insert(0, lib)


def test_completion_gate_passes_with_artifact_id() -> None:
    _with_lib()
    from completion_gate import check_completion

    result = check_completion(
        "2",
        "工作流 ② 完成 ok artifactId=00000000-0000-4000-8000-000000000001",
    )
    assert result.ok is True


def test_completion_gate_blocks_output_delivery() -> None:
    _with_lib()
    from completion_gate import check_completion

    result = check_completion("2", "已保存到 output/vs-trend-chart.json")
    assert result.ok is False
    assert any("forbidden" in r.lower() or "output" in r.lower() for r in result.reasons)


def test_completion_gate_wf3_blocks_demo_claim_without_demo_stdout() -> None:
    _with_lib()
    from completion_gate import check_completion

    dash_id = "550e8400-e29b-41d4-a716-446655440000"
    stdout = (
        f"ok dashboardId={dash_id}\nlayout widgets: 3\n"
        "data binding: manual — bind Dataset in 5173 editor\n"
        "done: compose complete"
    )
    result = check_completion(
        "3",
        f"完成 dashboardId={dash_id} 打开就能看演示",
        stdout,
    )
    assert result.ok is False
    assert any("demo" in r.lower() for r in result.reasons)


def test_completion_gate_wf3_blocks_style_claim_without_upload_stdout() -> None:
    _with_lib()
    from completion_gate import check_completion

    dash_id = "550e8400-e29b-41d4-a716-446655440000"
    stdout = (
        f"ok dashboardId={dash_id}\nlayout widgets: 3\n"
        "data binding: manual\n"
        "done: compose complete"
    )
    result = check_completion(
        "3",
        f"已完成电商风格配色 dashboardId={dash_id}",
        stdout,
    )
    assert result.ok is False
    assert any("upload" in r.lower() or "delivery" in r.lower() for r in result.reasons)


def test_completion_gate_wf3_blocks_layout_claim_without_upload_stdout() -> None:
    _with_lib()
    from completion_gate import check_completion

    dash_id = "550e8400-e29b-41d4-a716-446655440000"
    stdout = (
        f"ok dashboardId={dash_id}\nlayout widgets: 3\n"
        "data binding: manual\n"
        "done: compose complete"
    )
    result = check_completion(
        "3",
        f"已交付优化布局 dashboardId={dash_id}",
        stdout,
    )
    assert result.ok is False
    assert any("upload" in r.lower() or "delivery" in r.lower() for r in result.reasons)


def test_publish_validate_only_via_tools() -> None:
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


def test_agent_tools_schema_lists_v050_tools() -> None:
    schema_path = SPEC_ROOT / "deeptalk-product" / "agent-tools.schema.json"
    data = json.loads(schema_path.read_text(encoding="utf-8"))
    names = {t["name"] for t in data["tools"]}
    assert names == {
        "vitalspan_health_check",
        "vitalspan_get_contract_card",
        "vitalspan_get_capability_catalog",
        "vitalspan_scaffold_artifact",
        "vitalspan_validate_artifact",
        "vitalspan_publish_artifact",
        "vitalspan_list_artifacts",
        "vitalspan_delete_artifact",
        "vitalspan_get_artifact",
        "vitalspan_list_artifact_dashboard_refs",
        "vitalspan_delete_dashboard",
        "vitalspan_validate_chart_config",
        "vitalspan_validate_layout_draft",
        "vitalspan_patch_dashboard_layout",
        "vitalspan_apply_screen_theme",
        "vitalspan_route_request",
        "vitalspan_list_layout_references",
        "vitalspan_get_layout_reference",
        "vitalspan_list_layout_rhythms",
        "vitalspan_list_chart_types",
        "vitalspan_compose_dashboard",
        "vitalspan_get_dashboard_layout",
        "vitalspan_create_dashboard",
        "vitalspan_list_dashboards",
        "vitalspan_upload_dashboard",
        "vitalspan_completion_gate",
    }


def test_route_request_sankey() -> None:
    _with_lib()
    from route_request import route_request

    payload = route_request("客户要流向地图桑基图").to_dict()
    assert payload["ok"] is True
    assert payload["workflow"] == "1"
    assert payload.get("chartType") == "sankey"


def test_route_request_treemap() -> None:
    _with_lib()
    from route_request import route_request

    payload = route_request("商务矩形树图").to_dict()
    assert payload["ok"] is True
    assert payload["workflow"] == "1"
    assert payload.get("chartType") == "treemap"


def test_route_request_ranking_wf2_no_template() -> None:
    _with_lib()
    from route_request import route_request

    payload = route_request("部门销售排名榜").to_dict()
    assert payload["ok"] is True
    assert payload["workflow"] == "2"
    assert payload.get("runtime") == "html"
    assert payload.get("paradigm") == "P1-cartesian"
    assert "template" not in payload


def test_route_request_scrolling_table_paradigm() -> None:
    _with_lib()
    from route_request import route_request

    payload = route_request("多维明细滚动表").to_dict()
    assert payload["ok"] is True
    assert payload["workflow"] == "2"
    assert payload.get("paradigm") == "P2-multi-column-detail"
    assert "template" not in payload


def test_contract_card_json_valid() -> None:
    data = json.loads(CONTRACT_CARD.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert "mount" in data and "style" in data


def test_get_contract_card_via_tool() -> None:
    proc = _run_tool("get-contract-card.py")
    assert proc.returncode == 0, proc.stderr or proc.stdout
    payload = json.loads(proc.stdout)
    assert payload["publishGate"]


def test_scaffold_generic_blank_via_tool() -> None:
    proc = _run_tool(
        "scaffold-custom-viz.py",
        "--id",
        "test-hex-kpi",
        "--name",
        "测试六边形",
        "--template",
        "generic-blank-html",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    out = SPEC_ROOT / "examples" / "test-hex-kpi.json"
    assert out.is_file()
    bundle = json.loads(out.read_text(encoding="utf-8"))
    assert bundle["manifest"]["id"] == "test-hex-kpi"
    assert "renderBusiness" in bundle["files"]["index.html"]
    assert "rowsToSeries" in bundle["files"]["index.html"]
    out.unlink(missing_ok=True)


def test_scaffold_only_generic_blank_templates() -> None:
    for template in ("generic-blank-html", "generic-blank-d3"):
        slug = f"test-blank-{template.split('-')[-1]}"
        proc = _run_tool(
            "scaffold-custom-viz.py",
            "--id",
            slug,
            "--name",
            "测试空白",
            "--template",
            template,
        )
        assert proc.returncode == 0, proc.stderr or proc.stdout
        out = SPEC_ROOT / "examples" / f"{slug}.json"
        assert out.is_file()
        out.unlink(missing_ok=True)


def test_validate_generic_blank_full_via_tool() -> None:
    assert GENERIC_HTML.is_file()
    proc = _run_tool(
        "validate-ai-viz-bundle.py",
        "--file",
        str(GENERIC_HTML),
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "preflight ok" in proc.stdout or "ok validate stamp=" in proc.stdout
    assert "styleComplianceTier=full" in proc.stdout


def test_validate_json_includes_structured_fixes() -> None:
    proc = _run_tool(
        "validate-ai-viz-bundle.py",
        "--file",
        str(GENERIC_HTML),
        "--json",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    payload = json.loads(proc.stdout)
    assert payload["ok"] is True
    assert payload["styleComplianceTier"] == "full"
    assert payload["fixes"] == []
    assert "vitalspan_publish_artifact" in payload["nextTools"]


def test_hex_kpi_grid_validate_and_publish_tool() -> None:
    hex_path = SPEC_ROOT / "examples" / "hex-kpi-grid.json"
    assert hex_path.is_file(), "run tools/build-hex-kpi-example.py first"

    proc = _run_tool(
        "validate-ai-viz-bundle.py",
        "--file",
        str(hex_path),
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "preflight ok" in proc.stdout or "ok validate stamp=" in proc.stdout
    assert "styleComplianceTier=full" in proc.stdout

    proc = _run_tool(
        "publish-ai-viz-artifact.py",
        "--file",
        str(hex_path),
        "--validate-only",
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
    assert "preflight ok" in proc.stdout or "styleComplianceTier=full" in proc.stdout


def test_config_example_json_valid() -> None:
    path = SPEC_ROOT / "deeptalk-product" / "config.example.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert "vitalspan" in data
    assert data["vitalspan"]["api_base"].endswith("/api/v1")
