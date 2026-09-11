#!/usr/bin/env python3
"""从测试环境 (staging) 同步 data-screen 布局到本机 local。"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

STAGING_API = os.environ.get("VITALSPAN_STAGING_API", "http://192.168.10.22:8088/api/v1").rstrip("/")
LOCAL_API = os.environ.get("VITALSPAN_API", "http://127.0.0.1:8000/api/v1").rstrip("/")
USERNAME = os.environ.get("VITALSPAN_USERNAME", "admin")


def load_password() -> str:
    if os.environ.get("VITALSPAN_DEV_ADMIN_PASSWORD"):
        return os.environ["VITALSPAN_DEV_ADMIN_PASSWORD"]
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))
    os.chdir(BACKEND)
    from app.core.config import get_settings

    return get_settings().vitalspan_dev_admin_password or "changeme"


def login(client: httpx.Client, base: str, password: str) -> str:
    res = client.post(f"{base}/auth/login", json={"username": USERNAME, "password": password})
    res.raise_for_status()
    body = res.json()
    token = body.get("accessToken") or (body.get("data") or {}).get("accessToken")
    if not token:
        raise RuntimeError(f"login missing token: {body}")
    return token


def list_data_screens(client: httpx.Client, base: str, headers: dict[str, str]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    offset = 0
    limit = 100
    while True:
        res = client.get(
            f"{base}/dashboards?surfaceKind=data-screen&limit={limit}&offset={offset}",
            headers=headers,
        )
        res.raise_for_status()
        body = res.json()
        page = body.get("data", body)
        batch = page.get("items") or []
        items.extend(batch)
        total = page.get("total")
        offset += len(batch)
        if not batch or (total is not None and offset >= total):
            break
    return items


def get_dashboard(client: httpx.Client, base: str, headers: dict[str, str], dash_id: str) -> dict[str, Any]:
    res = client.get(f"{base}/dashboards/{dash_id}", headers=headers)
    res.raise_for_status()
    body = res.json()
    return body.get("data") or body


def norm_name(name: str) -> str:
    return re.sub(r"\s+", "", name.removesuffix("（编辑）").strip().lower())


def widget_key(w: dict[str, Any]) -> tuple[Any, ...]:
    return (w.get("type"), str(w.get("title") or ""), w.get("order"))


def merge_layout_geometry(local_widgets: list[dict[str, Any]], staging_widgets: list[dict[str, Any]]) -> int:
    by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
    by_title: dict[str, dict[str, Any]] = {}
    for w in staging_widgets:
        by_key[widget_key(w)] = w
        title = str(w.get("title") or "")
        if title:
            by_title[title] = w

    changed = 0
    for w in local_widgets:
        src = by_key.get(widget_key(w)) or by_title.get(str(w.get("title") or ""))
        if not src:
            continue
        geom = ("x", "y", "width", "height")
        if any(w.get(k) != src.get(k) for k in geom):
            for k in geom:
                if k in src:
                    w[k] = src[k]
            changed += 1
    return changed


def replace_layout_from_staging(local_layout: dict[str, Any], staging_layout: dict[str, Any]) -> dict[str, Any]:
    """整屏替换：保留 local widget id/chartConfig，采用 staging 几何与 styleConfig。"""
    staging_widgets = staging_layout.get("widgets") or []
    local_widgets = local_layout.get("widgets") or []
    local_by_key = {widget_key(w): w for w in local_widgets}
    local_by_title = {str(w.get("title") or ""): w for w in local_widgets if w.get("title")}

    merged_widgets: list[dict[str, Any]] = []
    used_local_ids: set[str] = set()

    for sw in staging_widgets:
        lw = local_by_key.get(widget_key(sw)) or local_by_title.get(str(sw.get("title") or ""))
        if lw is None:
            nw = json.loads(json.dumps(sw))
            merged_widgets.append(nw)
            continue
        out = json.loads(json.dumps(lw))
        for k in ("x", "y", "width", "height", "order", "hidden", "locked"):
            if k in sw:
                out[k] = sw[k]
        merged_widgets.append(out)
        used_local_ids.add(str(out.get("id")))

    for lw in local_widgets:
        if str(lw.get("id")) not in used_local_ids:
            merged_widgets.append(json.loads(json.dumps(lw)))

    merged_widgets.sort(key=lambda w: (w.get("order") is None, w.get("order", 0)))

    out_layout = json.loads(json.dumps(local_layout))
    out_layout["widgets"] = merged_widgets
    if staging_layout.get("styleConfig"):
        out_layout["styleConfig"] = json.loads(json.dumps(staging_layout["styleConfig"]))
    if staging_layout.get("canvas"):
        out_layout["canvas"] = json.loads(json.dumps(staging_layout["canvas"]))
    return out_layout


def sync_from_staging(*, dry_run: bool = False, names: list[str] | None = None) -> None:
    password = load_password()
    with httpx.Client(timeout=120.0) as client:
        staging_token = login(client, STAGING_API, password)
        local_token = login(client, LOCAL_API, password)
        sh = {"Authorization": f"Bearer {staging_token}"}
        lh = {"Authorization": f"Bearer {local_token}"}

        staging_items = list_data_screens(client, STAGING_API, sh)
        local_items = list_data_screens(client, LOCAL_API, lh)

        staging_by_name = {norm_name(str(i.get("name") or "")): i for i in staging_items}
        name_filter = {norm_name(n) for n in names} if names else None

        synced = 0
        skipped: list[str] = []

        for local_item in local_items:
            local_name = str(local_item.get("name") or "")
            if local_name.endswith("（编辑）"):
                continue
            key = norm_name(local_name)
            if name_filter and key not in name_filter:
                continue
            staging_item = staging_by_name.get(key)
            if staging_item is None:
                skipped.append(local_name)
                continue

            local_detail = get_dashboard(client, LOCAL_API, lh, str(local_item["id"]))
            staging_detail = get_dashboard(client, STAGING_API, sh, str(staging_item["id"]))
            local_layout = local_detail.get("layoutJson") or {}
            staging_layout = staging_detail.get("layoutJson") or {}
            if not local_layout.get("widgets") or not staging_layout.get("widgets"):
                skipped.append(local_name)
                continue

            merged = replace_layout_from_staging(local_layout, staging_layout)
            geom_changes = merge_layout_geometry(
                merged.get("widgets") or [],
                staging_layout.get("widgets") or [],
            )
            if dry_run:
                print(f"  [dry-run] {local_name}: staging={staging_item['id']} local={local_item['id']} geom={geom_changes}")
                synced += 1
                continue

            save = client.put(
                f"{LOCAL_API}/dashboards/{local_item['id']}/editor-save",
                headers=lh,
                json={"layoutJson": merged, "name": local_detail.get("name") or local_name},
            )
            save.raise_for_status()
            print(f"  ok {local_name} <- staging ({geom_changes} widgets aligned)")
            synced += 1

        print(f"done synced={synced} skipped_no_staging_match={len(skipped)}")
        if skipped:
            for n in skipped[:20]:
                print(f"  skip: {n}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync data-screen layouts from staging to local")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--name", action="append", help="Only sync dashboards whose name contains this")
    args = parser.parse_args()
    print(f"staging={STAGING_API} local={LOCAL_API}")
    sync_from_staging(dry_run=args.dry_run, names=args.name)


if __name__ == "__main__":
    main()
