#!/usr/bin/env python3
"""将当前仪表板 / 数据大屏布局同步到内置可视化模板。

用法（仓库根目录）：
  python scripts/sync-dashboards-to-templates.py
  python scripts/sync-dashboards-to-templates.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND = Path(os.environ.get("VITALSPAN_BACKEND", str(ROOT / "backend")))
LAYOUTS_DIR = BACKEND / "app" / "dashboard" / "templates" / "layouts"
SEED_FILE = BACKEND / "app" / "dashboard" / "templates" / "seed.py"
DATA_DIR = ROOT / "data"
THUMB_PUBLIC_DIR = ROOT / "fe" / "public" / "template-assets" / "instance-thumbs"

if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.chdir(BACKEND)

from sqlalchemy import select

from app.auth.models import get_meta_session
from app.dashboard.models import Dashboard
from app.dashboard.templates.models import DashboardTemplate
from app.dashboard.templates.presets_exported import prepare_exported_layout
from app.dashboard.workspace_instances.seed import WORKSPACE_INSTANCE_SPECS

TEMPLATE_LAYOUT_FILES: dict[str, str] = {
    "builtin-gov-industrial-park": "industrial-park-screen.json",
    "builtin-gov-smart-city": "workspace-smart-city.json",
    "builtin-gov-digital-cockpit": "workspace-digital-cockpit.json",
    "builtin-gov-emergency-command": "workspace-emergency.json",
    "builtin-gov-eco-monitor": "workspace-eco.json",
    "builtin-gov-community": "workspace-community.json",
    "builtin-gov-efficiency": "workspace-efficiency.json",
    "builtin-gov-satisfaction": "workspace-satisfaction.json",
    "builtin-gov-finance": "workspace-finance.json",
    "builtin-gov-grid": "workspace-grid.json",
}

EXTRA_DASHBOARD_SPECS: tuple[dict[str, Any], ...] = (
    {
        "dashboard_id": uuid.UUID("f8951c72-d2f9-41b0-9f80-3446d7c85105"),
        "template_key": "builtin-gov-industrial-park",
    },
)


def _display_name(name: str) -> str:
    return name.removesuffix("（编辑）").strip() or name


def _resolve_dashboard_for_spec(session, spec: dict[str, Any]) -> Dashboard | None:
    name = spec["name"]
    surface = spec["surface_kind"]
    candidates = list(
        session.scalars(
            select(Dashboard).where(
                Dashboard.deleted_at.is_(None),
                Dashboard.surface_kind == surface,
                Dashboard.name.in_((name, f"{name}（编辑）")),
            ),
        ).all(),
    )
    by_slug = session.scalar(
        select(Dashboard).where(
            Dashboard.slug == spec["slug"],
            Dashboard.deleted_at.is_(None),
        ),
    )
    if by_slug is not None and all(row.id != by_slug.id for row in candidates):
        candidates.append(by_slug)
    if not candidates:
        return None
    return max(candidates, key=lambda row: row.updated_at or row.created_at)


def _export_payload(dashboard: Dashboard) -> dict[str, Any]:
    layout = dashboard.layout_json
    if hasattr(layout, "model_dump"):
        raw = layout.model_dump(by_alias=True, mode="json")
    else:
        raw = dict(layout)
    cleaned = prepare_exported_layout(raw)
    return {
        "name": _display_name(dashboard.name),
        "slug": dashboard.slug,
        "surfaceKind": dashboard.surface_kind,
        "layoutJson": cleaned,
    }


def _write_layout_file(filename: str, payload: dict[str, Any], *, dry_run: bool) -> None:
    path = LAYOUTS_DIR / filename
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if dry_run:
        print(f"  [dry-run] would write {path} ({len(text)} bytes)")
        return
    path.write_text(text, encoding="utf-8")
    print(f"  wrote {path.name} widgets={len(payload['layoutJson'].get('widgets') or [])}")


def _copy_thumbnail(dashboard: Dashboard, template_key: str, *, dry_run: bool) -> str | None:
    ref = (dashboard.thumbnail_ref or "").replace("\\", "/").strip()
    if not ref:
        return None
    src = DATA_DIR / ref
    if not src.is_file():
        print(f"  thumb missing {src}")
        return None
    dest = THUMB_PUBLIC_DIR / f"{template_key}{src.suffix.lower()}"
    public = f"/template-assets/instance-thumbs/{dest.name}"
    if dry_run:
        print(f"  [dry-run] would copy thumb {src.name} -> {public}")
        return public
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"  thumb {dest.name}")
    return public


def _bump_seed_revision(*, dry_run: bool) -> int:
    content = SEED_FILE.read_text(encoding="utf-8")
    marker = "BUILTIN_SEED_CONTENT_REVISION = "
    for line in content.splitlines():
        if line.startswith(marker):
            current = int(line.split("=", 1)[1].strip())
            break
    else:
        raise SystemExit("BUILTIN_SEED_CONTENT_REVISION not found in seed.py")
    new_rev = current + 1
    if dry_run:
        print(f"  [dry-run] would bump BUILTIN_SEED_CONTENT_REVISION {current} -> {new_rev}")
        return new_rev
    updated = content.replace(f"{marker}{current}", f"{marker}{new_rev}", 1)
    SEED_FILE.write_text(updated, encoding="utf-8")
    print(f"  bumped BUILTIN_SEED_CONTENT_REVISION {current} -> {new_rev}")
    return new_rev


def sync_one(
    db,
    *,
    dashboard: Dashboard,
    template_key: str,
    dry_run: bool,
) -> bool:
    filename = TEMPLATE_LAYOUT_FILES.get(template_key)
    if not filename:
        print(f"  SKIP {dashboard.slug}: no layout file for {template_key}")
        return False
    template = db.scalar(
        select(DashboardTemplate).where(DashboardTemplate.template_key == template_key),
    )
    if template is None:
        print(f"  SKIP {dashboard.slug}: template missing {template_key}")
        return False

    payload = _export_payload(dashboard)
    widgets = len(payload["layoutJson"].get("widgets") or [])
    print(f"  sync {dashboard.name} -> {template_key} widgets={widgets}")
    thumb = _copy_thumbnail(dashboard, template_key, dry_run=dry_run)

    if not dry_run:
        template.layout_json = payload["layoutJson"]
        template.content_revision = max(template.content_revision, 0) + 1
        template.status = "published"
        template.visibility = "builtin"
        template.name = payload["name"]
        if thumb:
            template.thumbnail_ref = thumb

    _write_layout_file(filename, payload, dry_run=dry_run)
    return True


def _purge_old_templates(db, *, keep_keys: set[str], dry_run: bool) -> int:
    rows = db.scalars(select(DashboardTemplate)).all()
    removed = 0
    for row in rows:
        if row.visibility == "builtin" and row.template_key in keep_keys:
            continue
        print(f"  delete template {row.visibility} {row.template_key} {row.name}")
        if not dry_run:
            db.delete(row)
        removed += 1
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync workspace dashboards to viz templates")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--skip-seed-bump", action="store_true", help="Do not bump seed.py revision")
    args = parser.parse_args()

    session = get_meta_session()
    synced = 0
    keep_keys = set(TEMPLATE_LAYOUT_FILES)
    try:
        print("=== sync dashboards -> templates ===")
        seen_keys: set[str] = set()
        for spec in WORKSPACE_INSTANCE_SPECS:
            dash = _resolve_dashboard_for_spec(session, spec)
            if dash is None:
                print(f"  SKIP missing dashboard slug={spec['slug']}")
                continue
            if spec["template_key"] in seen_keys:
                continue
            if sync_one(
                session,
                dashboard=dash,
                template_key=spec["template_key"],
                dry_run=args.dry_run,
            ):
                synced += 1
                seen_keys.add(spec["template_key"])

        for extra in EXTRA_DASHBOARD_SPECS:
            if extra["template_key"] in seen_keys:
                continue
            dash = session.scalar(
                select(Dashboard).where(
                    Dashboard.id == extra["dashboard_id"],
                    Dashboard.deleted_at.is_(None),
                ),
            )
            if dash is None:
                print(f"  SKIP missing extra dashboard id={extra['dashboard_id']}")
                continue
            if sync_one(
                session,
                dashboard=dash,
                template_key=extra["template_key"],
                dry_run=args.dry_run,
            ):
                synced += 1
                seen_keys.add(extra["template_key"])

        print("=== delete original templates not in current set ===")
        removed = _purge_old_templates(session, keep_keys=keep_keys, dry_run=args.dry_run)
        print(f"  removed={removed}")

        print("=== bump seed revision ===")
        if args.skip_seed_bump:
            print("  skipped (--skip-seed-bump)")
        else:
            _bump_seed_revision(dry_run=args.dry_run)

        if not args.dry_run:
            session.commit()
        print(f"DONE synced={synced} removed_old_templates={removed}")
        return 0 if synced > 0 else 1
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
