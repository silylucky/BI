from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from app.ai_viz.models import _resolve_runtime

StyleComplianceTier = Literal["full", "partial", "visual-only"]

_STYLE_PAYLOAD_RE = re.compile(
    r"(?:payload|\bp\b|\bst\b)\s*(?:&&\s*(?:p|payload))?\s*\.\s*style",
    re.IGNORECASE,
)
_STYLE_TOKEN_RE = re.compile(r"--vs-(?:style|palette)-", re.IGNORECASE)
_LAYOUT_FALLBACK_RE = re.compile(r"clientWidth\s*\|\|\s*320")
_EXPLICIT_CHART_SIZE_RE = re.compile(
    r"clientWidth|clientHeight|\.attr\s*\(\s*['\"]width|\.attr\s*\(\s*['\"]height|"
    r"canvas\.width\s*=|canvas\.height\s*=|setAttribute\s*\(\s*['\"]width",
)
_D3_TRANSITION_RE = re.compile(r"\.transition\s*\(")
_D3_INTERRUPT_RE = re.compile(r"\.interrupt\s*\(")

# manifest.id/displayName 暗示内置 chartType 时，禁止 customViz 仿制（如「矩形树图」文本列表）
_BUILTIN_CHART_MISROUTE: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"矩形树|treemap|树图", re.I), "treemap"),
    (re.compile(r"圆角矩形树|circle[\s-]?packing|打包图", re.I), "circle-packing"),
    (re.compile(r"饼图|pie|donut|环形图|玫瑰图", re.I), "pie"),
    (re.compile(r"漏斗|funnel", re.I), "funnel"),
    (re.compile(r"词云|word[\s-]?cloud", re.I), "word-cloud"),
    (re.compile(r"旭日|sunburst", re.I), "sunburst"),
    (re.compile(r"热力图|heatmap|heat[\s-]?map", re.I), "heatmap"),
    (re.compile(r"散点|scatter|气泡图", re.I), "scatter"),
    (re.compile(r"雷达|radar", re.I), "radar"),
    (re.compile(r"仪表盘|gauge|仪表图", re.I), "gauge"),
    (re.compile(r"水球|liquid|水位图", re.I), "liquid"),
    (re.compile(r"sankey|桑基|流向图", re.I), "sankey"),
    (re.compile(r"关系图|力导向|graph图", re.I), "graph"),
    (re.compile(r"地图|choropleth|gis[\s-]?map", re.I), "gis-map"),
)
_STYLE_KEY_USAGE_RE = re.compile(
    r"(?:\b(?:rs|st|style)\.)labelShow|\blabelShow\s*===|\blabelShow\s*!==|"
    r"(?:\b(?:rs|st|style)\.)tooltipShow|\btooltipShow\s*===|\btooltipShow\s*!==|"
    r"placeTooltipNearPointer|class=\"tooltip\"|#tooltip|\.tooltip\b",
)
# 笛卡尔/折线类：用 rows 画线时须读 encoding 且类目轴排序（不限制曲线/视觉样式）
_LINE_CHART_RE = re.compile(
    r"d3\.line\s*\(|lineGen\s*=|areaGen\s*=|scalePoint\s*\(",
)
_CARTESIAN_PLOT_RE = re.compile(
    r"d3\.line\s*\(|lineGen\s*=|areaGen\s*=|scalePoint\s*\(|scaleBand\s*\(",
)
_ROWS_PLOT_RE = re.compile(
    r"p\.rows\.map|payload\.rows\.map|dataFromPayload\s*\(",
)
_ENCODING_MARKERS_RE = re.compile(
    r"p\.encoding|payload\.encoding|encoding\.dimensions|encoding\.metrics|"
    r"resolveBoundColumns|rowsToSeries",
)
_DOMAIN_SORT_MARKERS_RE = re.compile(
    r"rowsToSeries|\.sort\s*\(\s*function|localeCompare\s*\(",
)
_HOST_GET_ELEMENT_BY_ID_RE = re.compile(r"\(\s*host\s*\|\|\s*document\s*\)\s*\.\s*getElementById\b")
_DOCUMENT_GET_ELEMENT_BY_ID_RE = re.compile(r"\bdocument\s*\.\s*getElementById\b")
_DOCUMENT_GET_ELEMENT_BY_ID_FALLBACK_RE = re.compile(r":\s*document\s*\.\s*getElementById\b")

