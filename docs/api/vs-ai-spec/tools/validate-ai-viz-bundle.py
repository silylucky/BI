#!/usr/bin/env python3
"""Local preflight before POST /ai-viz/artifacts (same lint as the API).

Run from spec pack root or VitalSpan repo:

  python tools/validate-ai-viz-bundle.py
  python tools/validate-ai-viz-bundle.py --file examples/custom-viz-trend-line.json

Requires VitalSpan backend on PYTHONPATH (auto-detected via VITALSPAN_ROOT or repo walk).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from aiviz_publish_hints import format_error_block
from bundle_preflight import (
    format_preflight_lines,
    load_bundle,
    pack_dir,
    preflight_bundle,
    preflight_to_payload,
)


def main() -> None:
    pack = pack_dir()
    parser = argparse.ArgumentParser(description="Validate customViz bundle before upload")
    parser.add_argument(
        "--file",
        type=Path,
        default=pack / "examples" / "custom-viz-d3-bundle.json",
        help="bundle JSON path (relative to pack root or absolute)",
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable result")
    args = parser.parse_args()

    path = args.file if args.file.is_absolute() else pack / args.file
    if not path.is_file():
        path = Path.cwd() / args.file
    if not path.is_file():
        raise SystemExit(f"bundle not found: {args.file}")

    bundle = load_bundle(path)
    result = preflight_bundle(bundle)

    payload = preflight_to_payload(result)
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        for line in format_preflight_lines(result):
            print(line)

    if not payload["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
