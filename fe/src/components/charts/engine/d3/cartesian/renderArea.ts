import * as d3 from "d3";
import { ensureGradientDef } from "@/components/charts/engine/d3/core/gradient";
import { createCrosshair } from "@/components/charts/engine/d3/core/crosshair";
import { drawHorizontalMarkLines } from "@/components/charts/engine/d3/core/markLines";
import { writeIncrementalSession } from "@/components/charts/engine/d3/core/incrementalRender";
import {
  attachCartesianDataZoom,
  cartesianSparkline,
  rowsInCategories,
  visibleDataZoomCategories,
} from "@/components/charts/engine/d3/core/dataZoom";
import {
  buildCartesianScene,
  drawCartesianAxes,
  drawHorizontalGrid,
} from "@/components/charts/engine/d3/core/sceneGraph";
import { normalizeCategoryAxisDomain } from "@/components/charts/engine/buildDatasetEncoding";
import { valueAxisUpperBound } from "@/components/charts/engine/d3/core/axes";
import { groupSeries, normalizeCartesianData, resolveDatumColor, resolveSeriesKeys, seriesDataKey } from "@/components/charts/engine/d3/core/series";
import { themeFromConfig } from "@/components/charts/engine/d3/core/themeEngine";
import { createTooltipLayer } from "@/components/charts/engine/d3/core/tooltipLayer";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { applyPathDepthShadow } from "@/components/charts/engine/d3/core/depthEngine";
import { attachPointCategoryInteraction } from "@/components/charts/engine/d3/cartesian/renderCartesianBase";
import { renderConfiguredInlineLegend } from "@/components/charts/engine/d3/core/d3Legend";
import type { D3CartesianRenderConfig } from "@/components/charts/engine/d3/types";
import { formatCartesianDatumLabel, sumCartesianLabelTotal } from "@/components/charts/engine/d3/core/cartesianDataLabel";

type WideRow = Record<string, string | number>;

