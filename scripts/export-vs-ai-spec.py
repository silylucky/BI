#!/usr/bin/env python3
"""Export VS-AI-SPEC capability manifest and theme tokens.

Theme constants must stay aligned with:
  fe/src/components/dashboard/dashboardThemeTokens.ts
  fe/src/components/charts/engine/d3/core/themeEngine.ts
  fe/src/components/charts/engine/antv/theme.ts
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "api" / "vs-ai-spec"
sys.path.insert(0, str(ROOT / "backend"))

from app.viz.registry import export_chart_type_catalog  # noqa: E402

# --- dashboardThemeTokens.ts (LIGHT / DARK) ---
_LIGHT_DASHBOARD = {
    "canvas": "#ffffff",
    "widgetShell": "#ffffff",
    "widgetBorder": "#e4e7ec",
    "title": "#1d2939",
    "filterTitle": "#475467",
    "dialogBg": "#ffffff",
    "dialogFg": "#344054",
    "textPrimary": "#344054",
    "textMuted": "#667085",
    "chartAxis": "#667085",
    "chartLegend": "#344054",
    "chartGrid": "#e4e7ec",
    "tableHeaderBg": "#f9fafb",
    "tableHeaderFg": "#667085",
    "tableBodyFg": "#344054",
    "tableBorder": "#f2f4f7",
    "stateText": "#667085",
}

_DARK_DASHBOARD = {
    "canvas": "#0f172a",
    "widgetShell": "#1e293b",
    "widgetBorder": "#344054",
    "title": "#f2f4f7",
    "filterTitle": "#98a2b3",
    "dialogBg": "#1d2939",
    "dialogFg": "#ececed",
    "textPrimary": "#e2e8f0",
    "textMuted": "#98a2b3",
    "chartAxis": "#cbd5e1",
    "chartLegend": "#e2e8f0",
    "chartGrid": "#344054",
    "tableHeaderBg": "#0f172a",
    "tableHeaderFg": "#98a2b3",
    "tableBodyFg": "#d0d5dd",
    "tableBorder": "#334155",
    "stateText": "#98a2b3",
}

# --- antv/theme.ts chart tokens ---
_LIGHT_ANTV = {
    "axisLabel": "#667085",
    "axisLine": "#e4e7ec",
    "gridLine": "#f2f4f7",
    "legendText": "#344054",
    "tooltipBg": "rgba(255,255,255,0.96)",
    "tooltipText": "#344054",
    "background": "transparent",
}

_DARK_ANTV = {
    "axisLabel": "rgba(255,255,255,0.72)",
    "axisLine": "rgba(255,255,255,0.2)",
    "gridLine": "rgba(255,255,255,0.08)",
    "legendText": "rgba(255,255,255,0.85)",
    "tooltipBg": "rgba(17,24,39,0.92)",
    "tooltipText": "#f9fafb",
    "background": "transparent",
}

_DEFAULT_ACCENT = "#465fff"


def _resolve_d3_theme(scheme: str, accent: str = _DEFAULT_ACCENT) -> dict[str, Any]:
    """Mirror fe/.../themeEngine.ts resolveD3Theme (documentation export)."""
    is_dark = scheme == "dark"
    base = _DARK_ANTV if is_dark else _LIGHT_ANTV
    return {
        **base,
        "scheme": scheme,
        "plotSurface": "rgba(255,255,255,0.02)" if is_dark else "rgba(255,255,255,0.6)",
        "panelSurface": "rgba(15,23,42,0.85)" if is_dark else "rgba(249,250,251,0.92)",
        "floatSurface": "rgba(17,24,39,0.94)" if is_dark else "rgba(255,255,255,0.96)",
        "accent": accent,
        "accentMuted": "rgba(70,95,255,0.35)" if is_dark else "rgba(70,95,255,0.18)",
        "seriesGlow": "rgba(70,95,255,0.45)" if is_dark else "rgba(70,95,255,0.25)",
        "crosshair": "rgba(255,255,255,0.35)" if is_dark else "rgba(70,95,255,0.55)",
        "dimOpacity": 0.25,
    }


def _theme_tokens_to_scope_vars(tokens: dict[str, str]) -> dict[str, str]:
    """Mirror dashboardThemeTokens.themeTokensToScopeVars."""
    return {
        "--dashboard-artboard-bg": tokens["canvas"],
        "--dashboard-widget-surface": tokens["widgetShell"],
        "--dashboard-widget-border": tokens["widgetBorder"],
        "--dashboard-text-primary": tokens["textPrimary"],
        "--dashboard-text-muted": tokens["textMuted"],
        "--dashboard-title-color": tokens["title"],
        "--dashboard-chart-axis": tokens["chartAxis"],
        "--dashboard-chart-legend": tokens["chartLegend"],
        "--dashboard-chart-grid": tokens["chartGrid"],
        "--dashboard-table-header-bg": tokens["tableHeaderBg"],
        "--dashboard-table-header-fg": tokens["tableHeaderFg"],
        "--dashboard-table-body-fg": tokens["tableBodyFg"],
        "--dashboard-table-border": tokens["tableBorder"],
        "--dashboard-state-text": tokens["stateText"],
        "--dashboard-dialog-bg": tokens["dialogBg"],
        "--dashboard-dialog-fg": tokens["dialogFg"],
    }


def _scheme_block(scheme: str) -> dict[str, Any]:
    dash = _DARK_DASHBOARD if scheme == "dark" else _LIGHT_DASHBOARD
    css_vars = _theme_tokens_to_scope_vars(dash)
    d3 = _resolve_d3_theme(scheme)
    css_vars["--vs-d3-accent"] = d3["accent"]
    css_vars["--vs-d3-plot-surface"] = d3["plotSurface"]
    css_vars["--vs-d3-crosshair"] = d3["crosshair"]
    return {
        "dashboard": dash,
        "d3Theme": d3,
        "cssVariables": css_vars,
    }


def export_theme_tokens() -> dict[str, Any]:
    return {
        "version": 1,
        "generatedBy": "scripts/export-vs-ai-spec.py",
        "feAnchors": [
            "fe/src/components/dashboard/dashboardThemeTokens.ts",
            "fe/src/components/charts/engine/d3/core/themeEngine.ts",
            "fe/src/components/charts/engine/antv/theme.ts",
        ],
        "note": "Recommended for customViz bundles; usage is optional, not enforced.",
        "light": _scheme_block("light"),
        "dark": _scheme_block("dark"),
    }


def export_capability_manifest() -> dict[str, Any]:
    catalog = export_chart_type_catalog()
    return {
        "version": 1,
        "widgetTypes": ["chart", "filter", "text", "media", "tabs", "customViz"],
        "chartTypes": catalog,
        "customVizProtocol": "docs/api/vs-ai-spec/PROTOCOL.md",
        "customVizGuides": {
            "platformSla": "docs/api/vs-ai-spec/guides/PLATFORM-SLA.md",
            "htmlRuntime": "docs/api/vs-ai-spec/guides/HTML-RUNTIME.md",
            "renderers": "docs/api/vs-ai-spec/guides/RENDERERS.md",
            "d3Optional": "docs/api/vs-ai-spec/guides/D3-OPTIONAL.md",
            "themeTokens": "docs/api/vs-ai-spec/theme-tokens.json",
            "schemas": {
                "layout": "docs/api/vs-ai-spec/schemas/layout.schema.json",
                "layoutV2Alias": "docs/api/vs-ai-spec/schemas/layout-v2.schema.json",
                "customVizPlugin": "docs/api/vs-ai-spec/schemas/custom-viz-plugin.schema.json",
                "styles": "docs/api/vs-ai-spec/schemas/styles.schema.json",
                "tokens": "docs/api/vs-ai-spec/schemas/tokens.schema.json",
            },
        },
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = export_capability_manifest()
    manifest_path = OUT_DIR / "capability-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(manifest['chartTypes'])} chart types to {manifest_path}")

    tokens = export_theme_tokens()
    tokens_path = OUT_DIR / "theme-tokens.json"
    tokens_path.write_text(
        json.dumps(tokens, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote theme tokens (light/dark) to {tokens_path}")


if __name__ == "__main__":
    main()
