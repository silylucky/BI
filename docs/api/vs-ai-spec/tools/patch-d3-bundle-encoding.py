#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "examples" / "custom-viz-d3-bundle.json"

HELPERS = (
    "function resolveBoundColumns(p){var cols=p.columns||[];var enc=(p&&p.encoding)||{};"
    "var dims=enc.dimensions||[];var metrics=enc.metrics||[];"
    "var di=dims[0]?cols.indexOf(dims[0]):-1;var mi=metrics[0]?cols.indexOf(metrics[0]):-1;"
    "if(di<0){di=cols.findIndex(function(c){return c!=='sum'&&c!=='count'});if(di<0)di=0;}"
    "if(mi<0){mi=cols.findIndex(function(c,i){return i!==di});if(mi<0)mi=1;}"
    "return{dimIdx:di,metricIdx:mi};}"
)

NEW_DFP = (
    "function dataFromPayload(p){var st=bindingStatusOf(p);"
    "if(st!=='bound'||!p||!p.rows||!p.rows.length)return null;"
    "var bc=resolveBoundColumns(p);"
    "return p.rows.map(function(r){return{n:String(r[bc.dimIdx]),v:Number(r[bc.metricIdx])||0}})}"
)


def main() -> None:
    bundle = json.loads(PATH.read_text(encoding="utf-8"))
    html = bundle["files"]["index.html"]
    start = html.find("function dataFromPayload(p)")
    end = html.find("function tickShowMap", start)
    if start < 0 or end < 0:
        raise SystemExit("markers not found")
    prefix = html[:start]
    if "resolveBoundColumns" not in prefix:
        prefix = prefix + HELPERS
    html = prefix + NEW_DFP + html[end:]
    bundle["files"]["index.html"] = html
    PATH.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok {PATH}")


if __name__ == "__main__":
    main()