# styleSchema keys that duplicate platform inspector / payload capabilities (case-insensitive match).
_PLATFORM_DUPLICATE_STYLE_KEYS: dict[str, str] = {
    "maxitems": "数据 Tab「结果展示」已控制 LIMIT；bundle 直接使用 payload.rows",
    "maxrows": "数据 Tab「结果展示」已控制 LIMIT；bundle 直接使用 payload.rows",
    "topn": "数据 Tab「结果展示」已控制 LIMIT；bundle 直接使用 payload.rows",
    "resultlimit": "数据 Tab「结果展示」；勿在 styleSchema 重复",
    "querylimit": "数据 Tab「结果展示」；勿在 styleSchema 重复",
    "rowlimit": "数据 Tab「结果展示」；勿在 styleSchema 重复",
    "displaycount": "数据 Tab「结果展示」；勿在 styleSchema 重复",
    "limitrows": "数据 Tab「结果展示」；勿在 styleSchema 重复",
    "refreshmode": "数据 Tab「刷新频率」；勿在 styleSchema 重复",
    "refreshinterval": "数据 Tab「刷新频率」；勿在 styleSchema 重复",
    "refreshrate": "数据 Tab「刷新频率」；勿在 styleSchema 重复",
    "autorefresh": "数据 Tab「刷新频率」；勿在 styleSchema 重复",
    "pollinterval": "数据 Tab「刷新频率」；勿在 styleSchema 重复",
    "titleshow": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "titletext": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "titlecolor": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "titlefontsize": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "titlefontweight": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "titlealign": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "remarkshow": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "remarktext": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "labelshow": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "labelcolor": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "labelfontsize": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "tooltipshow": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "backgroundshow": "样式 Tab 平台六块 / 高级 widgetStyle；勿在 styleSchema 重复",
    "paletteid": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "palettecolors": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "paletteopacity": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
    "seriesgradient": "样式 Tab 平台六块 displayStyle；勿在 styleSchema 重复",
}

# bundle 须消费平台六块写入 payload.style 的键，或 CSS 变量兜底。
_PLATFORM_STYLE_CONSUMPTION_MARKERS: tuple[str, ...] = (
    "labelShow",
    "tooltipShow",
    "seriesGradient",
    "paletteColors",
    "paletteOpacity",
    "resolveStyle",
    "--vs-palette-",
    "--vs-style-",
)


@dataclass(frozen=True, slots=True)
class StyleComplianceWarning:
    code: str
    message: str


def _bundle_source(files: dict[str, str]) -> str:
    return "\n".join(files[name] for name in sorted(files))


def _style_schema_properties(manifest: dict) -> dict:
    style_schema = manifest.get("styleSchema")
    if not isinstance(style_schema, dict):
        return {}
    properties = style_schema.get("properties")
    return properties if isinstance(properties, dict) else {}


def _read_style_hooks(manifest: dict) -> dict | None:
    hooks = manifest.get("styleHooks")
    return hooks if isinstance(hooks, dict) else None


def _hook_is_valid(key: str, hook: object) -> bool:
    if not isinstance(hook, dict):
        return False
    if hook.get("hideWhenFalse"):
        hide_selectors = hook.get("hideSelectors") or hook.get("selectors")
        return isinstance(hide_selectors, list) and len(hide_selectors) > 0
    selectors = hook.get("selectors")
    return isinstance(selectors, list) and len(selectors) > 0


