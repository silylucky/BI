#!/usr/bin/env python3
"""Replace MutationObserver loops in customViz example bundles."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "docs" / "api" / "vs-ai-spec" / "examples"

OLD_PATTERNS = (
    (
        "render();var host=document.querySelector('.vs-custom-viz-host');"
        "if(host)new MutationObserver(render).observe(host,{childList:true,subtree:true,characterData:true})"
    ),
    (
        "render();var obs=new MutationObserver(render);var host=document.querySelector('.vs-custom-viz-host');"
        "if(host)obs.observe(host,{childList:true,subtree:true,characterData:true})"
    ),
)
NEW = (
    "render();var host=document.currentScript&&document.currentScript.parentElement;"
    "if(host&&host.classList.contains('vs-custom-viz-host')){host.addEventListener('vs-cv-payload-update',render)}"
)


def main() -> None:
    for path in sorted(EXAMPLES.glob("custom-viz*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        html = data["files"]["index.html"]
        if "MutationObserver" not in html:
            print(f"skip {path.name}")
            continue
        replaced = False
        for old in OLD_PATTERNS:
            if old in html:
                html = html.replace(old, NEW, 1)
                replaced = True
                break
        if not replaced:
            print(f"FAIL pattern missing in {path.name}")
            continue
        data["files"]["index.html"] = html
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"fixed {path.name}")


if __name__ == "__main__":
    main()
