#!/usr/bin/env python3
"""Pack future-trend-chart.bundle.html into publishable JSON bundle."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "examples" / "future-trend-chart.bundle.html"
OUT_VS = ROOT / "examples" / "future-trend-chart.json"
OUT_DT = Path(r"c:\Users\30381\Documents\deeptalk工作区\examples\future-trend-chart.json")

MANIFEST = {
    "id": "future-trend-chart",
    "displayName": "未来趋势图",
    "version": "1.2.3",
    "entry": "index.html",
    "runtime": "html",
    "rendererHint": "canvas",
    "fieldSlots": {
        "dimensions": {"min": 1, "max": 1, "label": "时间维度", "expect": "date"},
        "metrics": {"min": 1, "max": 3, "label": "数值指标"},
    },
    "styleSchema": {
        "type": "object",
        "x-styleSections": [
            {
                "title": "图表布局",
                "properties": [
                    "chartPaddingTop",
                    "chartPaddingBottom",
                    "chartPaddingLeft",
                    "chartPaddingRight",
                    "labelShow",
                    "labelFontSize",
                    "tooltipFontSize",
                ],
            },
        ],
        "properties": {
            "accentColor": {"type": "string", "format": "color", "title": "主题色", "default": "#00d4ff"},
            "secondaryColor": {"type": "string", "format": "color", "title": "辅助色", "default": "#7c3aed"},
            "lineWidth": {"type": "number", "title": "线条粗细", "minimum": 1, "maximum": 8, "default": 3},
            "glowIntensity": {"type": "number", "title": "发光强度", "minimum": 0, "maximum": 1, "default": 0.8},
            "showArea": {"type": "boolean", "title": "显示面积填充", "default": True},
            "showParticles": {"type": "boolean", "title": "显示粒子效果", "default": True},
            "showGrid": {"type": "boolean", "title": "显示网格背景", "default": True},
            "showScanLine": {"type": "boolean", "title": "显示扫描线", "default": True},
            "pointSize": {"type": "number", "title": "数据点大小", "minimum": 0, "maximum": 16, "default": 6},
            "animationDuration": {
                "type": "number",
                "title": "动画时长(ms)",
                "minimum": 500,
                "maximum": 5000,
                "default": 2000,
            },
            "curveType": {"type": "string", "title": "曲线类型", "enum": ["smooth", "straight"], "default": "smooth"},
            "chartPaddingTop": {
                "type": "number",
                "title": "上边距",
                "minimum": 0,
                "maximum": 80,
                "default": 30,
            },
            "chartPaddingBottom": {
                "type": "number",
                "title": "下边距",
                "minimum": 0,
                "maximum": 80,
                "default": 45,
            },
            "chartPaddingLeft": {
                "type": "number",
                "title": "左边距",
                "minimum": 0,
                "maximum": 100,
                "default": 55,
            },
            "chartPaddingRight": {
                "type": "number",
                "title": "右边距",
                "minimum": 0,
                "maximum": 80,
                "default": 40,
            },
            "labelShow": {"type": "boolean", "title": "显示轴标签", "default": True},
            "labelFontSize": {
                "type": "number",
                "title": "轴标签字号",
                "minimum": 8,
                "maximum": 16,
                "default": 11,
            },
            "tooltipFontSize": {
                "type": "number",
                "title": "提示框字号",
                "minimum": 10,
                "maximum": 18,
                "default": 12,
            },
        },
    },
    "defaultStyle": {
        "accentColor": "#00d4ff",
        "secondaryColor": "#7c3aed",
        "lineWidth": 3,
        "glowIntensity": 0.8,
        "showArea": True,
        "showParticles": True,
        "showGrid": True,
        "showScanLine": True,
        "pointSize": 6,
        "animationDuration": 2000,
        "curveType": "smooth",
        "chartPaddingTop": 30,
        "chartPaddingBottom": 45,
        "chartPaddingLeft": 55,
        "chartPaddingRight": 40,
        "labelShow": True,
        "labelFontSize": 11,
        "tooltipFontSize": 12,
    },
}


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    # minify for bundle transport (single line ok)
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