def _collect_style_hook_warnings(manifest: dict) -> list[StyleComplianceWarning]:
    hooks = _read_style_hooks(manifest)
    if not hooks:
        return []

    properties = _style_schema_properties(manifest)
    warnings: list[StyleComplianceWarning] = []

    for key, hook in hooks.items():
        if key not in properties:
            warnings.append(
                StyleComplianceWarning(
                    code="AIVIZ_WARN_STYLE_HOOK_UNKNOWN_KEY",
                    message=f"manifest.styleHooks.{key} 未在 styleSchema.properties 中声明",
                )
            )
            continue
        if not _hook_is_valid(key, hook):
            warnings.append(
                StyleComplianceWarning(
                    code="AIVIZ_WARN_STYLE_HOOK_INVALID",
                    message=f"manifest.styleHooks.{key} 须声明 selectors 或 hideSelectors",
                )
            )

    return warnings


def has_valid_style_hooks(manifest: dict) -> bool:
    hooks = _read_style_hooks(manifest)
    if not hooks:
        return False
    properties = _style_schema_properties(manifest)
    if not properties:
        return False
    for key, hook in hooks.items():
        if key not in properties or not _hook_is_valid(key, hook):
            return False
    return True


def resolve_style_compliance_tier(
    warnings: list[StyleComplianceWarning],
    manifest: dict,
) -> StyleComplianceTier:
    codes = {item.code for item in warnings}
    if not codes:
        return "full"
    if "AIVIZ_WARN_STYLE_COMPLIANCE" in codes:
        if "AIVIZ_WARN_STYLE_HOOK_INVALID" in codes or "AIVIZ_WARN_STYLE_HOOK_UNKNOWN_KEY" in codes:
            return "visual-only"
        return "partial"
    return "partial"


def _collect_field_slot_warnings(manifest: dict) -> list[StyleComplianceWarning]:
    field_slots = manifest.get("fieldSlots")
    if not isinstance(field_slots, dict):
        return []
    dim_rule = field_slots.get("dimensions")
    metric_rule = field_slots.get("metrics")
    if not isinstance(dim_rule, dict) or not isinstance(metric_rule, dict):
        return []
    dim_max = dim_rule.get("max") if isinstance(dim_rule.get("max"), int) else 1
    metric_min = metric_rule.get("min") if isinstance(metric_rule.get("min"), int) else 1
    metric_max = metric_rule.get("max") if isinstance(metric_rule.get("max"), int) else 1
    if dim_max > 1 and metric_min >= 1 and metric_max > 0:
        return [
            StyleComplianceWarning(
                code="AIVIZ_WARN_DETAIL_TABLE_METRICS",
                message=(
                    "fieldSlots 与 P2 多维明细范式不符：dimensions.max>1 时 metrics 须 min=0,max=0；"
                    "与 manifest.id 无关，请对齐金样或改 fieldSlots"
                ),
            )
        ]
    return []


def _collect_platform_duplicate_style_warnings(manifest: dict) -> list[StyleComplianceWarning]:
    properties = _style_schema_properties(manifest)
    warnings: list[StyleComplianceWarning] = []
    for key in properties:
        hint = _PLATFORM_DUPLICATE_STYLE_KEYS.get(str(key).lower())
        if not hint:
            continue
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_PLATFORM_DUPLICATE_STYLE",
                message=f"styleSchema.{key} 与平台已有能力重复：{hint}",
            )
        )
    return warnings


def _reads_payload_layout(entry_html: str) -> bool:
    if "layout.width" in entry_html or "layout.height" in entry_html:
        return True
    if "payload.layout" in entry_html:
        return True
    return bool(re.search(r"\(p\s*&&\s*p\.layout\)", entry_html))


