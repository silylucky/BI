#!/usr/bin/env python3
"""Pack html-minimal.bundle.html — generic customViz starter (default scaffold template)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "examples" / "html-minimal.bundle.html"
OUT_VS = ROOT / "examples" / "html-minimal.json"
OUT_DT = Path(r"c:\Users\30381\Documents\deeptalk工作区\examples\html-minimal.json")

MANIFEST = {
    "id": "html-minimal",
    "displayName": "HTML 通用起点",
    "version": "1.0.0",
    "entry": "index.html",
    "runtime": "html",
    "rendererHint": "html",
    "fieldSlots": {
        "dimensions": {"min": 1, "max": 8, "label": "维度列"},
        "metrics": {"min": 1, "max": 8, "label": "数值列"},
    },
    "styleSchema": {
        "type": "object",
        "x-styleSections": [
            {"title": "标题", "properties": ["title"]},
            {"title": "表格", "properties": ["fontSize", "showHeader", "accentColor"]},
        ],
        "properties": {
            "title": {"type": "string", "title": "组件标题", "default": ""},
            "fontSize": {
                "type": "number",
                "title": "字号",
                "minimum": 10,
                "maximum": 20,
                "default": 13,
            },
            "showHeader": {"type": "boolean", "title": "显示表头", "default": True},
            "accentColor": {
                "type": "string",
                "format": "color",
                "title": "强调色",
                "default": "#38bdf8",
            },
        },
    },
    "defaultStyle": {
        "title": "",
        "fontSize": 13,
        "showHeader": True,
        "accentColor": "#38bdf8",
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
