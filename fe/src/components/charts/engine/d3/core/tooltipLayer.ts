import * as d3 from "d3";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";
import type { D3TooltipPresentation } from "@/components/charts/engine/d3/core/presentation";
import type { D3Theme } from "@/components/charts/engine/d3/core/themeEngine";
import { formatChartValue } from "@/lib/chartValueFormat";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import { createTooltip, tooltipHtml } from "@/components/charts/engine/d3/core/tooltip";

export type TooltipLayer = d3.Selection<HTMLDivElement, unknown, null, undefined>;

export function createTooltipLayer(
  container: HTMLElement,
  theme: D3Theme,
  presentation?: D3TooltipPresentation,
): TooltipLayer {
  const existing = d3.select(container).select<HTMLDivElement>("div.vs-tooltip-layer");
  if (!existing.empty()) return existing;

  const layer = createTooltip(container, theme, presentation);
  layer
    .classed("vs-tooltip-layer", true)
    .style("padding", VCDS.tooltip.padding)
    .style("border-radius", `${VCDS.tooltip.borderRadius}px`)
    .style("max-width", `${VCDS.tooltip.maxWidth}px`)
    .style("backdrop-filter", "blur(8px)");
  if (!presentation?.fontSize) {
    layer.style("font-size", `${VCDS.tooltip.fontSize}px`);
  }
  if (!presentation?.background) {
    layer.style("background", theme.floatSurface);
  }

  return layer;
}

export function showMergedTooltipAtViewport(
  layer: TooltipLayer | null,
  viewport: { x: number; y: number },
  category: string,
  rows: { name: string; color: string; value: unknown }[],
  valueFormat?: NumberFormatConfig,
): void {
  if (!layer) return;
  layer
    .style("opacity", "1")
    .style("position", "fixed")
    .style("z-index", "9999")
    .html(tooltipHtml(category, rows, valueFormat));
  const pad = 14;
  const maxW = VCDS.tooltip.maxWidth;
  const left = Math.min(Math.max(viewport.x + pad, 8), window.innerWidth - maxW - 8);
  const top = Math.min(Math.max(viewport.y - pad, 8), window.innerHeight - 56);
  layer.style("left", `${left}px`).style("top", `${top}px`);
}

export function showMergedTooltip(
  layer: TooltipLayer | null,
  container: HTMLElement,
  event: MouseEvent,
  category: string,
  rows: { name: string; color: string; value: unknown }[],
  valueFormat?: NumberFormatConfig,
  chartWidth?: number,
  anchor?: { x: number; y: number },
): void {
  if (!layer) return;
  layer
    .style("opacity", "1")
    .html(tooltipHtml(category, rows, valueFormat));
  const rect = container.getBoundingClientRect();
  const w = rect.width > 0 ? rect.width : (chartWidth ?? rect.width);
  const h = rect.height > 0 ? rect.height : w;
  const localX = anchor?.x ?? event.clientX - rect.left;
  const localY = anchor?.y ?? event.clientY - rect.top;
  layer
    .style("left", `${Math.min(Math.max(localX + 12, 8), w - VCDS.tooltip.maxWidth)}px`)
    .style("top", `${Math.min(Math.max(localY - 12, 8), h - 48)}px`);
}

export function hideTooltip(layer: TooltipLayer | null): void {
  layer?.style("opacity", "0");
}

export { tooltipHtml, formatChartValue };
