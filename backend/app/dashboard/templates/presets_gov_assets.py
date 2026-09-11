"""gov-enterprise-v1 + de-dashboard-v1 模板素材包路径。"""

from __future__ import annotations

PACK = "/template-assets/packs/gov-enterprise-v1"
DE_PACK = "/template-assets/packs/de-dashboard-v1"
BORDERLESS_DECOR_PACK = "/template-assets/packs/borderless-decor-v1/items"

_BORDERLESS_PALETTE_FALLBACK: dict[str, str] = {
    "royal": "cobalt",
    "indigo": "violet",
    "teal": "cyan",
}


def bg_light(name: str) -> str:
    return f"{PACK}/backgrounds/light/{name}.svg"


def bg_dark(name: str) -> str:
    return f"{PACK}/backgrounds/dark/{name}.svg"


def thumb(name: str) -> str:
    return f"{PACK}/thumbs/{name}.svg"


def screen_header(style: str, color: str) -> str:
    return f"{PACK}/screen-headers/screen-header-{style}-{color}.svg"


def borderless_decor(style: str, palette: str) -> str:
    """无边框装饰 SVG（对标 DataEase 组件背景图，非专用标题组件）。"""
    color = _BORDERLESS_PALETTE_FALLBACK.get(palette, palette)
    return f"{BORDERLESS_DECOR_PACK}/{style}-{color}.svg"


def de_bg(slug: str) -> str:
    return f"{DE_PACK}/backgrounds/{slug}.svg"


def de_thumb(slug: str) -> str:
    return f"{DE_PACK}/thumbs/{slug}.svg"


# —— 数据大屏：每套独立底图纹理（对标 DE workbranch 梯形顶栏 + 电路翼）——
SMART_CITY_BG = bg_dark("canvas-dark-cyan-de-platform-header")
SMART_CITY_THUMB = thumb("canvas-dark-cyan-de-platform-header")

DIGITAL_COCKPIT_BG = bg_light("canvas-light-indigo-de-cloud-center")
DIGITAL_COCKPIT_THUMB = thumb("canvas-light-indigo-de-cloud-center")

EMERGENCY_BG = bg_dark("canvas-dark-crimson-de-circuit-wing")
EMERGENCY_THUMB = thumb("canvas-dark-crimson-de-circuit-wing")

ECO_MONITOR_BG = bg_light("canvas-light-emerald-gradient-mesh")
ECO_MONITOR_THUMB = thumb("canvas-light-emerald-gradient-mesh")

COMMUNITY_BG = bg_light("canvas-light-violet-de-platform-header")
COMMUNITY_THUMB = thumb("canvas-light-violet-de-platform-header")

# —— 仪表板：DataEase 风格 de-dashboard-v1 包 ——
EFFICIENCY_BG = de_bg("gov-efficiency")
EFFICIENCY_THUMB = de_thumb("gov-efficiency")

SATISFACTION_BG = de_bg("gov-satisfaction")
SATISFACTION_THUMB = de_thumb("gov-satisfaction")

FINANCE_BG = de_bg("gov-finance")
FINANCE_THUMB = de_thumb("gov-finance")

INVESTMENT_BG = de_bg("gov-investment")
INVESTMENT_THUMB = de_thumb("gov-investment")

GRID_BG = de_bg("gov-grid")
GRID_THUMB = de_thumb("gov-grid")

# —— 通用内置大屏 / 看板（presets.py 引用）——
SCREEN_COMMAND_BG = bg_dark("canvas-dark-cyan-de-platform-header")
SCREEN_TECH_BG = bg_dark("canvas-dark-royal-de-circuit-wing")
SCREEN_GOV_BG = bg_dark("canvas-dark-indigo-de-cloud-center")
SCREEN_SALES_GEO_BG = bg_dark("canvas-dark-emerald-de-platform-header")

# 大屏顶栏装饰条（可叠加在标题组件上）
SCREEN_HEADER_TRAPEZOID = screen_header("de-trapezoid-wing", "cobalt")
SCREEN_HEADER_CLOUD = screen_header("de-circuit-sym", "cyan")

DASH_DUAL_KPI_BG = de_bg("dash-dual-kpi")
DASH_TRIPLE_BG = de_bg("dash-triple")
DASH_OPS_BG = de_bg("dash-ops")
DASH_BLANK_BG = de_bg("dash-blank")
