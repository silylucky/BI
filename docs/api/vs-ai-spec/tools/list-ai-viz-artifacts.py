#!/usr/bin/env python3
"""List current user's customViz artifacts in platform library."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, list_artifacts, login


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    parser.add_argument("--username", default=os.environ.get("VITALSPAN_USERNAME", "admin"))
    parser.add_argument("--password", default=os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme"))
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--q", default="", help="case-insensitive filter on manifest id/displayName")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    api = str(args.api).rstrip("/")
    token = login(api, args.username, args.password)
    data = list_artifacts(api, token, limit=args.limit, offset=args.offset)
    items = data.get("items") or []
    q = (args.q or "").strip().lower()
    if q:
        filtered = []
        for item in items:
            manifest = item.get("manifest") or {}
            hay = " ".join(
                [
                    str(item.get("artifactId") or item.get("artifact_id") or ""),
                    str(manifest.get("id") or ""),
                    str(manifest.get("displayName") or ""),
                ]
            ).lower()
            if q in hay:
                filtered.append(item)
        items = filtered

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    print(f"count {len(items)}")
    for item in items:
        manifest = item.get("manifest") or {}
        slug = manifest.get("id") or "?"
        name = manifest.get("displayName") or slug
        tier = item.get("styleComplianceTier") or item.get("style_compliance_tier") or "?"
        print(f"  {item.get('artifactId')}  id={slug}  {name}  tier={tier}")


if __name__ == "__main__":
    main()