export function renderD3AreaChart(container: HTMLElement, config: D3CartesianRenderConfig): () => void {
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
    isStack = false,
    colors,
    theme: rawTheme,
    showTooltip,
    showLegend,
    showLabel,
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
    axisStyle,
    areaOpacity,
    categoryLevelCount,
    isPercent,
    depthVisual,
  } = config;

  const stackFillOpacity = areaOpacity ?? 0.35;
  const singleFillOpacity = areaOpacity ?? 0.2;

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
    legendLayout: config.legendLayout,
    legendItems,
    incremental,
    categories,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
    dataZoom,
  });
  const { root, defs, g, plot, margin, innerW, innerH } = scene;

  const x = d3.scalePoint<string>().domain(categories).range([0, innerW]).padding(0.5);
  const wideRows: WideRow[] = categories.map((cat) => {
    const row: WideRow = { __category__: cat };
    for (const s of seriesGroups) {
      const pt = s.points.find((p) => String(p.__category__) === cat);
      row[seriesDataKey(s.name)] = Number(pt?.__value__ ?? 0);
    }
    return row;
  });
  const keys = resolveSeriesKeys(seriesNames);
  const maxVal = isStack
    ? (d3.max(wideRows, (row) => keys.reduce((sum, k) => sum + Number(row[k] ?? 0), 0)) ?? 0)
    : (d3.max(rowsInCategories(normalized, categories), (d) => Number(d.__value__)) ?? 0);
  const y = d3.scaleLinear().domain([0, valueAxisUpperBound(maxVal)]).nice().range([innerH, 0]);
  const curve = smooth ? d3.curveMonotoneX : d3.curveLinear;

  drawHorizontalGrid(plot, { yScale: y, innerW, theme });
  drawCartesianAxes({
    g,
    xScale: x,
    yScale: y,
    categories,
    innerW,
    innerH,
    theme,
    valueFormat,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
  });

  plot.selectAll("*").remove();
  drawHorizontalMarkLines(plot, markLines, y, innerW);

  if (isStack && hasMultiSeries) {
    const stack = d3.stack<WideRow>().keys(keys);
    const layers = stack(wideRows);
    const areaGen = d3
      .area<d3.SeriesPoint<WideRow>>()
      .x((d) => x(String(d.data.__category__)) ?? 0)
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(curve);

    layers.forEach((layer, i) => {
      const name = String(layer.key);
      const color = colorScale(name) ?? colors[i] ?? "#465fff";
      const gradId = ensureGradientDef(defs, `area-stack-${i}`, color, 0.45, 0.08);
      plot
        .append("path")
        .datum(layer)
        .attr("fill", seriesGradient ? `url(#${gradId})` : color)
        .attr("fill-opacity", seriesGradient ? 1 : stackFillOpacity)
        .attr("d", areaGen)
        .attr("stroke", (d) =>
          resolveDatumColor(Number(d[1]) - Number(d[0]), color, conditionalRules),
        )
        .attr("stroke-width", 1)
        .style("cursor", onPointClick ? "pointer" : "default")
        .on("click", (_e, d) =>
          onPointClick?.({
            __category__: d.data.__category__,
            __value__: Number(d[1]) - Number(d[0]),
            __series__: name,
          }),
        );
    });
  } else {
    for (const [i, s] of seriesGroups.entries()) {
      const color = colorScale(s.name) ?? colors[i] ?? "#465fff";
      const strokeColor = resolveDatumColor(
        d3.max(s.points, (d) => Number(d.__value__)) ?? 0,
        color,
        conditionalRules,
      );
      const gradId = ensureGradientDef(defs, `area-${i}`, strokeColor, 0.38, 0.04);
      const points = rowsInCategories(s.points, categories).sort(
        (a, b) => categories.indexOf(String(a.__category__)) - categories.indexOf(String(b.__category__)),
      );
      const areaGen = d3
        .area<(typeof points)[0]>()
        .x((d) => x(String(d.__category__)) ?? 0)
        .y0(innerH)
        .y1((d) => y(Number(d.__value__)))
        .curve(curve);
      plot
        .append("path")
        .datum(points)
        .attr("fill", seriesGradient ? `url(#${gradId})` : strokeColor)
        .attr("fill-opacity", seriesGradient ? 1 : singleFillOpacity)
        .attr("d", areaGen);
      const topLine = plot
        .append("path")
        .datum(points)
        .attr("fill", "none")
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2)
        .attr("d", d3.line<typeof points[0]>().x((d) => x(String(d.__category__)) ?? 0).y((d) => y(Number(d.__value__))).curve(curve));
      applyPathDepthShadow(defs, topLine, strokeColor, `area-top-${i}`, depthVisual);

      if (showLabel) {
        const labelTotal = sumCartesianLabelTotal(points);
        plot
          .selectAll(`text.area-label-${i}`)
          .data(points)
          .join("text")
          .attr("class", `area-label-${i}`)
          .attr("x", (d) => x(String(d.__category__)) ?? 0)
          .attr("y", (d) => y(Number(d.__value__)) - 6)
          .attr("text-anchor", "middle")
          .attr("fill", resolveLabelFill(theme, labelColor))
          .style("font-size", `${labelFontSize ?? 12}px`)
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
    }
  }

  const tooltip = showTooltip ? createTooltipLayer(container, theme, tooltipPresentation) : null;
  const crosshair = createCrosshair({ plot, innerW, innerH, theme });
  if (showTooltip) {
    attachPointCategoryInteraction({
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

  if (showLegend && hasMultiSeries && legendItems) {
    renderConfiguredInlineLegend(root, true, legendItems, {
      width,
      height,
      margin,
      theme,
      layout: config.legendLayout,
      fontSize: config.legendLayout?.fontSize,
    });
  }

  writeIncrementalSession(container, { plotType: "Area", width, height });
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
        redraw: () => renderD3AreaChart(container, config),
      })
    : () => undefined;

  return () => {
    detachZoom();
    container.replaceChildren();
  };
}