def _collect_resize_lifecycle_warnings(
    entry_html: str,
    runtime: str,
) -> list[StyleComplianceWarning]:
    warnings: list[StyleComplianceWarning] = []

    needs_layout = runtime == "d3" or bool(_EXPLICIT_CHART_SIZE_RE.search(entry_html))
    if needs_layout and not _reads_payload_layout(entry_html):
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_RESIZE_LAYOUT",
                message=(
                    "render 须读取 payload.layout.width/height 设置 SVG/canvas 尺寸；"
                    "禁仅用 clientWidth 作唯一依据，否则拖大拖小 widget 会错位/叠层"
                ),
            )
        )

    if _D3_TRANSITION_RE.search(entry_html) and not _D3_INTERRUPT_RE.search(entry_html):
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_D3_INTERRUPT",
                message=(
                    "检测到 d3 .transition( 但未 .interrupt()；resize 重绘前须 svg.interrupt() "
                    "再清空，否则 clip-path/动画会卡在旧尺寸"
                ),
            )
        )

    if runtime == "d3" and "selectAll('*').remove()" not in entry_html and "selectAll(\"*\").remove()" not in entry_html:
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_D3_CLEAR",
                message=(
                    "d3 runtime 重绘前须 svg.selectAll('*').remove() 清空旧图层，"
                    "避免 resize 后新旧图形叠在一起"
                ),
            )
        )

    return warnings


def _collect_builtin_misroute_warnings(manifest: dict) -> list[StyleComplianceWarning]:
    label = f"{manifest.get('id', '')} {manifest.get('displayName', '')}"
    for pattern, chart_type in _BUILTIN_CHART_MISROUTE:
        if pattern.search(label):
            return [
                StyleComplianceWarning(
                    code="AIVIZ_WARN_BUILTIN_MISROUTE",
                    message=(
                        f"组件名/ID 暗示内置图 {chart_type}；应走 wf1 chartType={chart_type} + "
                        "validate_chart_config，禁止 customViz 用 DOM 文本列表仿制"
                    ),
                )
            ]
    return []


def _collect_data_contract_warnings(entry_html: str) -> list[StyleComplianceWarning]:
    """Cartesian bundles must use platform encoding + sorted domain (data only, not visual style)."""
    if not _ROWS_PLOT_RE.search(entry_html):
        return []

    warnings: list[StyleComplianceWarning] = []
    if _CARTESIAN_PLOT_RE.search(entry_html) and not _ENCODING_MARKERS_RE.search(entry_html):
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_DATA_ENCODING",
                message=(
                    "笛卡尔/折线类 bundle 用 rows 绘图但未读 payload.encoding（或 resolveBoundColumns/"
                    "rowsToSeries）；维/指标列可能猜错，与内置图数据不一致"
                ),
            )
        )
    if _LINE_CHART_RE.search(entry_html) and not _DOMAIN_SORT_MARKERS_RE.search(entry_html):
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_DATA_DOMAIN_SORT",
                message=(
                    "折线/面积用 rows 顺序连线但未对类目轴排序（或 rowsToSeries）；"
                    "SQL 返回序可能导致折线回折、数据看起来「不对」"
                ),
            )
        )
    return warnings


def _collect_style_keys_application_warnings(
    entry_html: str,
    manifest: dict,
) -> list[StyleComplianceWarning]:
    if has_valid_style_hooks(manifest):
        return []
    misroute = bool(_collect_builtin_misroute_warnings(manifest))
    row_dump = bool(
        re.search(
            r"rows\.forEach|for\s*\(\s*var\s+\w+\s*=\s*0[^;]*<\s*rows\.length|p\.rows\.map|"
            r"\.map\s*\(\s*function\s*\(\s*\w+\s*\)\s*\{[^}]*textContent",
            entry_html,
        )
    )
    if not misroute and not row_dump:
        return []
    if _STYLE_KEY_USAGE_RE.search(entry_html):
        return []
    if not _STYLE_PAYLOAD_RE.search(entry_html):
        return []
    return [
        StyleComplianceWarning(
            code="AIVIZ_WARN_STYLE_KEYS_NOT_APPLIED",
            message=(
                "bundle 未接线 labelShow/tooltipShow（显隐、#tooltip、placeTooltipNearPointer）；"
                "样式 Tab 标签/提示不会生效"
            ),
        )
    ]


