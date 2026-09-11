"""Actionable hints when customViz publish/preflight fails — sync with assets/aiviz-publish-hints.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_ASSETS = Path(__file__).resolve().parents[1] / "assets"
_FIXES_CACHE: dict[str, dict[str, str]] | None = None

HINTS: dict[str, str] = {
    "AIVIZ_INVALID_MANIFEST": (
        "manifest 缺字段。用 scaffold generic-blank 起盘；fieldSlots 与范式一致"
    ),
    "AIVIZ_UNSAFE_CONTENT": (
        "HTML 安全规则：禁止 <script src=、HTML 属性 onclick=/onmouseenter=、javascript:。"
        "悬停暂停用 CSS：.wrap.pause-hover:hover .track { animation-play-state: paused }；"
        "或 JS 用 addEventListener('mouseenter', fn)，勿写 .onmouseenter=function"
    ),
    "AIVIZ_FORBIDDEN_HOST_ID": (
        '禁止 id="app" 或 id="root"（与平台 SPA 冲突）。容器改用 id="vs-cv-*"'
    ),
    "AIVIZ_MOUNT_REQUIRED": (
        "entry 必须调用 host.vsCv.mount(function (p) { ... })，html/d3 均须如此"
    ),
    "AIVIZ_MISSING_ENTRY": "files 必须包含 manifest.entry 指向的 HTML（通常 index.html）",
    "AIVIZ_INLINE_D3_FORBIDDEN": (
        "禁止内联 d3 整库（≥200KB 且含 d3.version）；runtime:d3 时用 host.vsCv.d3，勿 CDN/勿 paste 整库"
    ),
    "AIVIZ_FICTION_API": (
        "禁止 getStyle()、vs-cv-style-update、.vs-cv-style；样式只读 (p&&p.style)||{}，变化由 mount 回调重绘"
    ),
    "AIVIZ_WARN_MOUNT_RECOMMENDED": "html runtime 也应 host.vsCv.mount(render)",
    "AIVIZ_WARN_RESIZE_LAYOUT": (
        "render 内 var layout=(p&&p.layout)||{}; w=layout.width||…; h=layout.height||…；"
        "禁仅用 clientWidth 作唯一尺寸"
    ),
    "AIVIZ_WARN_D3_INTERRUPT": (
        "d3 重绘前 svg.interrupt()，再 selectAll('*').remove()；有 .transition( 必须 interrupt"
    ),
    "AIVIZ_WARN_D3_CLEAR": "d3 每次 render 须 svg.selectAll('*').remove() 清空旧图层",
    "AIVIZ_WARN_BUILTIN_MISROUTE": "应 wf1 chartType，禁止 customViz 仿制内置图（如 treemap 文本列表）",
    "AIVIZ_WARN_STYLE_KEYS_NOT_APPLIED": "须接线 labelShow/tooltipShow、#tooltip、placeTooltipNearPointer",
    "AIVIZ_WARN_DATA_ENCODING": "笛卡尔须读 p.encoding 或 rowsToSeries/resolveBoundColumns",
    "AIVIZ_WARN_DATA_DOMAIN_SORT": "折线/面积须 rowsToSeries 或 localeCompare 排序类目轴",
    "AIVIZ_WARN_STYLE_COMPLIANCE": (
        "render 内读 var st = (p && p.style) || {}；styleSchema 每项加中文 title"
    ),
    "AIVIZ_WARN_DETAIL_TABLE_METRICS": (
        "fieldSlots 与 P2 多维明细范式不符：dimensions.max>1 时须 metrics.min=0,max=0；"
        "generic-blank 起盘后改 manifest；参考 scrolling-table 金样 fieldSlots（勿整包 scaffold）"
    ),
    "AIVIZ_WARN_DOM_HOST_LOOKUP": (
        "禁止 (host||document).getElementById；用 host.querySelector('#vs-cv-*')"
    ),
    "AIVIZ_WARN_DOM_DOCUMENT_LOOKUP": (
        "禁止 document.getElementById；节点须在宿主内 querySelector，id 前缀 vs-cv-"
    ),
    "AIVIZ_WARN_PLATFORM_DUPLICATE_STYLE": (
        "styleSchema 键与平台检查器重复（如 maxItems/refreshMode/titleShow）；删 schema 项，数据 Tab「结果展示」→ payload.rows"
    ),
    "AIVIZ_WARN_PLATFORM_STYLE_KEYS": (
        "bundle 须读平台六块：labelShow/tooltipShow/seriesGradient/paletteColors 或 CSS --vs-palette-*"
    ),
}


def _load_structured_fixes() -> dict[str, dict[str, str]]:
    global _FIXES_CACHE
    if _FIXES_CACHE is not None:
        return _FIXES_CACHE
    path = _ASSETS / "aiviz-structured-fixes.json"
    if path.is_file():
        raw = json.loads(path.read_text(encoding="utf-8"))
        _FIXES_CACHE = raw if isinstance(raw, dict) else {}
    else:
        _FIXES_CACHE = {}
    return _FIXES_CACHE


def hint_for(code: str, message: str = "") -> str | None:
    if code in HINTS:
        return HINTS[code]
    if "fieldSlots" in message and "min" in message:
        return HINTS["AIVIZ_INVALID_MANIFEST"]
    if "forbidden pattern" in message:
        return HINTS["AIVIZ_UNSAFE_CONTENT"]
    if 'id="app"' in message or 'id="root"' in message:
        return HINTS["AIVIZ_FORBIDDEN_HOST_ID"]
    return None


def structured_fix(code: str, message: str = "") -> dict[str, Any]:
    fixes = _load_structured_fixes()
    item = dict(fixes.get(code, {}))
    if not item.get("fix"):
        hint = hint_for(code, message)
        if hint:
            item["fix"] = hint
    if not item.get("snippet"):
        item["snippet"] = ""
    if not item.get("contractRef"):
        item["contractRef"] = code.split("_", 1)[0].lower()
    return {"code": code, **item}


def format_error_block(code: str, message: str, http_status: int = 422) -> list[str]:
    fix = structured_fix(code, message)
    lines = [f"[{http_status}] {code}: {message}"]
    if fix.get("fix"):
        lines.append(f"  → fix: {fix['fix']}")
    if fix.get("snippet"):
        lines.append(f"  → snippet: {fix['snippet']}")
    if fix.get("contractRef"):
        lines.append(f"  → contractRef: {fix['contractRef']}")
    return lines


def fixes_for_issues(
    errors: list[dict[str, Any]] | None = None,
    warnings: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for bucket in (errors or [], warnings or []):
        for item in bucket:
            code = str(item.get("code", ""))
            msg = str(item.get("message", ""))
            if code:
                out.append(structured_fix(code, msg))
    return out
