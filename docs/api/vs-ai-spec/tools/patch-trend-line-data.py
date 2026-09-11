#!/usr/bin/env python3
"""Patch custom-viz-trend-line.json: encoding + sorted domain (reference gold sample)."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "examples" / "custom-viz-trend-line.json"

HELPERS = (
    "function resolveBoundColumns(p){var cols=p.columns||[];var enc=(p&&p.encoding)||{};"
    "var dims=enc.dimensions||[];var metrics=enc.metrics||[];"
    "var di=dims[0]?cols.indexOf(dims[0]):-1;var mi=metrics[0]?cols.indexOf(metrics[0]):-1;"
    "if(di<0){di=cols.findIndex(function(c,i){return p.rows[0]&&typeof p.rows[0][i]==='string';});"
    "if(di<0)di=0;}if(mi<0){mi=cols.findIndex(function(c,i){return i!==di&&p.rows[0]&&typeof p.rows[0][i]==='number';});"
    "if(mi<0)mi=di===0?1:0;}return{dimIdx:di,metricIdx:mi};}  "
)

NEW_DFP = (
    "function dataFromPayload(p) {"
    "    var st = bindingStatusOf(p);"
    "    if (st !== 'bound' || !p || !p.rows || !p.rows.length) return null;"
    "    var bc = resolveBoundColumns(p);"
    "    var points = p.rows.map(function(r, i) {"
    "      return { time: String(r[bc.dimIdx]), value: Number(r[bc.metricIdx]) || 0, index: i };"
    "    }).filter(function(d) { return !isNaN(d.value); });"
    "    points.sort(function(a, b) {"
    "      return a.time.localeCompare(b.time, undefined, { numeric: true });"
    "    });"
    "    return points;"
    "  }"
)


def main() -> None:
    bundle = json.loads(PATH.read_text(encoding="utf-8"))
    html = bundle["files"]["index.html"]
    if "resolveBoundColumns" not in html:
        html = html.replace("function dataFromPayload(p)", HELPERS + "function dataFromPayload(p)", 1)
    html, n = re.subn(
        r"function dataFromPayload\(p\) \{[\s\S]*?return p\.rows\.map[\s\S]*?\}\);\s*\}",
        NEW_DFP,
        html,
        count=1,
    )
    if n != 1 and "localeCompare" not in html:
        raise SystemExit("dataFromPayload replace failed")
    bundle["files"]["index.html"] = html
    PATH.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok {PATH}")


if __name__ == "__main__":
    main()
