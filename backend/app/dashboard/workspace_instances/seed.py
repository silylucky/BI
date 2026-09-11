"""预置政企内置模板工作副本，供仪表板 / 数据大屏列表直接编辑。"""

from __future__ import annotations

import copy
import uuid
from datetime import UTC, datetime
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
from app.dashboard.templates.layout_utils import regenerate_widget_ids, sanitize_layout_for_template
from app.dashboard.templates.models import DashboardTemplate

WORKSPACE_INSTANCE_DESCRIPTION = "内置模板工作副本，可自行编辑布局与样式。"

WORKSPACE_INSTANCE_SPECS: tuple[dict[str, Any], ...] = (
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000001"),
        "slug": "workspace-gov-smart-city",
        "name": "智慧城市运行监测",
        "template_key": "builtin-gov-smart-city",
        "surface_kind": "data-screen",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000002"),
        "slug": "workspace-gov-digital-cockpit",
        "name": "数字政府 KPI 驾驶舱",
        "template_key": "builtin-gov-digital-cockpit",
        "surface_kind": "data-screen",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000003"),
        "slug": "workspace-gov-emergency-command",
        "name": "应急指挥调度中心",
        "template_key": "builtin-gov-emergency-command",
        "surface_kind": "data-screen",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000004"),
        "slug": "workspace-gov-eco-monitor",
        "name": "生态环境监测大屏",
        "template_key": "builtin-gov-eco-monitor",
        "surface_kind": "data-screen",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000005"),
        "slug": "workspace-gov-community",
        "name": "社区治理一张图",
        "template_key": "builtin-gov-community",
        "surface_kind": "data-screen",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000101"),
        "slug": "workspace-gov-efficiency",
        "name": "政务效能分析看板",
        "template_key": "builtin-gov-efficiency",
        "surface_kind": "dashboard",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000102"),
        "slug": "workspace-gov-satisfaction",
        "name": "公共服务满意度",
        "template_key": "builtin-gov-satisfaction",
        "surface_kind": "dashboard",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000103"),
        "slug": "workspace-gov-finance",
        "name": "财政收支概览",
        "template_key": "builtin-gov-finance",
        "surface_kind": "dashboard",
    },
    {
        "id": uuid.UUID("00000000-0000-4000-8003-000000000105"),
        "slug": "workspace-gov-grid",
        "name": "基层网格化管理",
        "template_key": "builtin-gov-grid",
        "surface_kind": "dashboard",
    },
)

WORKSPACE_INSTANCE_SLUGS: frozenset[str] = frozenset(spec["slug"] for spec in WORKSPACE_INSTANCE_SPECS)


def purge_all_dashboard_instances(db: Session) -> int:
    """软删除全部看板/大屏实例（重置工作区用）。"""
    now = datetime.now(UTC)
    rows = db.scalars(select(Dashboard).where(Dashboard.deleted_at.is_(None))).all()
    for row in rows:
        row.deleted_at = now
    db.commit()
    return len(rows)


def _find_existing_workspace_row(db: Session, spec: dict[str, Any]) -> Dashboard | None:
    by_id = db.scalar(select(Dashboard).where(Dashboard.id == spec["id"]))
    if by_id is not None:
        return by_id
    return db.scalar(select(Dashboard).where(Dashboard.slug == spec["slug"]))


def seed_workspace_instances(db: Session, *, reset_layout: bool = False) -> int:
    """幂等 upsert 内置模板工作副本；sample_db 或模板缺失时跳过对应项。"""
    demo_ds = resolve_sample_db_datasource_id(db)
    upserted = 0
    for spec in WORKSPACE_INSTANCE_SPECS:
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
        layout = regenerate_widget_ids(layout)
        surface = read_surface_kind_from_layout(layout) or spec["surface_kind"]
        existing = _find_existing_workspace_row(db, spec)
        if existing is None:
            row = Dashboard(
                id=spec["id"],
                name=spec["name"],
                slug=spec["slug"],
                description=WORKSPACE_INSTANCE_DESCRIPTION,
                layout_json=layout,
                surface_kind=surface,
                created_by=None,
            )
            db.add(row)
            upserted += 1
        else:
            was_deleted = existing.deleted_at is not None
            existing.deleted_at = None
            existing.name = spec["name"]
            existing.slug = spec["slug"]
            existing.description = WORKSPACE_INSTANCE_DESCRIPTION
            if reset_layout or was_deleted:
                existing.layout_json = layout
                existing.surface_kind = sync_surface_kind_column(layout)
            else:
                from app.metadata.dataset.demo_seed import remap_retired_demo_datasets_in_layout

                remapped = remap_retired_demo_datasets_in_layout(copy.deepcopy(existing.layout_json or {}))
                existing.layout_json = bind_demo_dataset_config_ids(db, remapped)
            if was_deleted:
                upserted += 1
    db.commit()
    return upserted


def resolve_workspace_instance_ids(db: Session) -> list[uuid.UUID]:
    rows = db.scalars(
        select(Dashboard.id).where(
            Dashboard.slug.in_(WORKSPACE_INSTANCE_SLUGS),
            Dashboard.deleted_at.is_(None),
        ),
    ).all()
    return list(rows)
