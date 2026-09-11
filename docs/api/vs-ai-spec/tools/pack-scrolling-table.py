#!/usr/bin/env python3
"""Pack scrolling-table.bundle.html into publishable JSON bundle."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "examples" / "scrolling-table.bundle.html"
OUT_VS = ROOT / "examples" / "scrolling-table.json"
OUT_DT = Path(r"c:\Users\30381\Documents\deeptalk工作区\examples\scrolling-table.json")

MANIFEST = {
    "id": "scrolling-table",
    "displayName": "流动明细表",
    "version": "1.0.1",
    "entry": "index.html",
    "runtime": "html",
    "rendererHint": "html",
    "fieldSlots": {
        "dimensions": {"min": 1, "max": 6, "label": "明细列"},
        "metrics": {"min": 0, "max": 0, "label": "数值列"},
    },
    "styleSchema": {
        "type": "object",
        "x-styleSections": [
            {"title": "滚动", "properties": ["scrollSpeed", "pauseOnHover"]},
            {"title": "外观", "properties": ["rowHeight", "fontSize", "stripeRows", "showHeader"]},
        ],
        "properties": {
            "scrollSpeed": {
                "type": "number",
                "title": "滚动周期（秒）",
                "minimum": 8,
                "maximum": 120,
                "default": 36,
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
            "showHeader": {"type": "boolean", "title": "显示表头", "default": True},
            "stripeRows": {"type": "boolean", "title": "斑马纹", "default": True},
            "pauseOnHover": {"type": "boolean", "title": "悬停暂停", "default": True},
        },
    },
    "defaultStyle": {
        "scrollSpeed": 36,
        "rowHeight": 36,
        "fontSize": 13,
        "showHeader": True,
        "stripeRows": True,
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
    if OUT_DT.parent.exists():
        OUT_DT.write_text(text, encoding="utf-8")
        print(f"ok {OUT_DT}")


if __name__ == "__main__":
    main()
