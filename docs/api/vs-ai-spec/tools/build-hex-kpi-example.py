#!/usr/bin/env python3
"""L3-ZeroRef acceptance example: hex KPI grid from generic-blank-html shell."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"
GENERIC = EXAMPLES / "generic-blank-html.json"
OUT = EXAMPLES / "hex-kpi-grid.json"

RENDER_BUSINESS = (
    "function renderBusiness(canvas,p,style){"
    "while(canvas.firstChild)canvas.removeChild(canvas.firstChild);"
    "var cols=p.columns||[];var rows=p.rows||[];"
    "if(!cols.length||!rows.length)return;"
    "var wrap=document.createElement('div');"
    "wrap.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:12px;padding:10px';"
    "var di=0,mi=cols.length>1?1:0;"
    "var limit=Math.min(rows.length,18);"
    "for(var r=0;r<limit;r++){"
    "var row=rows[r];var label=String(row[di]!=null?row[di]:'');"
    "var val=row[mi];"
    "var cell=document.createElement('div');"
    "cell.style.cssText='clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);"
    "+'background:linear-gradient(180deg,'+style.accentColor+'55,'+style.accentColor+'22);"
    "border:1px solid '+style.accentColor+';padding:18px 6px;text-align:center;min-height:72px';"
    "if(style.labelShow!==false){"
    "var lb=document.createElement('div');lb.textContent=label;"
    "lb.style.fontSize='11px';lb.style.color=style.labelColor;lb.style.marginBottom='4px';"
    "cell.appendChild(lb);}"
    "var num=document.createElement('div');"
    "num.textContent=typeof val==='number'&&!isNaN(val)?val.toLocaleString():String(val!=null?val:'');"
    "num.style.fontSize=(style.fontSize||14)+'px';num.style.fontWeight='600';num.style.color=style.accentColor;"
    "cell.appendChild(num);wrap.appendChild(cell);}"
    "canvas.appendChild(wrap);}"
)

OLD = (
    "function renderBusiness(canvas,p,style){var hint=document.createElement('div');"
    "hint.className='vs-cv-blank-hint';"
    "hint.textContent='在此编写业务逻辑（只改 renderBusiness 函数）';"
    "hint.style.color=style.accentColor;canvas.appendChild(hint)}"
)


def main() -> None:
    if not GENERIC.is_file():
        raise SystemExit(f"missing template: {GENERIC}")
    bundle = json.loads(GENERIC.read_text(encoding="utf-8"))
    manifest = bundle.setdefault("manifest", {})
    manifest["id"] = "hex-kpi-grid"
    manifest["displayName"] = "六边形 KPI 网格"
    manifest["version"] = "1.0.0"
    manifest.setdefault("defaultStyle", {})["title"] = "六边形 KPI"

    html = bundle["files"]["index.html"]
    if OLD not in html:
        raise SystemExit("generic-blank renderBusiness marker not found; regenerate generic-blank first")
    html = html.replace(OLD, RENDER_BUSINESS)
    bundle["files"]["index.html"] = html

    OUT.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ok {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
