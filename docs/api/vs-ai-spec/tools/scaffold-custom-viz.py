#!/usr/bin/env python3
"""Scaffold a publish-ready customViz bundle from official gold templates.

  python tools/scaffold-custom-viz.py --id my-widget --name 我的组件
  python tools/scaffold-custom-viz.py --id my-widget --name 我的组件 --template generic-blank-d3
  # 维护者/CI 才用金样 template；DeepTalk Agent 须走 vitalspan_scaffold_artifact（仅 generic-blank）
  python tools/scaffold-custom-viz.py --id my-scroll-table --name 我的流动表 --template scrolling-table

Then edit renderBusiness / #vs-cv-canvas in examples/<id>.json, then validate + publish:

  python tools/validate-ai-viz-bundle.py --file examples/my-widget.json --json
  python tools/publish-ai-viz-artifact.py --file examples/my-widget.json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"
TEMPLATES: dict[str, str] = {
    "generic-blank-html": "generic-blank-html.json",
    "generic-blank-d3": "generic-blank-d3.json",
    "html-minimal": "html-minimal.json",
    "scrolling-table": "scrolling-table.json",
    "alert-feed": "custom-viz-alert-feed.json",
    "ranking-bar": "custom-viz-ranking-bar-chart-fixed.json",
    "trend-line": "custom-viz-trend-line.json",
}
DEFAULT_TEMPLATE = "generic-blank-html"


def slug_ok(value: str) -> bool:
    return bool(re.fullmatch(r"[a-z][a-z0-9-]{1,48}", value))


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaffold customViz bundle from gold template")
    parser.add_argument("--id", required=True, help="manifest.id, e.g. my-scroll-table")
    parser.add_argument("--name", required=True, help="manifest.displayName (Chinese OK)")
    parser.add_argument(
        "--template",
        default=DEFAULT_TEMPLATE,
        choices=sorted(TEMPLATES.keys()),
        help="gold template (default generic-blank-html; Agent 工具仅 generic-blank；金样 template 仅维护者/CI)",
    )
    parser.add_argument("--out", type=Path, default=None, help="output json path")
    args = parser.parse_args()

    if not slug_ok(args.id):
        raise SystemExit("id must match [a-z][a-z0-9-]{1,48}")

    src_name = TEMPLATES[args.template]
    src = EXAMPLES / src_name
    if not src.is_file():
        raise SystemExit(f"template missing: {src}")

    bundle = json.loads(src.read_text(encoding="utf-8"))
    manifest = bundle.setdefault("manifest", {})
    manifest["id"] = args.id
    manifest["displayName"] = args.name
    manifest["version"] = "1.0.0"

    out = args.out or (EXAMPLES / f"{args.id}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok {out}")
    print(f"  template={args.template} from {src_name}")
    print("  next: edit bundle if needed, then:")
    print(f"  python tools/validate-ai-viz-bundle.py --file {out.relative_to(ROOT)} --json")
    print(f"  python tools/publish-ai-viz-artifact.py --file {out.relative_to(ROOT)}")
    print("  只改 #vs-cv-canvas / renderBusiness；失败看 validate --json 的 fix/snippet")

    bundle_html = EXAMPLES / f"{args.id}.bundle.html"
    src_html = EXAMPLES / src_name.replace(".json", ".bundle.html")
    if src_html.is_file() and not bundle_html.exists():
        shutil.copy2(src_html, bundle_html)
        print(f"  copied editable source → {bundle_html.name}")


if __name__ == "__main__":
    main()
