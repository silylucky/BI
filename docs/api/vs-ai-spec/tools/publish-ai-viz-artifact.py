#!/usr/bin/env python3
"""One-step validate + POST/PUT customViz bundle to VitalSpan.

  python tools/publish-ai-viz-artifact.py --file examples/my-widget.json
  python tools/publish-ai-viz-artifact.py --file examples/my-widget.json --artifact-id <uuid>
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from artifact_cli import pack_dir, print_publish_result, publish_bundle
from vitalspan_http import default_api


def main() -> None:
    pack = pack_dir()
    parser = argparse.ArgumentParser(description="Validate and publish customViz bundle")
    parser.add_argument(
        "--file",
        type=Path,
        default=pack / "examples" / "custom-viz-d3-bundle.json",
    )
    parser.add_argument("--artifact-id", default=None, help="existing uuid → PUT update")
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    parser.add_argument("--username", default=os.environ.get("VITALSPAN_USERNAME", "admin"))
    parser.add_argument("--password", default=os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme"))
    parser.add_argument("--health-first", action="store_true", help="GET /health before publish")
    parser.add_argument("--validate-only", action="store_true", help="preflight only, no HTTP upload")
    parser.add_argument("--skip-preflight", action="store_true", help="upload without local preflight")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON on success")
    args = parser.parse_args()
    result = publish_bundle(args)
    if args.validate_only:
        return
    print_publish_result(result, str(args.api).rstrip("/"), json_out=args.json)


if __name__ == "__main__":
    main()
