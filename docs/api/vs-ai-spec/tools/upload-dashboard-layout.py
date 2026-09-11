#!/usr/bin/env python3
"""PUT layoutJson to /dashboards/{id}/editor-save (dashboard composition)."""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, default_credentials, login, pack_dir, request_json, resolve_spec_path


def load_editor_save_body(path: Path) -> dict:
    doc = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        raise SystemExit("file root must be a JSON object")
    if "layoutJson" in doc:
        body: dict = {"layoutJson": doc["layoutJson"]}
        if "name" in doc:
            body["name"] = doc["name"]
        if "globalFilters" in doc:
            body["globalFilters"] = doc["globalFilters"]
        return body
    if doc.get("version") == 2 and "widgets" in doc:
        return {"layoutJson": doc}
    raise SystemExit("expected {layoutJson: ...} or a layout v2 root object")


def main() -> None:
    pack = pack_dir()
    parser = argparse.ArgumentParser(description="Save dashboard layout via editor-save")
    parser.add_argument(
        "--dashboard-id",
        required=True,
        help="target dashboard uuid (VitalSpan 方提供或从管理面 URL 获取)",
    )
    parser.add_argument(
        "--file",
        type=Path,
        default=pack / "examples" / "e2e-mixed-screen.json",
    )
    parser.add_argument("--api", default=default_api())
    parser.add_argument("--username", default=default_credentials()[0])
    parser.add_argument("--password", default=default_credentials()[1])
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="parse file only; do not PUT",
    )
    args = parser.parse_args()

    try:
        dashboard_id = str(uuid.UUID(args.dashboard_id))
    except ValueError as exc:
        raise SystemExit(f"invalid --dashboard-id: {args.dashboard_id}") from exc

    path = resolve_spec_path(pack, args.file)
    body = load_editor_save_body(path)
    widget_count = len(body["layoutJson"].get("widgets", []))
    print(f"layout widgets: {widget_count}")

    if args.dry_run:
        print("dry-run ok (no HTTP)")
        return

    api = args.api.rstrip("/")
    print(f"save target: PUT {api}/dashboards/{dashboard_id}/editor-save")
    token = login(api, args.username, args.password)
    result = request_json("PUT", f"{api}/dashboards/{dashboard_id}/editor-save", body, token)
    dashboard = result.get("dashboard") or {}
    saved_id = dashboard.get("id") or dashboard.get("dashboardId")
    saved_name = dashboard.get("name", "")
    print(f"ok dashboardId={saved_id} name={saved_name!r}")
    print(f"verify GET {api}/dashboards/{dashboard_id}")


if __name__ == "__main__":
    main()
