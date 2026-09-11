from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dashboard.templates.models import DashboardTemplate
from app.dashboard.templates.presets_exported import load_exported_layout


def _instance_thumb(template_key: str, ext: str) -> str:
    return f"/template-assets/instance-thumbs/{template_key}.{ext}"


def _builtin_template_specs() -> list[dict[str, Any]]:
    """10 套内置模板：6 数据大屏 + 4 仪表板（来自当前工作区看板/大屏）。"""
    return [
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000211"),
            "template_key": "builtin-gov-industrial-park",
            "name": "工业园区数据监控中心",
            "description": "工业监控大屏 · 条形/柱线/环形组合 · 官方示例数据",
            "category_key": "monitoring",
            "surface_kind": "data-screen",
            "thumbnail_ref": _instance_thumb("builtin-gov-industrial-park", "jpg"),
            "layout_json": load_exported_layout("industrial-park-screen.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000201"),
            "template_key": "builtin-gov-smart-city",
            "name": "智慧城市运行监测",
            "description": "深色青蓝 HUD 扫描底图 · 毛玻璃组件 · 城市态势地图 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "data-screen",
            "thumbnail_ref": _instance_thumb("builtin-gov-smart-city", "jpg"),
            "layout_json": load_exported_layout("workspace-smart-city.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000202"),
            "template_key": "builtin-gov-digital-cockpit",
            "name": "数字政府 KPI 驾驶舱",
            "description": "纸纹水印浅色底图 · 顶栏 KPI 条 · 满意度趋势 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "data-screen",
            "thumbnail_ref": _instance_thumb("builtin-gov-digital-cockpit", "png"),
            "layout_json": load_exported_layout("workspace-digital-cockpit.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000203"),
            "template_key": "builtin-gov-emergency-command",
            "name": "应急指挥调度中心",
            "description": "深色绯红指挥底图 · 毛玻璃告警带 · 区域态势 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "data-screen",
            "thumbnail_ref": _instance_thumb("builtin-gov-emergency-command", "png"),
            "layout_json": load_exported_layout("workspace-emergency.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000204"),
            "template_key": "builtin-gov-eco-monitor",
            "name": "生态环境监测大屏",
            "description": "薄荷丝带浅色底图 · 顶色条卡片 · AQI 趋势 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "data-screen",
            "thumbnail_ref": _instance_thumb("builtin-gov-eco-monitor", "jpg"),
            "layout_json": load_exported_layout("workspace-eco.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000205"),
            "template_key": "builtin-gov-community",
            "name": "社区治理一张图",
            "description": "薰衣草浮层卡片底图 · 网格事件 · 治理热词 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "data-screen",
            "thumbnail_ref": _instance_thumb("builtin-gov-community", "jpg"),
            "layout_json": load_exported_layout("workspace-community.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000206"),
            "template_key": "builtin-gov-efficiency",
            "name": "政务效能分析看板",
            "description": "浅灰 #f0f2f5 画布 · 顶行 KPI/仪表 + 柱线双图 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "dashboard",
            "thumbnail_ref": _instance_thumb("builtin-gov-efficiency", "jpg"),
            "layout_json": load_exported_layout("workspace-efficiency.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000207"),
            "template_key": "builtin-gov-satisfaction",
            "name": "公共服务满意度",
            "description": "DataEase 风三栏 · 地图 + 饼图 + 明细表 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "dashboard",
            "thumbnail_ref": _instance_thumb("builtin-gov-satisfaction", "jpg"),
            "layout_json": load_exported_layout("workspace-satisfaction.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000208"),
            "template_key": "builtin-gov-finance",
            "name": "财政收支概览",
            "description": "DataEase 风运营布局 · KPI + 地图 + 趋势 + 预算表 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "dashboard",
            "thumbnail_ref": _instance_thumb("builtin-gov-finance", "jpg"),
            "layout_json": load_exported_layout("workspace-finance.json"),
        },
        {
            "id": uuid.UUID("00000000-0000-4000-8001-000000000210"),
            "template_key": "builtin-gov-grid",
            "name": "基层网格化管理",
            "description": "DataEase 风网格看板 · 台账表 + 地图 + 分类柱图 · 官方示例数据",
            "category_key": "government",
            "surface_kind": "dashboard",
            "thumbnail_ref": _instance_thumb("builtin-gov-grid", "jpg"),
            "layout_json": load_exported_layout("workspace-grid.json"),
        },
    ]


BUILTIN_SEED_CONTENT_REVISION = 31


def _purge_obsolete_builtin_templates(db: Session, active_keys: set[str]) -> int:
    rows = db.scalars(
        select(DashboardTemplate).where(
            DashboardTemplate.visibility == "builtin",
            DashboardTemplate.template_key.not_in(active_keys),
        ),
    ).all()
    for row in rows:
        db.delete(row)
    return len(rows)


def seed_builtin_dashboard_templates(db: Session) -> int:
    specs = _builtin_template_specs()
    active_keys = {spec["template_key"] for spec in specs}
    upserted = 0
    for spec in specs:
        existing = db.scalar(
            select(DashboardTemplate).where(
                DashboardTemplate.template_key == spec["template_key"],
            ),
        )
        if existing is None:
            row = DashboardTemplate(
                id=spec["id"],
                template_key=spec["template_key"],
                name=spec["name"],
                description=spec["description"],
                category_key=spec["category_key"],
                surface_kind=spec["surface_kind"],
                status="published",
                layout_json=spec["layout_json"],
                thumbnail_ref=spec.get("thumbnail_ref"),
                visibility="builtin",
                content_revision=BUILTIN_SEED_CONTENT_REVISION,
            )
            db.add(row)
            upserted += 1
        else:
            user_customized = existing.content_revision > BUILTIN_SEED_CONTENT_REVISION
            if not user_customized:
                existing.name = spec["name"]
                existing.description = spec["description"]
                existing.category_key = spec["category_key"]
                existing.layout_json = spec["layout_json"]
                existing.thumbnail_ref = spec.get("thumbnail_ref")
                existing.content_revision = max(
                    existing.content_revision,
                    BUILTIN_SEED_CONTENT_REVISION,
                )
            existing.status = "published"
            existing.visibility = "builtin"
    _purge_obsolete_builtin_templates(db, active_keys)
    db.commit()
    return upserted
