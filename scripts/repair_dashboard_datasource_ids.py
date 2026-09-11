"""Repair stale dashboard chartConfig.dataSourceId references."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"


def login() -> str:
    body = json.dumps({"username": "admin", "password": "changeme"}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/v1/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)["accessToken"]


def api_json(method: str, path: str, token: str, payload: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main() -> None:
    token = login()
    ds_items = api_json("GET", "/api/v1/datasources", token).get("items", [])
    if not ds_items:
        raise SystemExit("No datasources available; create one first.")
    fallback_ds_id = ds_items[0]["id"]
    valid_ds = {d["id"] for d in ds_items}
    print("fallback_ds", fallback_ds_id, ds_items[0].get("name"))

    repaired_dashboards = 0
    repaired_widgets = 0
    offset = 0
    while True:
        page = api_json("GET", f"/api/v1/dashboards?limit=50&offset={offset}", token)
        items = page.get("items", [])
        if not items:
            break
        for item in items:
            did = item["id"]
            detail = api_json("GET", f"/api/v1/dashboards/{did}", token)
            layout = detail.get("layoutJson") or detail.get("layout")
            if not isinstance(layout, dict):
                continue
            changed = False
            for widget in layout.get("widgets", []):
                cc = widget.get("chartConfig")
                if not isinstance(cc, dict):
                    continue
                ds = cc.get("dataSourceId")
                if ds and ds not in valid_ds:
                    cc["dataSourceId"] = fallback_ds_id
                    changed = True
                    repaired_widgets += 1
                    if cc.get("mode") == "sql" and not cc.get("sql"):
                        cc["sql"] = "SELECT 1 AS value"
                if widget.get("type") == "chart" and cc.get("mode") == "sql":
                    if cc.get("dataSourceId") and not cc.get("sql"):
                        cc["sql"] = "SELECT 1 AS value"
                        changed = True
            if changed:
                api_json(
                    "PUT",
                    f"/api/v1/dashboards/{did}/layout",
                    token,
                    {"layoutJson": layout},
                )
                repaired_dashboards += 1
                print("repaired", item.get("name"), did)
        offset += 50
        if len(items) < 50:
            break

    print("done", {"dashboards": repaired_dashboards, "widgets": repaired_widgets})


if __name__ == "__main__":
    main()
