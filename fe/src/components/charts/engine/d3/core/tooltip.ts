import * as d3 from "d3";
import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { D3TooltipPresentation } from "@/components/charts/engine/d3/core/presentation";
import { formatChartValue } from "@/lib/chartValueFormat";
import { formatCompositeCategoryDisplay } from "@/components/charts/engine/buildDatasetEncoding";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";

function applyTooltipPresentation(
  layer: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  theme: AntvThemeTokens,
  presentation?: D3TooltipPresentation,
): void {
  const fontSize = presentation?.fontSize ?? 12;
  layer
    .style("font-size", `${fontSize}px`)
    .style("color", presentation?.color ?? theme.tooltipText)
    .style("background", presentation?.background ?? theme.tooltipBg);
}

export function createTooltip(
  container: HTMLElement,
  theme: AntvThemeTokens,
  presentation?: D3TooltipPresentation,
) {
  const layer = d3.select(container).append("div");
  layer
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", "0")
    .style("padding", "8px 10px")
    .style("border-radius", "8px")
    .style("line-height", "1.35")
    .style("border", `1px solid ${theme.axisLine}`)
    .style("box-shadow", "0 8px 24px rgba(16,24,40,0.14)")
    .style("backdrop-filter", "blur(6px)")
    .style("transition", "opacity 120ms ease, left 200ms cubic-bezier(0.33, 1, 0.68, 1), top 200ms cubic-bezier(0.33, 1, 0.68, 1)")
    .style("z-index", "10");
  applyTooltipPresentation(layer, theme, presentation);
  return layer;
}

export function tooltipHtml(
  category: string,
  rows: { name: string; color: string; value: unknown }[],
  valueFormat?: NumberFormatConfig,
): string {
  const items = rows
    .map(
      (row) =>
        `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">` +
        `<span style="width:8px;height:8px;border-radius:999px;background:${row.color};flex-shrink:0"></span>` +
        `<span style="opacity:0.78">${row.name ? `${row.name} · ` : ""}</span>` +
        `<strong>${formatChartValue(row.value, valueFormat)}</strong></div>`,
    )
    .join("");
  return `<div style="font-weight:600;margin-bottom:2px">${formatCompositeCategoryDisplay(category)}</div>${items}`;
}