def _collect_platform_style_consumption_warnings(
    combined: str,
    manifest: dict,
) -> list[StyleComplianceWarning]:
    if has_valid_style_hooks(manifest):
        return []

    has_style_payload = bool(_STYLE_PAYLOAD_RE.search(combined))
    has_style_tokens = bool(_STYLE_TOKEN_RE.search(combined))
    if not has_style_payload and not has_style_tokens:
        return []

    if any(marker in combined for marker in _PLATFORM_STYLE_CONSUMPTION_MARKERS):
        return []

    return [
        StyleComplianceWarning(
            code="AIVIZ_WARN_PLATFORM_STYLE_KEYS",
            message=(
                "bundle 未消费平台六块样式键（labelShow/tooltipShow/seriesGradient/"
                "paletteColors）或 --vs-palette-* / --vs-style-*；样式 Tab 可能不生效，"
                "见 guides/BUNDLE-BOILERPLATE.md §7"
            ),
        )
    ]


def collect_bundle_style_compliance_warnings(
    files: dict[str, str],
    entry: str,
    manifest: dict,
) -> list[StyleComplianceWarning]:
    """Non-blocking style compliance hints for POST/PUT artifact ingest."""
    combined = _bundle_source(files)
    entry_html = files.get(entry, "")
    runtime = _resolve_runtime(manifest)
    warnings: list[StyleComplianceWarning] = []

    warnings.extend(_collect_field_slot_warnings(manifest))
    warnings.extend(_collect_style_hook_warnings(manifest))
    warnings.extend(_collect_platform_duplicate_style_warnings(manifest))
    warnings.extend(_collect_platform_style_consumption_warnings(combined, manifest))

    warnings.extend(_collect_resize_lifecycle_warnings(entry_html, runtime))
    warnings.extend(_collect_builtin_misroute_warnings(manifest))
    warnings.extend(_collect_style_keys_application_warnings(entry_html, manifest))
    warnings.extend(_collect_data_contract_warnings(entry_html))

    has_style_payload = bool(_STYLE_PAYLOAD_RE.search(combined))
    has_style_tokens = bool(_STYLE_TOKEN_RE.search(combined))
    if not has_style_payload and not has_style_tokens and not has_valid_style_hooks(manifest):
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_STYLE_COMPLIANCE",
                message=(
                    "bundle 未引用 payload.style 或 --vs-style-* / --vs-palette-*，"
                    "且未提供有效 manifest.styleHooks；样式面板与看板配色可能不会生效"
                ),
            )
        )

    if _LAYOUT_FALLBACK_RE.search(combined) and "p.layout" not in combined and "payload.layout" not in combined:
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_LAYOUT_FALLBACK",
                message="检测到 clientWidth || 320 作为尺寸兜底；建议优先读取 payload.layout",
            )
        )

    if _HOST_GET_ELEMENT_BY_ID_RE.search(entry_html):
        warnings.append(
            StyleComplianceWarning(
                code="AIVIZ_WARN_DOM_HOST_LOOKUP",
                message=(
                    "entry 使用了 (host||document).getElementById；宿主为 div 时无效。"
                    "请改用 host.querySelector('#vs-cv-*')，见 vs-ai-spec/guides/BUNDLE-BOILERPLATE.md"
                ),
            )
        )

    if _DOCUMENT_GET_ELEMENT_BY_ID_RE.search(entry_html):
        stripped = _DOCUMENT_GET_ELEMENT_BY_ID_FALLBACK_RE.sub("", entry_html)
        if _DOCUMENT_GET_ELEMENT_BY_ID_RE.search(stripped):
            warnings.append(
                StyleComplianceWarning(
                    code="AIVIZ_WARN_DOM_DOCUMENT_LOOKUP",
                    message=(
                        "entry 使用了 document.getElementById；同页多 customViz 会抢节点。"
                        "请改用 host.querySelector('#vs-cv-*')，见 vs-ai-spec/guides/BUNDLE-BOILERPLATE.md"
                    ),
                )
            )

    return warnings
