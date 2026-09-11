#!/usr/bin/env python3
"""MVP 大屏编排：复用组件库已有 artifactId，无需重新上传组件。

  python tools/mvp-dashboard.py --list-artifacts
  python tools/mvp-dashboard.py --dashboard-id <uuid> --file examples/e2e-mixed-screen.json
  python tools/mvp-dashboard.py --dashboard-id <uuid> --artifact-ids uuid1,uuid2 --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

import importlib.util

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

_mvp_spec = importlib.util.spec_from_file_location("mvp_upload", _TOOLS / "mvp-upload.py")
_mvp = importlib.util.module_from_spec(_mvp_spec)
assert _mvp_spec.loader is not None
_mvp_spec.loader.exec_module(_mvp)
apply_local_env = _mvp.apply_local_env
pack_root = _mvp.pack_root
from vitalspan_http import default_api, health_check


def _run_layout_tool(*args: str) -> subprocess.CompletedProcess[str]:
    pack = pack_root()
    apply_local_env(pack)
    cmd = [sys.executable, str(pack / "tools" / "upload-dashboard-layout.py"), *args]
    return subprocess.run(cmd, cwd=str(pack), capture_output=True, text=True, check=False)


def cmd_list_artifacts() -> int:
    pack = pack_root()
    apply_local_env(pack)
    proc = subprocess.run(
        [sys.executable, str(pack / "tools" / "list-ai-viz-artifacts.py")],
        cwd=str(pack),
        capture_output=True,
        text=True,
        check=False,
    )
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode == 0:
        print("--- 复用说明 ---")
        print("layout 里 customViz 填 customVizConfig.artifactId = 上列 uuid")
        print("同一 artifactId 可被多张大屏、多个 widget 引用")
    return proc.returncode


def build_layout_from_artifacts(artifact_ids: list[str]) -> dict:
    widgets = []
    x = 48
    for idx, aid in enumerate(artifact_ids):
        widgets.append(
            {
                "id": str(uuid.uuid4()),
                "type": "customViz",
                "title": f"组件 {idx + 1}",
                "x": x,
                "y": 48,
                "width": 640,
                "height": 360,
                "order": idx,
                "customVizConfig": {
                    "artifactId": aid,
                    "dataBinding": {"status": "manual"},
                },
            }
        )
        x += 680
    return {
        "version": 2,
        "canvas": {"width": max(1440, x + 48), "height": 1080},
        "widgets": widgets,
        "globalFilters": [],
    }


def main() -> None:
    pack = pack_root()
    parser = argparse.ArgumentParser(description="MVP dashboard layout (workflow 3)")
    parser.add_argument("--list-artifacts", action="store_true", help="list reusable artifactIds")
    parser.add_argument("--dashboard-id", help="target dashboard uuid")
    parser.add_argument("--file", help="layout JSON file under pack")
    parser.add_argument(
        "--artifact-ids",
        help="comma-separated uuids; build minimal layout (mutually exclusive with --file)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-health", action="store_true")
    parser.add_argument("--api", default=None)
    args = parser.parse_args()

    if args.list_artifacts:
        raise SystemExit(cmd_list_artifacts())

    if not args.dashboard_id:
        parser.error("--dashboard-id required (or use --list-artifacts)")

    api = apply_local_env(pack)
    if args.api:
        os.environ["VITALSPAN_API"] = str(args.api).rstrip("/")

    if not args.skip_health:
        health_check(os.environ.get("VITALSPAN_API", default_api()))

    if args.file:
        rel = args.file.replace("\\", "/")
        tool_args = ["--dashboard-id", args.dashboard_id, "--file", rel]
    elif args.artifact_ids:
        aids = [x.strip() for x in args.artifact_ids.split(",") if x.strip()]
        if not aids:
            raise SystemExit("no artifact ids provided")
        layout = build_layout_from_artifacts(aids)
        out = pack / "examples" / "_mvp-generated-layout.json"
        out.write_text(
            json.dumps({"layoutJson": layout, "name": "MVP 复用大屏"}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"ok draft {out.relative_to(pack).as_posix()}")
        tool_args = ["--dashboard-id", args.dashboard_id, "--file", out.relative_to(pack).as_posix()]
    else:
        parser.error("--file or --artifact-ids required")

    if args.dry_run:
        tool_args.append("--dry-run")

    proc = _run_layout_tool(*tool_args)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode == 0 and not args.dry_run:
        fe = os.environ.get("VITALSPAN_FE", "http://127.0.0.1:5173/admin")
        print("--- MVP 验收 ---")
        print(f"1. 打开 {fe}/dashboards/{args.dashboard_id}/edit")
        print("2. 应看到 layout 中的 customViz / chart widgets")
        print("3. 数据绑定在编辑器右侧手动完成")
    raise SystemExit(proc.returncode)


if __name__ == "__main__":
    main()
