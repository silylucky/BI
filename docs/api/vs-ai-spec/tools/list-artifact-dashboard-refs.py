#!/usr/bin/env python3
"""List dashboards/data-screens referencing a customViz artifactId."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, default_credentials, get_artifact_refs, login


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact_id", help="uuid from vitalspan_list_artifacts")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    parser.add_argument("--username", default=default_credentials()[0])
    parser.add_argument("--password", default=default_credentials()[1])
    args = parser.parse_args()

    api = str(args.api).rstrip("/")
    token = login(api, args.username, args.password)
    data = get_artifact_refs(api, token, args.artifact_id)
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    refs = data.get("references") or []
    aid = data.get("artifactId") or data.get("artifact_id") or args.artifact_id
    print(f"artifactId={aid} references={len(refs)}")
    for item in refs:
        did = item.get("dashboardId") or item.get("dashboard_id")
        name = item.get("dashboardName") or item.get("dashboard_name") or "?"
        wid = item.get("widgetId") or item.get("widget_id") or "?"
        print(f"  dashboardId={did} name={name!r} widgetId={wid}")


if __name__ == "__main__":
    main()
