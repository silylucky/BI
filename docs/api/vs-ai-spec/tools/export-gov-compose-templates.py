#!/usr/bin/env python3
"""Export platform gov data-screen layouts → DeepTalk compose reference templates.

Reads `backend/app/dashboard/templates/layouts/*.json` (synced via
`scripts/sync-dashboards-to-templates.py`) and writes `assets/layout-templates/gov-*.json`.

  python docs/api/vs-ai-spec/tools/export-gov-compose-templates.py
  python docs/api/vs-ai-spec/tools/export-gov-compose-templates.py --rebuild-index
"""

from __future__ import annotations

import argparse
import json
import re
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LAYOUTS_DIR = ROOT / "backend" / "app" / "dashboard" / "templates" / "layouts"
OUT = Path(__file__).resolve().parents[1] / "assets" / "layout-templates"

GOV_SPECS: list[dict] = [
    {
        "id": "gov-eco-monitor",
        "layout_file": "workspace-eco.json",
        "platformTemplateKey": "builtin-gov-eco-monitor",
        "tags": ["gov-recommended", "gov-style", "government", "eco"],
    },
    {
        "id": "gov-industrial-park",
        "layout_file": "industrial-park-screen.json",
        "platformTemplateKey": "builtin-gov-industrial-park",
        "tags": ["gov-recommended", "gov-style", "monitoring", "industrial"],
    },
    {
        "id": "gov-smart-city",
        "layout_file": "workspace-smart-city.json",
        "platformTemplateKey": "builtin-gov-smart-city",
        "tags": ["gov-recommended", "gov-style", "government", "smart-city"],
    },
    {
        "id": "gov-digital-cockpit",
        "layout_file": "workspace-digital-cockpit.json",
        "platformTemplateKey": "builtin-gov-digital-cockpit",
        "tags": ["gov-recommended", "gov-style", "government", "kpi"],
    },
    {
        "id": "gov-emergency-command",
        "layout_file": "workspace-emergency.json",
        "platformTemplateKey": "builtin-gov-emergency-command",
        "tags": ["gov-recommended", "gov-style", "government", "emergency"],
    },
    {
        "id": "gov-community",
        "layout_file": "workspace-community.json",
        "platformTemplateKey": "builtin-gov-community",
        "tags": ["gov-recommended", "gov-style", "government", "community"],
    },
]

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(value: str) -> str:
    text = _HTML_TAG_RE.sub("", unescape(value))
    return re.sub(r"\s+", " ", text).strip()


def _detect_shell(widgets: list[dict], fallback_title: str) -> dict:
    title = fallback_title
    clock = False
    accent = "#22d3ee"
    for widget in sorted(widgets, key=lambda row: row.get("order") or 0):
        if widget.get("type") != "text":
            continue
        text_cfg = widget.get("textConfig") or {}
        content = str(text_cfg.get("content") or "")
        if content == "__vs_screen_clock__":
            clock = True
            clock_style = (text_cfg.get("screenStyle") or {}).get("clock") or {}
            if isinstance(clock_style.get("color"), str):
                accent = clock_style["color"]
            continue
        if int(widget.get("y") or 0) > 140:
            continue
        if int(widget.get("width") or 0) < 800:
            continue
        plain = _strip_html(content)
        if plain:
            title = plain
    return {"title": title, "clock": clock, "accent": accent, "mode": "platform"}


def _slot_from_widget(widget: dict) -> dict | None:
    kind = widget.get("type")
    if kind == "chart":
        chart_cfg = widget.get("chartConfig") or {}
        return {
            "type": "chart",
            "title": widget.get("title") or "图表",
            "x": int(widget.get("x") or 0),
            "y": int(widget.get("y") or 0),
            "width": int(widget.get("width") or 320),
            "height": int(widget.get("height") or 240),
            "defaultChartType": chart_cfg.get("chartType") or "bar",
        }
    if kind == "customViz":
        return {
            "type": "customViz",
            "title": widget.get("title") or "自定义组件",
            "x": int(widget.get("x") or 0),
            "y": int(widget.get("y") or 0),
            "width": int(widget.get("width") or 320),
            "height": int(widget.get("height") or 240),
        }
    return None


