"""从已配置看板/大屏导出的布局 JSON，供内置模板 seed 使用。"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.dashboard.templates.demo_datasource import (
    TEMPLATE_DEMO_DATASOURCE_REF,
    repair_legacy_template_layout,
)
from app.dashboard.templates.layout_utils import sanitize_layout_for_template
from app.dashboard.templates.rebind_demo_encodings import rebind_layout_demo_encodings
from app.metadata.dataset.demo_seed import remap_retired_demo_datasets_in_layout

_LAYOUTS_DIR = Path(__file__).resolve().parent / "layouts"
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _normalize_datasource_refs(layout: dict[str, Any]) -> dict[str, Any]:
    widgets = layout.get("widgets")
    if not isinstance(widgets, list):
        return layout
    for widget in widgets:
        if not isinstance(widget, dict) or widget.get("type") != "chart":
            continue
        chart_cfg = widget.get("chartConfig")
        if not isinstance(chart_cfg, dict):
            continue
        current = chart_cfg.get("dataSourceId")
        if current is None or current == "":
            if chart_cfg.get("mode") in ("sql", "table", "dataset", None):
                chart_cfg["dataSourceId"] = TEMPLATE_DEMO_DATASOURCE_REF
            continue
        if current == TEMPLATE_DEMO_DATASOURCE_REF:
            continue
        if isinstance(current, str) and _UUID_RE.match(current):
            chart_cfg["dataSourceId"] = TEMPLATE_DEMO_DATASOURCE_REF
    return layout


def prepare_exported_layout(raw: dict[str, Any]) -> dict[str, Any]:
    """清洗导出布局：去运行时字段、统一演示数据源占位、修复 legacy 字段。"""
    sanitized = sanitize_layout_for_template(raw)
    normalized = _normalize_datasource_refs(sanitized)
    migrated = repair_legacy_template_layout(normalized)
    remapped = remap_retired_demo_datasets_in_layout(migrated)
    return rebind_layout_demo_encodings(remapped)


@lru_cache(maxsize=32)
def load_exported_layout(filename: str) -> dict[str, Any]:
    path = _LAYOUTS_DIR / filename
    payload = json.loads(path.read_text(encoding="utf-8"))
    layout = payload.get("layoutJson") if isinstance(payload, dict) else None
    if not isinstance(layout, dict):
        msg = f"invalid exported layout file: {filename}"
        raise ValueError(msg)
    return prepare_exported_layout(layout)
