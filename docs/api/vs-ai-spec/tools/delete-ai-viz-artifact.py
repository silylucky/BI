#!/usr/bin/env python3
"""Delete customViz artifact(s) from platform library (owner only)."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, delete_artifact, list_artifacts, login


def _print_delete_result(artifact_id: str, payload: dict) -> None:
    unlinked = payload.get("unlinked") or []
    for item in unlinked:
        dash_name = item.get("dashboardName") or item.get("dashboard_name") or "?"
        widget_ids = item.get("removedWidgetIds") or item.get("removed_widget_ids") or []
        print(f"ok unlinked dashboard={dash_name} widgets={','.join(widget_ids) or '-'}")
    print(f"ok deleted artifactId={artifact_id}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact_id", nargs="?", help="uuid to delete")
    parser.add_argument("--all", action="store_true", help="delete all artifacts owned by current user")
    parser.add_argument(
        "--unlink",
        action="store_true",
        help="remove referencing widgets from dashboards before delete (see ?unlink=true)",
    )
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    parser.add_argument("--username", default=os.environ.get("VITALSPAN_USERNAME", "admin"))
    parser.add_argument("--password", default=os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD", "changeme"))
    parser.add_argument("--yes", action="store_true", help="skip confirmation for --all")
    args = parser.parse_args()
    api = str(args.api).rstrip("/")
    token = login(api, args.username, args.password)

    if args.all:
        if not args.yes:
            raise SystemExit("refusing --all without --yes")
        data = list_artifacts(api, token, limit=200, offset=0)
        items = data.get("items") or []
        for item in items:
            artifact_id = item.get("artifactId") or item.get("artifact_id")
            if not artifact_id:
                continue
            payload = delete_artifact(api, token, str(artifact_id), unlink=args.unlink)
            _print_delete_result(str(artifact_id), payload)
        print(f"ok deleted count={len(items)}")
        return

    if not args.artifact_id:
        raise SystemExit("artifact_id required unless --all")

    payload = delete_artifact(api, token, args.artifact_id, unlink=args.unlink)
    _print_delete_result(args.artifact_id, payload)


if __name__ == "__main__":
    main()
