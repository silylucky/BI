import * as d3 from "d3";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { paintVerticalBar, resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import { createCrosshair } from "@/components/charts/engine/d3/core/crosshair";
import {
  attachCartesianDataZoom,
  cartesianSparkline,
  rowsInCategories,
  visibleDataZoomCategories,
} from "@/components/charts/engine/d3/core/dataZoom";
import { renderConfiguredInlineLegend } from "@/components/charts/engine/d3/core/d3Legend";
import { resolveSeriesGradientFill } from "@/components/charts/engine/d3/core/gradient";
import { writeIncrementalSession } from "@/components/charts/engine/d3/core/incrementalRender";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import {
  buildCartesianScene,
  drawCartesianBandAxes,
  drawHorizontalGrid,
} from "@/components/charts/engine/d3/core/sceneGraph";
import { groupSeries, normalizeCartesianData, resolveDatumColor, resolveSeriesKeys, seriesDataKey, seriesDomClass, seriesDomSelector } from "@/components/charts/engine/d3/core/series";
import { normalizeCategoryAxisDomain } from "@/components/charts/engine/buildDatasetEncoding";
import { themeFromConfig } from "@/components/charts/engine/d3/core/themeEngine";
import { createTooltipLayer } from "@/components/charts/engine/d3/core/tooltipLayer";
import { attachBandCategoryInteraction } from "@/components/charts/engine/d3/cartesian/renderCartesianBase";
import { renderD3HorizontalBarChart } from "@/components/charts/engine/d3/cartesian/renderBarHorizontal";
import type { D3CartesianRenderConfig } from "@/components/charts/engine/d3/types";
import { formatChartValue, mergePercentValueFormat } from "@/lib/chartValueFormat";
import { formatCartesianDatumLabel, sumCartesianLabelTotal } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { resolveBarBandPadding, resolveCartesianPointSize } from "@/lib/applyChartDeStyleBlocks";

const BAR_RX = VCDS.bar.rx;
const STACK_GAP = VCDS.bar.stackGap;

type WideRow = Record<string, string | number>;

function paintVBarCell(
  cell: d3.Selection<SVGGElement, unknown, null, undefined>,
  opts: { y1: number; h: number; w: number; front: string; solid: string; rx?: number },
): void {
  cell.selectAll("*").remove();
  const depthOn = resolveEffectiveDepth() !== "off";
  paintVerticalBar({
    plot: cell,
    x: 0,
    y1: opts.y1,
    height: opts.h,
    width: opts.w,
    color: depthOn ? opts.solid : opts.front,
    rx: opts.rx ?? BAR_RX,
  });
  if (depthOn && opts.front !== opts.solid) cell.select(".vs-bar-front").attr("fill", opts.front);
}

export function renderD3BarChart(container: HTMLElement, config: D3CartesianRenderConfig): () => void {
  if (config.isHorizontal) return renderD3HorizontalBarChart(container, config);

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
    theme: rawTheme,
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
    onPointClick,
    dataZoom = false,
    legendLayout,
    barWidthRatio,
    barRadius,
    axisStyle,
    categoryLevelCount,
  } = config;

  const theme = themeFromConfig(rawTheme);
  const normalized = normalizeCartesianData(data, xField, yField, seriesField);
  const domain = normalizeCategoryAxisDomain(
    normalized.map((d) => String(d.__category__ ?? "")),
    categoryLevelCount,
  );
  const allCategories = domain.categories;
  const categories = visibleDataZoomCategories(container, dataZoom, allCategories);
  const structuralLevelCount = domain.structuralLevelCount;
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

  const scene = buildCartesianScene({
    container,
    width,
    height,
    showLegend: Boolean(showLegend && hasMultiSeries),
    legendLayout,
    legendItems,
    incremental,
    categories,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
    dataZoom,
  });
  const { root, defs, g, plot, innerW, innerH, margin } = scene;
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

  const x = d3
    .scaleBand<string>()
    .domain(categories)
    .range([0, innerW])
    .padding(resolveBarBandPadding(barWidthRatio));
  const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);
  const xSub = useGrouped ? d3.scaleBand<string>().domain(keys).range([0, x.bandwidth()]).padding(0.12) : null;
  const barRx = barRadius ?? BAR_RX;
  const axisValueFormat = mergePercentValueFormat(valueFormat, isPercent);

  drawHorizontalGrid(plot, { yScale: y, innerW, theme });
  drawCartesianBandAxes({
    g,
    xScale: x,
    yScale: y,
    categories,
    innerW,
    innerH,
    theme,
    valueFormat: axisValueFormat,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
  });

  plot.selectAll("*").remove();

  if (isStack) {
    const stack = d3.stack<WideRow>().keys(keys);
    const stackLayers = stack(wideRows);
    for (let layerIndex = 0; layerIndex < stackLayers.length; layerIndex += 1) {
      const layer = stackLayers[layerIndex];
      const name = String(layer.key);
      const domClass = seriesDomClass("bar-stack", layerIndex);
      const color = colorScale(name) ?? colors[0] ?? theme.accent;
      const gradientFill = resolveSeriesGradientFill(defs, domClass, color, seriesGradient);
      plot
        .selectAll(seriesDomSelector("bar-stack", layerIndex))
        .data(layer)
        .join("g")
        .attr("class", domClass)
        .attr("transform", (d) => `translate(${x(String(d.data.__category__)) ?? 0},0)`)
        .attr("cursor", onPointClick ? "pointer" : "default")
        .each(function (d) {
          const y1 = y(Number(d[1]));
          const rawH = Math.max(0, y(Number(d[0])) - y1);
          const h = rawH > STACK_GAP ? rawH - STACK_GAP : rawH;
          const val = Number(d[1]) - Number(d[0]);
          const solid = gradientFill.startsWith("url(") ? color : resolveDatumColor(val, color, conditionalRules);
          const front = gradientFill.startsWith("url(") ? gradientFill : solid;
          paintVBarCell(d3.select(this), { y1, h, w: x.bandwidth(), front, solid, rx: barRx });
        })
        .on("click", (event, d) => {
          event.stopPropagation();
          onPointClick?.({
            __category__: d.data.__category__,
            __value__: Number(d[1]) - Number(d[0]),
            __series__: name,
          });
        });
    }
  } else {
    seriesGroups.forEach((s, seriesIndex) => {
      const name = s.name || "value";
      const domClass = seriesDomClass("bar", seriesIndex);
      const color = colorScale(name) ?? colors[0] ?? theme.accent;
      const barW = useGrouped && xSub ? xSub.bandwidth() : x.bandwidth();
      const gradientFill = resolveSeriesGradientFill(defs, domClass, color, seriesGradient);
      plot
        .selectAll(seriesDomSelector("bar", seriesIndex))
        .data(rowsInCategories(s.points, categories))
        .join("g")
        .attr("class", domClass)
        .attr("transform", (d) => {
          const base = x(String(d.__category__)) ?? 0;
          const bx = useGrouped && xSub ? base + (xSub(name) ?? 0) : base;
          return `translate(${bx},0)`;
        })
        .attr("cursor", onPointClick ? "pointer" : "default")
        .each(function (d) {
          const y1 = y(Number(d.__value__));
          const solid = gradientFill.startsWith("url(")
            ? color
            : resolveDatumColor(Number(d.__value__), color, conditionalRules);
          const front = gradientFill.startsWith("url(") ? gradientFill : solid;
          paintVBarCell(d3.select(this), { y1, h: innerH - y1, w: barW, front, solid, rx: barRx });
        })
        .on("click", (event, d) => {
          event.stopPropagation();
          onPointClick?.(d);
        });
    });
  }

  for (const line of markLines.filter((m) => m.enabled && Number.isFinite(m.value))) {
    const ly = y(line.value);
    plot
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", ly)
      .attr("y2", ly)
      .attr("stroke", line.color ?? theme.accent)
      .attr("stroke-dasharray", line.lineStyle === "solid" ? undefined : "5 4");
  }

  const tooltip = showTooltip ? createTooltipLayer(container, theme, tooltipPresentation) : null;
  const crosshair = createCrosshair({ plot, innerW, innerH, theme });
  if (showTooltip) {
    attachBandCategoryInteraction({
      container,
      plot,
      innerW,
      innerH,
      width,
      categories,
      xScale: x,
      yScale: y,
      crosshair,
      tooltip,
      valueFormat,
      margin,
      buildRows: (cat) =>
        seriesGroups.map((s) => {
          const pt = s.points.find((p) => String(p.__category__) === cat);
          return {
            name: s.name,
            color: colorScale(s.name) ?? colors[0] ?? theme.accent,
            value: pt?.__value__ ?? 0,
          };
        }),
    });
  }

  if (showLabel) {
    const labelTotal = sumCartesianLabelTotal(normalized);
    plot
      .selectAll("text.bar-label")
      .data(normalized)
      .join("text")
      .attr("class", "bar-label")
      .attr("x", (d) => (x(String(d.__category__)) ?? 0) + x.bandwidth() / 2)
      .attr("y", (d) => y(Number(d.__value__)) - 4)
      .attr("text-anchor", "middle")
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

  writeIncrementalSession(container, { plotType: "Column", width, height });
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
        redraw: () => renderD3BarChart(container, config),
      })
    : () => undefined;

  return () => {
    detachZoom();
    container.replaceChildren();
  };
}
