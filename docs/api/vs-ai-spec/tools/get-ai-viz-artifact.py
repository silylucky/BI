#!/usr/bin/env python3
"""Download customViz bundle from platform library to workspace examples/."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, default_credentials, get_artifact_bundle, login


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact_id", help="uuid from vitalspan_list_artifacts")
    parser.add_argument(
        "--file",
        default=None,
        help="output path under cwd, e.g. examples/my-widget.json (default examples/<manifest.id>.json)",
    )
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    parser.add_argument("--username", default=default_credentials()[0])
    parser.add_argument("--password", default=default_credentials()[1])
    args = parser.parse_args()

    api = str(args.api).rstrip("/")
    token = login(api, args.username, args.password)
    bundle = get_artifact_bundle(api, token, args.artifact_id)
    manifest = bundle.get("manifest") or {}
    slug = manifest.get("id") or "artifact"
    out = Path(args.file) if args.file else Path("examples") / f"{slug}.json"
    if not out.is_absolute():
        out = Path.cwd() / out
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"manifest": manifest, "files": bundle.get("files") or {}}
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    aid = bundle.get("artifactId") or bundle.get("artifact_id") or args.artifact_id
    rel = out.as_posix()
    if out.is_relative_to(Path.cwd()):
        rel = out.relative_to(Path.cwd()).as_posix()
    print(f"ok get artifactId={aid} file={rel}")
    print("next:")
    print(f"  1) edit render in {rel}")
    print(f"  2) vitalspan_validate_artifact file={rel}")
    print(f"  3) vitalspan_publish_artifact file={rel} artifact_id={aid}")


if __name__ == "__main__":
    main()
