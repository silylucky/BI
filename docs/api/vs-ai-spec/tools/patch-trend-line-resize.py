#!/usr/bin/env python3
"""Patch custom-viz-trend-line gold sample: layout resize + tooltip + interrupt."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "examples" / "custom-viz-trend-line.json"


def patch_html(html: str) -> str:
    if "svg.interrupt()" not in html:
        html = html.replace(
            "    var svg = d3.select(svgEl);\n    svg.selectAll('*').remove();",
            "    var svg = d3.select(svgEl);\n    svg.interrupt();\n    svg.selectAll('*').remove();",
        )
    old_size = "    var w = svgEl.clientWidth || 400, h = svgEl.clientHeight || 300;"
    new_size = (
        "    var layout = (p && p.layout) || {};\n"
        "    var w = layout.width || svgEl.clientWidth || 400;\n"
        "    var h = layout.height || svgEl.clientHeight || 300;\n"
        "    svg.attr('width', w).attr('height', h);"
    )
    if old_size in html:
        html = html.replace(old_size, new_size)
    old_tt = (
        "          tooltip.innerHTML = '<strong>' + d.time + '</strong><br>' + formatValue(d.value);\n"
        "          tooltip.classList.add('show');\n"
        "          tooltip.style.left = (event.pageX + 10) + 'px';\n"
        "          tooltip.style.top = (event.pageY - 40) + 'px';"
    )
    new_tt = (
        "          tooltip.innerHTML = '<strong>' + d.time + '</strong><br>' + formatValue(d.value);\n"
        "          tooltip.classList.add('show');\n"
        "          if (vsCv && vsCv.helpers && vsCv.helpers.placeTooltipNearPointer && host) {\n"
        "            vsCv.helpers.placeTooltipNearPointer(host, tooltip, event.clientX, event.clientY);\n"
        "          } else {\n"
        "            tooltip.style.left = (event.pageX + 10) + 'px';\n"
        "            tooltip.style.top = (event.pageY - 40) + 'px';\n"
        "          }"
    )
    if old_tt in html:
        html = html.replace(old_tt, new_tt)
    return html


def main() -> None:
    bundle = json.loads(TARGET.read_text(encoding="utf-8"))
    entry = bundle["manifest"].get("entry") or "index.html"
    html = bundle["files"][entry]
    bundle["files"][entry] = patch_html(html)
    TARGET.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok patched {TARGET.name}")


if __name__ == "__main__":
    main()
