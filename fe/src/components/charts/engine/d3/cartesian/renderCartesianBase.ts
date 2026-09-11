import * as d3 from "d3";
import { attachBandCrosshairHover, attachCrosshairHover, type CrosshairLayer } from "@/components/charts/engine/d3/core/crosshair";
import { dimOpacity } from "@/components/charts/engine/d3/core/interactionBus";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { motionDuration } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import {
  hideTooltip,
  showMergedTooltip,
  type TooltipLayer,
} from "@/components/charts/engine/d3/core/tooltipLayer";
import type { D3CartesianDatum } from "@/components/charts/engine/d3/types";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";

export function highlightCategoryDots(
  dotLayers: d3.Selection<SVGCircleElement, D3CartesianDatum, SVGGElement, unknown>[],
  category: string | null,
): void {
  const dur = motionDuration("hover");
  dotLayers.forEach((dots) => {
    dots.each(function (d) {
      const active = category != null && String(d.__category__) === category;
      const el = d3.select(this);
      if (prefersReducedMotion()) {
        el.attr("r", active ? VCDS.dot.activeRadius : VCDS.dot.radius).attr("opacity", active ? 1 : 0.85);
        return;
      }
      el.transition()
        .duration(dur)
        .attr("r", active ? VCDS.dot.activeRadius : VCDS.dot.radius)
        .attr("opacity", active ? 1 : 0.85);
    });
  });
}

export function applySeriesDimming(
  sel: d3.Selection<SVGElement, unknown, null, undefined>,
  seriesName: string,
  focused: string | null,
): void {
  sel.attr("opacity", dimOpacity(seriesName === focused || focused == null, focused != null));
}

type SeriesTooltipRow = { name: string; color: string; value: unknown };

export function resolveSeriesAnchorY(
  rows: SeriesTooltipRow[],
  yScale: d3.ScaleLinear<number, number>,
): number {
  const values = rows
    .map((row) => Number(row.value))
    .filter((value) => Number.isFinite(value));
  const anchorValue = values.length > 0 ? Math.max(...values) : 0;
  return yScale(anchorValue);
}

export function attachPointCategoryInteraction(opts: {
  container: HTMLElement;
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  innerW: number;
  innerH: number;
  width: number;
  categories: string[];
  xScale: d3.ScalePoint<string>;
  yScale: d3.ScaleLinear<number, number>;
  crosshair: CrosshairLayer;
  tooltip: TooltipLayer | null;
  valueFormat?: NumberFormatConfig;
  margin?: { left: number; top: number };
  buildRows: (category: string) => SeriesTooltipRow[];
}): void {
  attachCrosshairHover({
    plot: opts.plot,
    innerW: opts.innerW,
    innerH: opts.innerH,
    categories: opts.categories,
    xScale: opts.xScale,
    crosshair: opts.crosshair,
    onCategory(category, _mx, _my, event) {
      const cx = opts.xScale(category) ?? 0;
      const rows = opts.buildRows(category);
      const color = rows[0]?.color ?? "#465fff";
      const cy = resolveSeriesAnchorY(rows, opts.yScale);
      opts.crosshair.show(cx, cy, color);
      showMergedTooltip(
        opts.tooltip,
        opts.container,
        event,
        category,
        rows,
        opts.valueFormat,
        opts.width,
        opts.margin ? { x: opts.margin.left + cx, y: opts.margin.top + cy } : undefined,
      );
    },
    onLeave: () => hideTooltip(opts.tooltip),
  });
}

export function attachBandCategoryInteraction(opts: {
  container: HTMLElement;
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  innerW: number;
  innerH: number;
  width: number;
  categories: string[];
  xScale: d3.ScaleBand<string>;
  yScale: d3.ScaleLinear<number, number>;
  crosshair: CrosshairLayer;
  tooltip: TooltipLayer | null;
  valueFormat?: NumberFormatConfig;
  margin?: { left: number; top: number };
  buildRows: (category: string) => SeriesTooltipRow[];
}): void {
  attachBandCrosshairHover({
    plot: opts.plot,
    innerW: opts.innerW,
    innerH: opts.innerH,
    categories: opts.categories,
    xScale: opts.xScale,
    crosshair: opts.crosshair,
    onCategory(category, _mx, _my, event) {
      const cx = (opts.xScale(category) ?? 0) + opts.xScale.bandwidth() / 2;
      const rows = opts.buildRows(category);
      const color = rows[0]?.color ?? "#465fff";
      const cy = resolveSeriesAnchorY(rows, opts.yScale);
      opts.crosshair.show(cx, cy, color);
      showMergedTooltip(
        opts.tooltip,
        opts.container,
        event,
        category,
        rows,
        opts.valueFormat,
        opts.width,
        opts.margin ? { x: opts.margin.left + cx, y: opts.margin.top + cy } : undefined,
      );
    },
    onLeave: () => hideTooltip(opts.tooltip),
  });
}

export function pulseBarRect(sel: d3.Selection<SVGRectElement, unknown, null, undefined>): void {
  if (prefersReducedMotion()) return;
  sel
    .transition()
    .duration(motionDuration("hover"))
    .attr("filter", `brightness(${VCDS.bar.hoverBrightness})`)
    .transition()
    .duration(motionDuration("hover"))
    .attr("filter", null);
}

export function buildCategoryValueScales(
  categories: string[],
  maxVal: number,
  innerW: number,
  innerH: number,
): { x: d3.ScalePoint<string>; y: d3.ScaleLinear<number, number> } {
  return {
    x: d3.scalePoint<string>().domain(categories).range([0, innerW]).padding(0.5),
    y: d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]),
  };
}
