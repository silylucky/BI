#!/usr/bin/env python3
"""Create dashboard or data-screen via API (no browser login).

  python tools/create-dashboard.py --surface-kind data-screen --name "运营大屏"
  python tools/create-dashboard.py --surface-kind dashboard
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, default_credentials, health_check, login, request_json

DATA_SCREEN_EMPTY_LAYOUT = {
    "version": 2,
    "canvas": {"width": 1920, "height": 1080},
    "widgets": [],
    "globalFilters": [],
    "styleConfig": {
        "surfaceKind": "data-screen",
        "colorScheme": "dark",
        "scaleMode": "canvas",
        "gapPreset": "none",
        "widgetGap": 0,
        "pixelGutter": 0,
        "refreshIntervalSec": 60,
    },
}


def fe_edit_url(fe_base: str, dashboard_id: str, surface_kind: str) -> str:
    base = fe_base.rstrip("/")
    segment = "data-screens" if surface_kind == "data-screen" else "dashboards"
    return f"{base}/{segment}/{dashboard_id}/edit"


def main() -> None:
    parser = argparse.ArgumentParser(description="Create VitalSpan dashboard or data-screen")
    parser.add_argument(
        "--surface-kind",
        required=True,
        choices=["dashboard", "data-screen"],
        help="dashboard=仪表板, data-screen=数据大屏",
    )
    parser.add_argument("--name", default=None)
    parser.add_argument("--api", default=default_api())
    parser.add_argument("--fe", default=None, help="FE base, default VITALSPAN_FE or http://127.0.0.1:5173/admin")
    parser.add_argument("--skip-health", action="store_true")
    args = parser.parse_args()

    import os

    api = args.api.rstrip("/")
    fe = args.fe or os.environ.get("VITALSPAN_FE", "http://127.0.0.1:5173/admin")

    if not args.skip_health:
        health_check(api)

    surface = args.surface_kind
    default_name = "未命名大屏" if surface == "data-screen" else "未命名看板"
    name = (args.name or default_name).strip()
    slug_prefix = "screen" if surface == "data-screen" else "dash"
    slug = f"{slug_prefix}-{int(time.time() * 1000)}"

    token = login(api)
    created = request_json("POST", f"{api}/dashboards", {"name": name, "slug": slug}, token)
    dashboard_id = created.get("id")
    if not dashboard_id:
        raise SystemExit("POST /dashboards missing id")

    if surface == "data-screen":
        request_json(
            "PUT",
            f"{api}/dashboards/{dashboard_id}/layout",
            {"layoutJson": DATA_SCREEN_EMPTY_LAYOUT},
            token,
        )

    label = "数据大屏" if surface == "data-screen" else "仪表板"
    print(f"ok dashboardId={dashboard_id} surfaceKind={surface} ({label})")
    print(f"name={name!r} slug={slug}")
    print(f"edit {fe_edit_url(fe, dashboard_id, surface)}")
    print("next: upload-dashboard-layout.py or vitalspan_upload_dashboard")


if __name__ == "__main__":
    main()
