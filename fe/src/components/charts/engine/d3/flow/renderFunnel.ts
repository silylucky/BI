import * as d3 from "d3";
import { prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import { depthExtrudePx, resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import { renderConfiguredInlineLegend } from "@/components/charts/engine/d3/core/d3Legend";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";
import { createTooltip, tooltipHtml } from "@/components/charts/engine/d3/core/tooltip";
import { MIN_CHART_PRESENTATION_FONT_SIZE } from "@/components/charts/engine/d3/core/chartPresentationScale";
import { estimateLabelPixelWidth } from "@/components/charts/engine/d3/core/labelWidth";
import type { D3Datum, D3RenderConfig } from "@/components/charts/engine/d3/types";
import { formatChartValue } from "@/lib/chartValueFormat";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { computeFunnelLayout, funnelLayerTopY } from "./funnelLayout";
import { drawFunnelLayer, funnelTrapezoidPath } from "./funnelDepth";

type FunnelRow = { stage: string; number: number };

function fitFunnelThumbnailViewBox(
  root: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  width: number,
  height: number,
  pad = 4,
): void {
  const node = plot.node();
  if (!node) return;
  const bbox = node.getBBox();
  if (bbox.width <= 0 || bbox.height <= 0) return;
  root
    .attr(
      "viewBox",
      `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`,
    )
    .attr("width", width)
    .attr("height", height)
    .attr("preserveAspectRatio", "xMidYMid meet");
}

function contrastOnFill(fill: string): string {
  const hex = fill.trim();
  if (!hex.startsWith("#") || hex.length < 7) return "#fff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1f2937" : "#fff";
}

export function renderD3FunnelChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();

  const {
    width,
    height,
    colors,
    theme,
    showLabel,
    showTooltip,
    showLegend,
    labelFontSize,
    labelColor,
    valueFormat,
    labelContent,
    conditionalRules = [],
    legendLayout,
    onPointClick,
    options,
    depthVisual,
    renderTier,
  } = config;

  const isThumbnail = renderTier === "thumbnail";
  const depthLevel = isThumbnail ? "off" : resolveEffectiveDepth(depthVisual);
  const extrude = depthExtrudePx(depthLevel);
  const xField = String(options.xField ?? "stage");
  const yField = String(options.yField ?? "number");
  const raw = (options.data as D3Datum[]) ?? [];
  const showConversion = options.__funnelShowConversion === true;
  const data: FunnelRow[] = raw
    .map((row) => ({ stage: String(row[xField] ?? ""), number: Number(row[yField] ?? 0) }))
    .sort((a, b) => b.number - a.number);
  const funnelTotal = d3.sum(data, (row) => row.number);

  if (width <= 0 || height <= 0 || data.length === 0) return () => undefined;

  const colorScale = d3.scaleOrdinal<string>().domain(data.map((d) => d.stage)).range(colors);
  const funnelLegendItems = data.map((row, index) => ({
    label: row.stage,
    color: colorScale(row.stage) ?? colors[index % colors.length] ?? "#465fff",
  }));
  const layout = computeFunnelLayout({
    width,
    height,
    count: data.length,
    showLegend: Boolean(showLegend),
    legendLayout,
    legendItems: funnelLegendItems,
    showConversion,
    gap: Number(options.__funnelGap ?? 4),
    extrudePx: extrude,
    renderTier,
  });
  const { margin, cx, maxWidth, layerH, gap } = layout;
  const maxVal = d3.max(data, (d) => d.number) ?? 1;

  const root = d3
    .select(container)
    .append("svg")
    .attr("class", "vs-chart-svg")
    .attr("data-vs-embedded-fit", "content")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .style("overflow", "visible");

  const g = root.append("g");
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  data.forEach((row, index) => {
    const topW = Math.max(10, (row.number / maxVal) * maxWidth);
    const next = data[index + 1];
    const bottomW = next ? Math.max(10, (next.number / maxVal) * maxWidth) : Math.max(10, topW * 0.78);
    const topY = funnelLayerTopY(layout, index);
    const bottomY = topY + layerH;
    const baseColor = colorScale(row.stage) ?? colors[index % colors.length] ?? "#465fff";
    const fill = resolveDatumColor(row.number, baseColor, conditionalRules);

    const item = drawFunnelLayer({
      plot: g,
      cx,
      topY,
      bottomY,
      topW,
      bottomW,
      color: fill,
      depth: extrude,
    });
    const path = item.select<SVGPathElement>("path.vs-funnel-layer");
    path.attr("cursor", onPointClick ? "pointer" : "default");

    if (!prefersReducedMotion()) {
      const front = funnelTrapezoidPath(cx, topY, bottomY, topW, bottomW);
      path
        .attr("d", funnelTrapezoidPath(cx, topY, topY, 0, 0))
        .transition()
        .duration(520)
        .delay(index * 50)
        .ease(d3.easeCubicOut)
        .attr("d", front);
    }

    path
      .on("mouseenter", () => {
        path.transition().duration(120).attr("opacity", 1);
        if (extrude > 0) item.attr("transform", "translate(0,-2)");
        if (!tooltip) return;
        tooltip
          .style("opacity", "1")
          .html(tooltipHtml(row.stage, [{ name: "", color: fill, value: row.number }], valueFormat));
      })
      .on("mousemove", (event) => {
        if (!tooltip) return;
        const rect = container.getBoundingClientRect();
        tooltip
          .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => {
        path.transition().duration(120).attr("opacity", 1);
        item.attr("transform", null);
        tooltip?.style("opacity", "0");
      })
      .on("click", () => onPointClick?.({ [xField]: row.stage, [yField]: row.number }));

    if (showLabel) {
      const label = formatSimpleDataLabel(row.stage, row.number, funnelTotal, labelContent, valueFormat);
      const midW = (topW + bottomW) / 2;
      const inside = estimateLabelPixelWidth(label, labelFontSize) + 8 < midW;
      item
        .append("text")
        .attr("x", inside ? cx : cx + midW / 2 + 8)
        .attr("y", (topY + bottomY) / 2)
        .attr("text-anchor", inside ? "middle" : "start")
        .attr("dy", "0.35em")
        .attr("fill", inside ? (labelColor?.trim() || contrastOnFill(fill)) : theme.axisLabel)
        .style("font-size", `${labelFontSize}px`)
        .style("pointer-events", "none")
        .text(label);
    }

    if (showConversion && index < data.length - 1) {
      const nxt = data[index + 1]!;
      const rate = row.number > 0 ? (nxt.number / row.number) * 100 : 0;
      g.append("text")
        .attr("x", margin.left + layout.innerW + 6)
        .attr("y", bottomY + gap / 2)
        .attr("text-anchor", "start")
        .attr("dy", "0.35em")
        .attr("fill", theme.axisLabel)
        .style("font-size", `${Math.max(MIN_CHART_PRESENTATION_FONT_SIZE, Math.round(labelFontSize * 0.92))}px`)
        .style("pointer-events", "none")
        .text(formatChartValue(rate, valueFormat ? { ...valueFormat, unit: "%" } : { type: "percent" }));
    }
  });

  renderConfiguredInlineLegend(root, Boolean(showLegend), funnelLegendItems, {
    width,
    height,
    margin,
    theme,
    layout: legendLayout,
    fontSize: legendLayout?.fontSize,
  });

  if (isThumbnail) {
    fitFunnelThumbnailViewBox(root, g, width, height);
  }

  return () => container.replaceChildren();
}
