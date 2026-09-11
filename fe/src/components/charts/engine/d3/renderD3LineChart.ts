import * as d3 from "d3";
import {
  animateStrokePath,
  buildAreaGenerator,
  buildLineGenerator,
  ensureGradientDef,
  groupSeries,
  hasActiveConditionalRules,
  normalizeCartesianData,
  paintConditionalLineSegments,
  resolveDatumColor,
} from "@/components/charts/engine/d3/d3LineVisual";
import {
  attachCartesianDataZoom,
  cartesianSparkline,
  rowsInCategories,
  visibleDataZoomCategories,
} from "@/components/charts/engine/d3/core/dataZoom";
import { renderConfiguredInlineLegend } from "@/components/charts/engine/d3/core/d3Legend";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { applyPathDepthShadow } from "@/components/charts/engine/d3/core/depthEngine";
import { attachCrosshairHover, createCrosshair } from "@/components/charts/engine/d3/core/crosshair";
import {
  buildCartesianScene,
  drawCartesianAxes,
  drawHorizontalGrid,
} from "@/components/charts/engine/d3/core/sceneGraph";
import { themeFromConfig } from "@/components/charts/engine/d3/core/themeEngine";
import {
  createTooltipLayer,
  hideTooltip,
  showMergedTooltip,
} from "@/components/charts/engine/d3/core/tooltipLayer";
import { writeIncrementalSession } from "@/components/charts/engine/d3/core/incrementalRender";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { highlightCategoryDots, resolveSeriesAnchorY } from "@/components/charts/engine/d3/cartesian/renderCartesianBase";
import type { D3CartesianDatum, D3CartesianRenderConfig } from "@/components/charts/engine/d3/types";
import { normalizeCategoryAxisDomain } from "@/components/charts/engine/buildDatasetEncoding";
import { valueAxisUpperBound } from "@/components/charts/engine/d3/core/axes";
import { resolveCartesianLineWidth, resolveCartesianPointSize } from "@/lib/applyChartDeStyleBlocks";
import { formatCartesianDatumLabel, sumCartesianLabelTotal } from "@/components/charts/engine/d3/core/cartesianDataLabel";

export type { D3CartesianDatum as D3LineDatum, D3CartesianRenderConfig as D3LineRenderConfig } from "@/components/charts/engine/d3/types";

export type D3LineRenderConfig = D3CartesianRenderConfig;

