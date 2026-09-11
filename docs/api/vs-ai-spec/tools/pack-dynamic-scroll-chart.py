#!/usr/bin/env python3
"""Pack dynamic-scroll-chart.bundle.html — step scroll bar chart customViz."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "examples" / "dynamic-scroll-chart.bundle.html"
OUT_VS = ROOT / "examples" / "dynamic-scroll-chart.json"
OUT_DT = Path(r"c:\Users\30381\Documents\deeptalk工作区\examples\dynamic-scroll-chart.json")

MANIFEST = {
    "id": "dynamic-scroll-chart",
    "displayName": "动态滚动条形图",
    "version": "2.0.0",
    "entry": "index.html",
    "runtime": "html",
    "rendererHint": "html",
    "fieldSlots": {
        "dimensions": {"min": 1, "max": 2, "label": "名称列"},
        "metrics": {"min": 1, "max": 1, "label": "数值列"},
    },
    "styleSchema": {
        "type": "object",
        "x-styleSections": [
            {
                "title": "滚动",
                "properties": ["scrollSpeed", "scrollRows", "visibleRows", "pauseOnHover"],
            },
            {"title": "外观", "properties": ["rowHeight", "fontSize", "barColor", "showValue"]},
        ],
        "properties": {
            "scrollSpeed": {
                "type": "number",
                "title": "换行速度（秒/次）",
                "minimum": 1,
                "maximum": 30,
                "default": 3,
            },
            "scrollRows": {
                "type": "number",
                "title": "每次换行行数",
                "minimum": 1,
                "maximum": 5,
                "default": 1,
            },
            "visibleRows": {
                "type": "number",
                "title": "可视行数",
                "minimum": 3,
                "maximum": 12,
                "default": 6,
            },
            "rowHeight": {
                "type": "number",
                "title": "行高（像素）",
                "minimum": 28,
                "maximum": 72,
                "default": 36,
            },
            "fontSize": {
                "type": "number",
                "title": "字号",
                "minimum": 10,
                "maximum": 20,
                "default": 13,
            },
            "barColor": {
                "type": "string",
                "format": "color",
                "title": "条形颜色",
                "default": "#3b82f6",
            },
            "showValue": {"type": "boolean", "title": "显示数值", "default": True},
            "pauseOnHover": {"type": "boolean", "title": "悬停暂停", "default": True},
        },
    },
    "styleHooks": {
        "showValue": {
            "hideWhenFalse": True,
            "hideSelectors": [".vs-cv-val"],
        },
    },
    "defaultStyle": {
        "scrollSpeed": 3,
        "scrollRows": 1,
        "visibleRows": 6,
        "rowHeight": 36,
        "fontSize": 13,
        "barColor": "#3b82f6",
        "showValue": True,
        "pauseOnHover": True,
    },
}


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    html_one = "".join(line.strip() for line in html.splitlines())
    bundle = {"manifest": MANIFEST, "files": {"index.html": html_one}}
    text = json.dumps(bundle, ensure_ascii=False, indent=2)
    OUT_VS.write_text(text, encoding="utf-8")
    print(f"ok {OUT_VS}")
    OUT_DT.parent.mkdir(parents=True, exist_ok=True)
    OUT_DT.write_text(text, encoding="utf-8")
    print(f"ok {OUT_DT}")


if __name__ == "__main__":
    main()