def _export_one(spec: dict) -> dict:
    source = LAYOUTS_DIR / spec["layout_file"]
    payload = json.loads(source.read_text(encoding="utf-8"))
    layout = payload["layoutJson"]
    widgets = layout.get("widgets") or []
    style = dict(layout.get("styleConfig") or {})
    style.setdefault("surfaceKind", payload.get("surfaceKind") or "data-screen")

    slots: list[dict] = []
    for widget in widgets:
        slot = _slot_from_widget(widget)
        if slot:
            slots.append(slot)

    return {
        "id": spec["id"],
        "name": payload.get("name") or spec["id"],
        "description": next(
            (
                row["description"]
                for row in _SEED_DESCRIPTIONS
                if row["template_key"] == spec["platformTemplateKey"]
            ),
            "5173 内置政企大屏参考布局",
        ),
        "surfaceKind": payload.get("surfaceKind") or "data-screen",
        "tags": list(spec["tags"]),
        "canvas": layout.get("canvas") or {"width": 1920, "height": 1080},
        "styleConfig": style,
        "shell": _detect_shell(widgets, payload.get("name") or spec["id"]),
        "platformTemplateKey": spec["platformTemplateKey"],
        "sourceLayoutFile": spec["layout_file"],
        "composeHints": {
            "shellMode": "platform",
            "preserveCoordinates": True,
            "note": "槽位坐标来自 5173 内置模板；compose 勿再叠加 de-shell 偏移",
        },
        "slots": slots,
    }


_SEED_DESCRIPTIONS: list[dict[str, str]] = [
    {
        "template_key": "builtin-gov-industrial-park",
        "description": "工业监控大屏 · 条形/柱线/环形组合 · 官方示例数据",
    },
    {
        "template_key": "builtin-gov-smart-city",
        "description": "深色青蓝 HUD 扫描底图 · 毛玻璃组件 · 城市态势地图 · 官方示例数据",
    },
    {
        "template_key": "builtin-gov-digital-cockpit",
        "description": "纸纹水印浅色底图 · 顶栏 KPI 条 · 满意度趋势 · 官方示例数据",
    },
    {
        "template_key": "builtin-gov-emergency-command",
        "description": "深色绯红指挥底图 · 毛玻璃告警带 · 区域态势 · 官方示例数据",
    },
    {
        "template_key": "builtin-gov-eco-monitor",
        "description": "薄荷丝带浅色底图 · 顶色条卡片 · AQI 趋势 · 官方示例数据",
    },
    {
        "template_key": "builtin-gov-community",
        "description": "薰衣草浮层卡片底图 · 网格事件 · 治理热词 · 官方示例数据",
    },
]


def _catalog_entry(tpl: dict) -> dict:
    chart_slots = sum(1 for slot in tpl["slots"] if slot["type"] == "chart")
    cv_slots = sum(1 for slot in tpl["slots"] if slot["type"] == "customViz")
    return {
        "id": tpl["id"],
        "name": tpl["name"],
        "description": tpl.get("description", ""),
        "surfaceKind": tpl["surfaceKind"],
        "tags": tpl.get("tags", []),
        "chartSlots": chart_slots,
        "customVizSlots": cv_slots,
        "platformTemplateKey": tpl.get("platformTemplateKey"),
    }


def export_gov_templates() -> list[dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    exported: list[dict] = []
    for spec in GOV_SPECS:
        tpl = _export_one(spec)
        path = OUT / f"{tpl['id']}.json"
        path.write_text(json.dumps(tpl, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        exported.append(tpl)
        print(
            f"ok {path.name} slots={len(tpl['slots'])} "
            f"charts={sum(1 for s in tpl['slots'] if s['type'] == 'chart')}",
        )
    return exported


def rebuild_index(*, extra_description: str | None = None) -> None:
    index_path = OUT / "index.json"
    existing = json.loads(index_path.read_text(encoding="utf-8")) if index_path.is_file() else {}
    gov_ids = {spec["id"] for spec in GOV_SPECS}
    templates: list[dict] = []
    for path in sorted(OUT.glob("*.json")):
        if path.name == "index.json":
            continue
        tpl = json.loads(path.read_text(encoding="utf-8"))
        if tpl.get("id") in gov_ids or not tpl["id"].startswith("gov-"):
            templates.append(_catalog_entry(tpl))

    catalog = {
        "version": 3,
        "description": extra_description
        or "DeepTalk compose：5 套 DE 大屏 + 6 套政企内置参考 + 10 套仪表板",
        "recommendedDataScreen": existing.get(
            "recommendedDataScreen",
            [
                "de-classic-cockpit",
                "de-sales-command",
                "de-balanced-four",
                "de-map-command",
                "de-kpi-flow-wall",
            ],
        ),
        "recommendedGovDataScreen": [spec["id"] for spec in GOV_SPECS],
        "removedDataScreenIds": existing.get("removedDataScreenIds", []),
        "templates": templates,
    }
    index_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ok index.json templates={len(templates)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export gov data-screen compose templates")
    parser.add_argument(
        "--rebuild-index",
        action="store_true",
        help="Rewrite assets/layout-templates/index.json after export",
    )
    args = parser.parse_args()
    export_gov_templates()
    if args.rebuild_index:
        rebuild_index()
    else:
        print("hint: run with --rebuild-index to refresh index.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