export function renderD3LineChart(container: HTMLElement, config: D3LineRenderConfig): () => void {
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
    smooth = false,
    isHorizontal = false,
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
    pointSize,
    axisStyle,
    areaOpacity,
    area,
    lineWidth,
    categoryLevelCount,
    defaultSeriesName,
  } = config;

  const dotRadius = resolveCartesianPointSize(pointSize);
  const strokeWidth = resolveCartesianLineWidth(lineWidth);
  const showAreaFill =
    Boolean(area) || seriesGradient || (areaOpacity != null && areaOpacity > 0);
  const areaFillOpacity = areaOpacity ?? (Boolean(area) ? 0.12 : 0);

  const theme = themeFromConfig(rawTheme);
  const normalized = normalizeCartesianData(data, xField, yField, seriesField);
  const domain = normalizeCategoryAxisDomain(
    normalized.map((d) => String(d.__category__ ?? "")),
    categoryLevelCount,
  );
  const allCategories = domain.categories;
  const categories = visibleDataZoomCategories(container, dataZoom, allCategories);
  const structuralLevelCount = domain.structuralLevelCount;
  const seriesGroups = groupSeries(normalized, seriesField, defaultSeriesName);
  const colorScale = d3.scaleOrdinal<string>().domain(seriesGroups.map((s) => s.name)).range(colors);
  const singleSeries = seriesGroups.length === 1;

  if (isHorizontal) {
    return renderHorizontalLineFallback(container, config, normalized, categories, seriesGroups, colorScale);
  }

  const scene = buildCartesianScene({
    container,
    width,
    height,
    showLegend: Boolean(showLegend && seriesField),
    legendLayout,
    legendItems:
      showLegend && seriesField
        ? seriesGroups.map((series) => ({
            label: series.name || "系列",
            color: colorScale(series.name) ?? colors[0] ?? theme.accent,
            marker: "line" as const,
            markerWidth: 14,
            markerHeight: 3,
          }))
        : undefined,
    incremental,
    categories,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
    dataZoom,
  });
  const { root, defs, g, plot, innerW, innerH, margin } = scene;

  const maxVal = d3.max(rowsInCategories(normalized, categories), (d) => Number(d.__value__)) ?? 0;
  const xScale = d3.scalePoint<string>().domain(categories).range([0, innerW]).padding(0.5);
  const yScale = d3.scaleLinear().domain([0, valueAxisUpperBound(maxVal)]).nice().range([innerH, 0]);

  drawHorizontalGrid(plot, { yScale, innerW, theme });
  drawCartesianAxes({
    g,
    xScale,
    yScale,
    categories,
    innerW,
    innerH,
    theme,
    valueFormat,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
  });

  plot.selectAll("*").remove();

  const lineGen = buildLineGenerator(false, smooth, xScale, yScale);
  const areaGen = buildAreaGenerator(false, smooth, innerH, xScale, yScale);

  const markLineLayer = plot.append("g").attr("class", "mark-lines");
  for (const line of markLines.filter((m) => m.enabled && Number.isFinite(m.value))) {
    const y = yScale(line.value);
    markLineLayer
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", line.color ?? theme.accent)
      .attr("stroke-opacity", 0.85)
      .attr("stroke-dasharray", line.lineStyle === "solid" ? undefined : "5 4");
  }

  const tooltip = showTooltip ? createTooltipLayer(container, theme, tooltipPresentation) : null;
  const crosshair = createCrosshair({ plot, innerW, innerH, theme });
  const dotLayers: d3.Selection<SVGCircleElement, D3CartesianDatum, SVGGElement, unknown>[] = [];

  seriesGroups.forEach((series, seriesIndex) => {
    const color = colorScale(series.name) ?? colors[0] ?? theme.accent;
    const gradId = ensureGradientDef(defs, `d3-line-grad-${seriesIndex}`, color, singleSeries ? 0.32 : 0.16, 0.01);
    const points = rowsInCategories(series.points, categories).sort(
      (a, b) => categories.indexOf(String(a.__category__)) - categories.indexOf(String(b.__category__)),
    );

    if (showAreaFill) {
      plot
        .append("path")
        .datum(points)
        .attr("class", "line-area-fill")
        .attr("fill", seriesGradient ? `url(#${gradId})` : color)
        .attr("fill-opacity", seriesGradient ? 0.95 : areaFillOpacity)
        .attr("d", areaGen);
    }

    const linePath = plot
      .append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-opacity", 1)
      .attr("stroke-linecap", VCDS.line.cap)
      .attr("stroke-linejoin", VCDS.line.join)
      .attr("d", lineGen);
    if (hasActiveConditionalRules(conditionalRules)) {
      linePath.remove();
      paintConditionalLineSegments({
        plot,
        points,
        lineGen,
        baseColor: color,
        conditionalRules,
        strokeWidth,
        strokeLinecap: VCDS.line.cap,
        strokeOpacity: 1,
      });
    } else {
      applyPathDepthShadow(defs, linePath, color, `line-${seriesIndex}`, config.depthVisual);
      animateStrokePath(linePath);
    }

    const dots = plot
      .selectAll<SVGCircleElement, D3CartesianDatum>(`circle.series-${seriesIndex}`)
      .data(points)
      .join("circle")
      .attr("class", `series-${seriesIndex}`)
      .attr("r", dotRadius)
      .attr("fill", (d) => resolveDatumColor(Number(d.__value__), color, conditionalRules))
      .attr("stroke", "#fff")
      .attr("stroke-width", VCDS.dot.strokeWidth)
      .attr("opacity", 0.92)
      .attr("cursor", onPointClick ? "pointer" : "default")
      .attr("cx", (d) => xScale(String(d.__category__)) ?? 0)
      .attr("cy", (d) => yScale(Number(d.__value__)));
    dotLayers.push(dots);
    if (onPointClick) dots.on("click", (_event, datum) => onPointClick(datum));

    if (showLabel) {
      const labelTotal = sumCartesianLabelTotal(normalized);
      plot
        .selectAll<SVGTextElement, D3CartesianDatum>(`text.label-${seriesIndex}`)
        .data(points)
        .join("text")
        .attr("x", (d) => xScale(String(d.__category__)) ?? 0)
        .attr("y", (d) => yScale(Number(d.__value__)) - 8)
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${labelFontSize}px`)
        .text((d) =>
          formatCartesianDatumLabel(d, {
            hasMultiSeries: !singleSeries,
            labelContent,
            valueFormat,
            total: labelTotal,
          }),
        );
    }
  });

  const primaryColor = colorScale(seriesGroups[0]?.name ?? "") ?? colors[0] ?? theme.accent;
  crosshair.dot.attr("fill", primaryColor);

  attachCrosshairHover({
    plot,
    innerW,
    innerH,
    categories,
    xScale,
    crosshair,
    onCategory: (category, _mx, _my, event) => {
      const cx = xScale(category) ?? 0;
      const rows = seriesGroups.map((series) => {
        const point = series.points.find((p) => String(p.__category__) === category);
        const color = colorScale(series.name) ?? colors[0] ?? theme.accent;
        return { name: series.name, color, value: point?.__value__ ?? 0 };
      });
      const cy = resolveSeriesAnchorY(rows, yScale);
      crosshair.show(cx, cy, primaryColor);
      highlightCategoryDots(dotLayers, category);
      showMergedTooltip(
        tooltip,
        container,
        event,
        category,
        rows,
        valueFormat,
        width,
        { x: scene.margin.left + cx, y: scene.margin.top + cy },
      );
    },
    onLeave: () => {
      highlightCategoryDots(dotLayers, null);
      hideTooltip(tooltip);
    },
  });

  root.selectAll("g.vs-inline-legend").remove();
  if (showLegend && seriesField) {
    renderConfiguredInlineLegend(
      root,
      true,
      seriesGroups.map((series) => ({
        label: series.name || "系列",
        color: colorScale(series.name) ?? colors[0] ?? theme.accent,
        marker: "line",
        markerWidth: 14,
        markerHeight: 3,
      })),
      {
        width,
        height,
        margin: scene.margin,
        theme,
        layout: legendLayout,
        fontSize: legendLayout?.fontSize,
      },
    );
  }

  writeIncrementalSession(container, { plotType: "Line", width, height });
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
        redraw: () => renderD3LineChart(container, config),
      })
    : () => undefined;

  return () => {
    detachZoom();
    if (!incremental) container.replaceChildren();
  };
}

function renderHorizontalLineFallback(
  container: HTMLElement,
  config: D3LineRenderConfig,
  normalized: D3CartesianDatum[],
  categories: string[],
  seriesGroups: ReturnType<typeof groupSeries>,
  colorScale: d3.ScaleOrdinal<string, string>,
): () => void {
  container.replaceChildren();
  const { width, height, colors, theme: rawTheme, smooth, showTooltip, valueFormat, onPointClick, tooltipPresentation, lineWidth } = config;
  const theme = themeFromConfig(rawTheme);
  const strokeWidth = resolveCartesianLineWidth(lineWidth);
  const scene = buildCartesianScene({ container, width, height, showLegend: false });
  const maxVal = d3.max(normalized, (d) => Number(d.__value__)) ?? 0;
  const xScale = d3.scalePoint<string>().domain(categories).range([0, scene.innerH]).padding(0.5);
  const yScale = d3.scaleLinear().domain([0, valueAxisUpperBound(maxVal)]).nice().range([0, scene.innerW]);
  const lineGen = buildLineGenerator(true, smooth, xScale, yScale);
  seriesGroups.forEach((series, i) => {
    const color = colorScale(series.name) ?? colors[0] ?? theme.accent;
    const linePath = scene.plot
      .append("path")
      .datum(series.points)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", strokeWidth)
      .attr("d", lineGen);
    applyPathDepthShadow(scene.defs, linePath, color, `hline-${i}`, config.depthVisual);
  });
  const tooltip = showTooltip ? createTooltipLayer(container, theme, tooltipPresentation) : null;
  return () => {
    hideTooltip(tooltip);
    container.replaceChildren();
  };
}
