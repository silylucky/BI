#!/usr/bin/env python3
"""Delete dashboard or data-screen by uuid."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

from vitalspan_http import default_api, default_credentials, delete_dashboard, login


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dashboard_id", help="uuid from vitalspan_list_dashboards")
    parser.add_argument("--api", default=os.environ.get("VITALSPAN_API", default_api()))
    parser.add_argument("--username", default=default_credentials()[0])
    parser.add_argument("--password", default=default_credentials()[1])
    args = parser.parse_args()

    api = str(args.api).rstrip("/")
    token = login(api, args.username, args.password)
    delete_dashboard(api, token, args.dashboard_id)
    print(f"ok deleted dashboardId={args.dashboard_id}")


if __name__ == "__main__":
    main()
