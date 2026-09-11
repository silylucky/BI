"""预置官方演示看板/大屏实例（对标 DataEase 示例仪表板）。"""

from __future__ import annotations

import copy
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dashboard.models import Dashboard
from app.dashboard.preview_summary import sync_surface_kind_column
from app.dashboard.surface_kind import read_surface_kind_from_layout
from app.dashboard.templates.demo_datasource import (
    bind_template_demo_datasources,
    repair_legacy_template_layout,
    resolve_sample_db_datasource_id,
)
from app.dashboard.templates.layout_utils import sanitize_layout_for_template
from app.dashboard.templates.models import DashboardTemplate

DEMO_INSTANCE_DESCRIPTION = "官方演示包预置实例，图表数据来自「示例数据」连接。"

# 用户可见名称与 slug 均为中文，便于列表区分；legacy 英文 slug 启动时自动迁移。
LEGACY_DEMO_INSTANCE_SLUGS: dict[str, str] = {
    "demo-dual-kpi": "官方示例-双栏指标看板",
    "demo-command-center": "官方示例-指挥台三栏",
    "demo-sales-geo": "官方示例-销售地理大屏",
}

DEMO_INSTANCE_SPECS: tuple[dict[str, Any], ...] = (
    {
        "id": uuid.UUID("00000000-0000-4000-8002-000000000001"),
        "slug": "官方示例-双栏指标看板",
        "name": "官方示例 · 双栏指标看板",
        "template_key": "builtin-dash-dual-kpi",
        "surface_kind": "dashboard",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8002-000000000002"),
        "slug": "官方示例-指挥台三栏",
        "name": "官方示例 · 指挥台三栏大屏",
        "template_key": "builtin-screen-command-center",
        "surface_kind": "data-screen",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8002-000000000003"),
        "slug": "官方示例-销售地理大屏",
        "name": "官方示例 · 销售地理大屏",
        "template_key": "builtin-screen-sales-geo",
        "surface_kind": "data-screen",
    },
)

DEMO_INSTANCE_SLUGS: frozenset[str] = frozenset(spec["slug"] for spec in DEMO_INSTANCE_SPECS)


def _build_demo_layout(template_layout: dict[str, Any], template_key: str) -> dict[str, Any]:
    layout = copy.deepcopy(template_layout)
    layout["demoPackage"] = {"seed": True, "sourceTemplateKey": template_key}
    return layout


def _find_existing_demo_row(db: Session, spec: dict[str, Any]) -> Dashboard | None:
    by_id = db.scalar(
        select(Dashboard).where(
            Dashboard.id == spec["id"],
            Dashboard.deleted_at.is_(None),
        ),
    )
    if by_id is not None:
        return by_id

    by_slug = db.scalar(
        select(Dashboard).where(
            Dashboard.slug == spec["slug"],
            Dashboard.deleted_at.is_(None),
        ),
    )
    if by_slug is not None:
        return by_slug

    for legacy_slug, new_slug in LEGACY_DEMO_INSTANCE_SLUGS.items():
        if new_slug != spec["slug"]:
            continue
        legacy_row = db.scalar(
            select(Dashboard).where(
                Dashboard.slug == legacy_slug,
                Dashboard.deleted_at.is_(None),
            ),
        )
        if legacy_row is not None:
            legacy_row.slug = spec["slug"]
            return legacy_row
    return None


def seed_demo_instances(db: Session) -> int:
    """幂等 upsert 官方演示实例；sample_db 或模板缺失时跳过。"""
    demo_ds = resolve_sample_db_datasource_id(db)
    if demo_ds is None:
        return 0
    upserted = 0
    for spec in DEMO_INSTANCE_SPECS:
        template = db.scalar(
            select(DashboardTemplate).where(
                DashboardTemplate.template_key == spec["template_key"],
            ),
        )
        if template is None:
            continue
        repaired = repair_legacy_template_layout(
            sanitize_layout_for_template(template.layout_json),
        )
        layout = bind_template_demo_datasources(repaired, demo_ds)
        from app.metadata.dataset.demo_bindings import bind_demo_dataset_config_ids, ensure_demo_dataset_bindings

        ensure_demo_dataset_bindings(db)
        layout = bind_demo_dataset_config_ids(db, layout)
        layout = _build_demo_layout(layout, spec["template_key"])
        surface = read_surface_kind_from_layout(layout) or spec["surface_kind"]
        existing = _find_existing_demo_row(db, spec)
        if existing is None:
            row = Dashboard(
                id=spec["id"],
                name=spec["name"],
                slug=spec["slug"],
                description=DEMO_INSTANCE_DESCRIPTION,
                layout_json=layout,
                surface_kind=surface,
                created_by=None,
            )
            db.add(row)
            upserted += 1
        else:
            existing.name = spec["name"]
            existing.slug = spec["slug"]
            existing.layout_json = layout
            existing.surface_kind = sync_surface_kind_column(layout)
            existing.description = DEMO_INSTANCE_DESCRIPTION
    db.commit()
    return upserted


def resolve_demo_instance_ids(db: Session) -> list[uuid.UUID]:
    slug_candidates = set(DEMO_INSTANCE_SLUGS) | set(LEGACY_DEMO_INSTANCE_SLUGS.keys())
    rows = db.scalars(
        select(Dashboard.id).where(
            Dashboard.slug.in_(slug_candidates),
            Dashboard.deleted_at.is_(None),
        ),
    ).all()
    return list(rows)
