import * as d3 from "d3";
import { drawCartesianHorizontalBandAxes, buildHorizontalCartesianScene } from "@/components/charts/engine/d3/core/sceneGraph";
import { paintHorizontalBar, resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import {
  attachCartesianDataZoom,
  cartesianSparkline,
  rowsInCategories,
  visibleDataZoomCategories,
} from "@/components/charts/engine/d3/core/dataZoom";
import { renderConfiguredInlineLegend } from "@/components/charts/engine/d3/core/d3Legend";
import { drawVerticalMarkLines } from "@/components/charts/engine/d3/core/markLines";
import { resolveSeriesGradientFill } from "@/components/charts/engine/d3/core/gradient";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { groupSeries, normalizeCartesianData, resolveDatumColor, resolveSeriesKeys, seriesDataKey, seriesDomClass, seriesDomSelector } from "@/components/charts/engine/d3/core/series";
import { createTooltip, tooltipHtml } from "@/components/charts/engine/d3/core/tooltip";
import type { D3CartesianRenderConfig } from "@/components/charts/engine/d3/types";
import { normalizeCategoryAxisDomain } from "@/components/charts/engine/buildDatasetEncoding";
import { resolveBarBandPadding } from "@/lib/applyChartDeStyleBlocks";
import { formatChartValue, mergePercentValueFormat } from "@/lib/chartValueFormat";
import { formatCartesianDatumLabel, sumCartesianLabelTotal } from "@/components/charts/engine/d3/core/cartesianDataLabel";

const BAR_RX = 4;

type WideRow = Record<string, string | number>;

function paintHBarCell(
  cell: d3.Selection<SVGGElement, unknown, null, undefined>,
  opts: { x: number; w: number; h: number; front: string; solid: string; rx?: number },
  depthLevel?: import("@/components/charts/engine/d3/core/chartVisualTokens").DepthVisualLevel,
): void {
  cell.selectAll("*").remove();
  const level = resolveEffectiveDepth(depthLevel);
  const depthOn = level !== "off";
  paintHorizontalBar({
    plot: cell,
    x: opts.x,
    y: 0,
    width: opts.w,
    height: opts.h,
    color: depthOn ? opts.solid : opts.front,
    rx: opts.rx ?? BAR_RX,
    depthLevel: level,
  });
  if (depthOn && opts.front !== opts.solid) cell.select(".vs-hbar-front").attr("fill", opts.front);
}

function pickCategoryAtBand(my: number, categories: string[], y: d3.ScaleBand<string>): string {
  let best = categories[0] ?? "";
  let bestDist = Infinity;
  for (const cat of categories) {
    const py = (y(cat) ?? 0) + y.bandwidth() / 2;
    const dist = Math.abs(py - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = cat;
    }
  }
  return best;
}

/** 横向柱状图（isHorizontal=true 时由 renderD3BarChart 委托） */
export function renderD3HorizontalBarChart(container: HTMLElement, config: D3CartesianRenderConfig): () => void {
  const incremental = container.dataset.vsIncremental === "true";
  if (!incremental) container.replaceChildren();
  if (config.width <= 0 || config.height <= 0 || config.data.length === 0) return () => undefined;

  const {
    width,
    height,
    data,
    xField,
    yField,
    seriesField,
    isStack = false,
    isGroup = false,
    isPercent = false,
    colors,
    theme,
    showLabel,
    showTooltip,
    showLegend,
    labelFontSize,
    valueFormat,
    markLines = [],
    conditionalRules = [],
    labelColor,
    labelContent,
    seriesGradient = false,
    tooltipPresentation,
    dataZoom = false,
    onPointClick,
    legendLayout,
    barWidthRatio,
    barRadius,
    axisStyle,
    categoryLevelCount,
    depthVisual,
  } = config;

  const barRx = barRadius ?? BAR_RX;
  const depthLevel = resolveEffectiveDepth(depthVisual);

  const normalized = normalizeCartesianData(data, xField, yField, seriesField);
  const allCategories = normalizeCategoryAxisDomain(
    normalized.map((d) => String(d.__category__ ?? "")),
    categoryLevelCount,
  ).categories;
  const categories = visibleDataZoomCategories(container, dataZoom, allCategories);
  const seriesGroups = groupSeries(normalized, seriesField);
  const seriesNames = seriesGroups.map((s) => s.name);
  const hasMultiSeries = seriesNames.length > 1 && Boolean(seriesField);
  const useGrouped = hasMultiSeries && (isGroup || !isStack);
  const colorScale = d3.scaleOrdinal<string>().domain(seriesNames).range(colors);
  const legendItems = hasMultiSeries
    ? seriesNames.map((name) => ({
        label: name || "系列",
        color: colorScale(name) ?? colors[0] ?? theme.accent,
      }))
    : undefined;
  const scene = buildHorizontalCartesianScene({
    container,
    width,
    height,
    showLegend: Boolean(showLegend && hasMultiSeries),
    legendLayout,
    legendItems,
    categories,
    axisStyle,
    dataZoom,
    incremental,
  });
  const { root, defs, g, plot, margin, innerW, innerH } = scene;
  const keys = resolveSeriesKeys(seriesNames);

  const wideRows: WideRow[] = categories.map((cat) => {
    const row: WideRow = { __category__: cat };
    for (const s of seriesGroups) {
      const pt = s.points.find((p) => String(p.__category__) === cat);
      row[seriesDataKey(s.name)] = Number(pt?.__value__ ?? 0);
    }
    if (isPercent) {
      const sum = keys.reduce((acc, name) => acc + Number(row[name] ?? 0), 0);
      if (sum > 0) for (const name of keys) row[name] = Number(row[name] ?? 0) / sum;
    }
    return row;
  });

  const maxVal =
    isStack || isPercent
      ? (d3.max(wideRows, (row) => keys.reduce((sum, k) => sum + Number(row[k] ?? 0), 0)) ?? 0)
      : (d3.max(rowsInCategories(normalized, categories), (d) => Number(d.__value__)) ?? 0);

  const y = d3.scaleBand<string>().domain(categories).range([0, innerH]).padding(resolveBarBandPadding(barWidthRatio));
  const x = d3.scaleLinear().domain([0, maxVal]).nice().range([0, innerW]);
  const ySub = useGrouped ? d3.scaleBand<string>().domain(keys).range([0, y.bandwidth()]).padding(0.12) : null;
  drawVerticalMarkLines(plot, markLines, x, innerH);
  const tooltip = showTooltip ? createTooltip(container, theme, tooltipPresentation) : null;

  drawCartesianHorizontalBandAxes({
    g,
    xScale: x,
    yScale: y,
    innerW,
    innerH,
    theme,
    valueFormat: mergePercentValueFormat(valueFormat, isPercent),
    axisStyle,
    xTickFormat: isPercent
      ? (d) => formatChartValue(d, mergePercentValueFormat(valueFormat, true))
      : undefined,
  });

  if (isStack) {
    const stack = d3.stack<WideRow>().keys(keys);
    const stackLayers = stack(wideRows);
    for (let layerIndex = 0; layerIndex < stackLayers.length; layerIndex += 1) {
      const layer = stackLayers[layerIndex];
      const name = String(layer.key);
      const domClass = seriesDomClass("hbar-stack", layerIndex);
      const color = colorScale(name) ?? colors[0] ?? "#465fff";
      const gradientFill = resolveSeriesGradientFill(defs, domClass, color, seriesGradient, "horizontal");
      plot
        .selectAll(seriesDomSelector("hbar-stack", layerIndex))
        .data(layer)
        .join("g")
        .attr("class", domClass)
        .attr("transform", (d) => `translate(0,${y(String(d.data.__category__)) ?? 0})`)
        .attr("cursor", onPointClick ? "pointer" : "default")
        .each(function (d) {
          const x0 = x(Number(d[0]));
          const w = Math.max(0, x(Number(d[1])) - x0);
          const val = Number(d[1]) - Number(d[0]);
          const solid = gradientFill.startsWith("url(") ? color : resolveDatumColor(val, color, conditionalRules);
          const front = gradientFill.startsWith("url(") ? gradientFill : solid;
          paintHBarCell(d3.select(this), { x: x0, w, h: y.bandwidth(), front, solid, rx: barRx }, depthLevel);
        })
        .on("click", (_e, d) =>
          onPointClick?.({
            __category__: d.data.__category__,
            __value__: Number(d[1]) - Number(d[0]),
            __series__: name,
          }),
        );
    }
  } else {
    seriesGroups.forEach((s, seriesIndex) => {
      const name = s.name || "value";
      const domClass = seriesDomClass("hbar", seriesIndex);
      const color = colorScale(name) ?? colors[0] ?? "#465fff";
      const barH = useGrouped && ySub ? ySub.bandwidth() : y.bandwidth();
      const gradientFill = resolveSeriesGradientFill(defs, domClass, color, seriesGradient, "horizontal");
      plot
        .selectAll(seriesDomSelector("hbar", seriesIndex))
        .data(rowsInCategories(s.points, categories))
        .join("g")
        .attr("class", domClass)
        .attr("transform", (d) => {
          const base = y(String(d.__category__)) ?? 0;
          const by = useGrouped && ySub ? base + (ySub(name) ?? 0) : base;
          return `translate(0,${by})`;
        })
        .attr("cursor", onPointClick ? "pointer" : "default")
        .each(function (d) {
          const w = x(Number(d.__value__));
          const solid = gradientFill.startsWith("url(")
            ? color
            : resolveDatumColor(Number(d.__value__), color, conditionalRules);
          const front = gradientFill.startsWith("url(") ? gradientFill : solid;
          paintHBarCell(d3.select(this), { x: 0, w, h: barH, front, solid, rx: barRx }, depthLevel);
        })
        .on("click", (_e, d) => onPointClick?.(d));
    });
  }

  if (showTooltip) {
    plot
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .lower()
      .on("mousemove", (event) => {
        const [, my] = d3.pointer(event);
        const cat = pickCategoryAtBand(my, categories, y);
        const rows = seriesGroups.map((s) => {
          const pt = s.points.find((p) => String(p.__category__) === cat);
          return { name: s.name, color: colorScale(s.name) ?? colors[0], value: pt?.__value__ ?? 0 };
        });
        tooltip?.style("opacity", "1").html(tooltipHtml(cat, rows, valueFormat));
        const rect = container.getBoundingClientRect();
        tooltip
          ?.style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => tooltip?.style("opacity", "0"));
  }

  if (showLabel) {
    const labelTotal = sumCartesianLabelTotal(normalized);
    plot
      .selectAll("text.hbar-label")
      .data(normalized)
      .join("text")
      .attr("class", "hbar-label")
      .attr("x", (d) => x(Number(d.__value__)) + 4)
      .attr("y", (d) => (y(String(d.__category__)) ?? 0) + y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("fill", resolveLabelFill(theme, labelColor))
      .style("font-size", `${labelFontSize}px`)
      .text((d) =>
        formatCartesianDatumLabel(d, {
          hasMultiSeries,
          labelContent,
          valueFormat,
          isPercent,
          total: labelTotal,
        }),
      );
  }

  if (showLegend && hasMultiSeries) {
    renderConfiguredInlineLegend(
      root,
      true,
      seriesNames.map((name) => ({
        label: name || "系列",
        color: colorScale(name) ?? colors[0] ?? theme.accent,
      })),
      { width, height, margin, theme, layout: legendLayout, fontSize: legendLayout?.fontSize },
    );
  }

  const detachZoom = dataZoom
    ? attachCartesianDataZoom({
        host: container,
        plotRoot: g,
        innerW,
        innerH,
        marginBottom: margin.bottom,
        categories: allCategories,
        sparkline: cartesianSparkline(allCategories, normalized),
        theme,
        redraw: () => renderD3HorizontalBarChart(container, config),
      })
    : () => undefined;

  return () => {
    detachZoom();
    container.replaceChildren();
  };
}
