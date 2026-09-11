import * as d3 from "d3";
import { animateStrokePath } from "@/components/charts/engine/d3/core/animate";
import { appendChartSvg, drawDualAxesAxes, resolveCategoryCartesianLayout } from "@/components/charts/engine/d3/core/sceneGraph";
import {
  groupSeries,
  hasActiveConditionalRules,
  normalizeCartesianData,
  paintConditionalLineSegments,
  resolveDatumColor,
} from "@/components/charts/engine/d3/core/series";
import { createTooltip, tooltipHtml } from "@/components/charts/engine/d3/core/tooltip";
import { drawHorizontalMarkLines } from "@/components/charts/engine/d3/core/markLines";
import {
  attachCartesianDataZoom,
  cartesianSparkline,
  rowsInCategories,
  visibleDataZoomCategories,
} from "@/components/charts/engine/d3/core/dataZoom";
import { DATA_ZOOM_SLIDER_RESERVE } from "@/components/charts/engine/d3/core/dataZoomWindow";
import { cartesianMargin } from "@/components/charts/engine/d3/core/margin";
import { renderConfiguredInlineLegend, type D3LegendItem } from "@/components/charts/engine/d3/core/d3Legend";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { applyPathDepthShadow } from "@/components/charts/engine/d3/core/depthEngine";
import {
  columnTooltipRows,
  renderDualAxesColumnBars,
  resolveDualAxesColumnMax,
  seriesColorAt,
} from "@/components/charts/engine/d3/cartesian/renderDualAxesColumn";
import type {
  D3CartesianDatum,
  D3DualAxesGeometryOption,
  D3DualAxesRenderConfig,
} from "@/components/charts/engine/d3/types";
import { normalizeCategoryAxisDomain } from "@/components/charts/engine/buildDatasetEncoding";
import { formatCartesianDatumLabel, sumCartesianLabelTotal } from "@/components/charts/engine/d3/core/cartesianDataLabel";

function normalizeDataset(
  data: D3CartesianDatum[],
  xField: string,
  yField: string,
  categoryLevelCount?: number,
): { categories: string[]; points: D3CartesianDatum[] } {
  const normalized = normalizeCartesianData(data, xField, yField);
  const { categories } = normalizeCategoryAxisDomain(
    normalized.map((d) => String(d.__category__ ?? "")),
    categoryLevelCount,
  );
  return { categories, points: normalized };
}

function buildDualAxesLegendItems(params: {
  leftGeom: D3DualAxesGeometryOption;
  rightGeom: D3DualAxesGeometryOption;
  leftLabel: string;
  rightLabel: string;
  leftColor: string;
  rightColor: string;
  columnSeriesField?: string;
  lineSeriesField?: string;
  leftLineSeriesField?: string;
  leftData: D3CartesianDatum[];
  rightData: D3CartesianDatum[];
  colors: string[];
}): D3LegendItem[] {
  const {
    leftGeom,
    rightGeom,
    leftLabel,
    rightLabel,
    leftColor,
    rightColor,
    columnSeriesField,
    lineSeriesField,
    leftLineSeriesField,
    leftData,
    rightData,
    colors,
  } = params;
  const items: D3LegendItem[] = [];
  const dualLine = leftGeom.geometry === "line" && rightGeom.geometry === "line";

  const pushLine = (label: string, color: string) => {
    items.push({ label, color, marker: "line", markerWidth: 14, markerHeight: 3 });
  };

  const pushLineSeriesLegend = (
    data: D3CartesianDatum[],
    seriesField: string | undefined,
    fallbackLabel: string,
    fallbackColor: string,
    colorOffset: number,
  ) => {
    if (seriesField) {
      const names = [...new Set(data.map((row) => String(row[seriesField] ?? "")).filter(Boolean))];
      if (names.length > 1) {
        for (const [index, name] of names.entries()) {
          pushLine(name, seriesColorAt(colors, colorOffset + index, fallbackColor));
        }
        return;
      }
    }
    pushLine(fallbackLabel, fallbackColor);
  };

  const pushColumnLegend = (
    data: D3CartesianDatum[],
    fallbackLabel: string,
    fallbackColor: string,
    colorOffset = 0,
  ) => {
    if (columnSeriesField) {
      const names = [...new Set(data.map((row) => String(row[columnSeriesField] ?? "")).filter(Boolean))];
      if (names.length > 1) {
        for (const [index, name] of names.entries()) {
          items.push({
            label: name,
            color: seriesColorAt(colors, colorOffset + index, fallbackColor),
          });
        }
        return;
      }
    }
    items.push({ label: fallbackLabel, color: fallbackColor });
  };

  if (leftGeom.geometry === "line") {
    pushLineSeriesLegend(leftData, leftLineSeriesField, leftLabel, leftColor, 0);
  } else {
    pushColumnLegend(leftData, leftLabel, leftColor, 0);
  }

  if (rightGeom.geometry === "line") {
    pushLineSeriesLegend(
      rightData,
      lineSeriesField ?? (dualLine ? columnSeriesField : undefined),
      rightLabel,
      rightColor,
      1,
    );
  } else {
    pushColumnLegend(rightData, rightLabel, rightColor, 1);
  }

  return items;
}

function renderDualAxesLineSeries(params: {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>;
  points: D3CartesianDatum[];
  categories: string[];
  x: d3.ScalePoint<string>;
  yScale: d3.ScaleLinear<number, number>;
  color: string;
  smooth?: boolean;
  shadowId: string;
  dotClass: string;
  depthVisual?: D3DualAxesRenderConfig["depthVisual"];
  conditionalRules?: D3DualAxesRenderConfig["conditionalRules"];
  onPointClick?: D3DualAxesRenderConfig["onPointClick"];
}): void {
  const sorted = [...params.points].sort(
    (a, b) => params.categories.indexOf(String(a.__category__)) - params.categories.indexOf(String(b.__category__)),
  );
  const curve = params.smooth ? d3.curveMonotoneX : d3.curveLinear;
  const lineGen = d3
    .line<D3CartesianDatum>()
    .x((d) => params.x(String(d.__category__)) ?? 0)
    .y((d) => params.yScale(Number(d.__value__)))
    .curve(curve);
  const conditionalRules = params.conditionalRules ?? [];
  if (hasActiveConditionalRules(conditionalRules) && sorted.length >= 2) {
    paintConditionalLineSegments({
      plot: params.plot,
      points: sorted,
      lineGen,
      baseColor: params.color,
      conditionalRules,
      strokeWidth: 2.5,
      strokeLinecap: "round",
    });
  } else {
    const linePath = params.plot
      .append("path")
      .datum(sorted)
      .attr("fill", "none")
      .attr("stroke", params.color)
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round")
      .attr("d", lineGen);
    applyPathDepthShadow(params.defs, linePath, params.color, params.shadowId, params.depthVisual);
    animateStrokePath(linePath);
  }

  params.plot
    .selectAll(`circle.${params.dotClass}`)
    .data(sorted)
    .join("circle")
    .attr("class", params.dotClass)
    .attr("r", 3)
    .attr("fill", (d) =>
      resolveDatumColor(Number(d.__value__), params.color, params.conditionalRules ?? []),
    )
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .attr("cx", (d) => params.x(String(d.__category__)) ?? 0)
    .attr("cy", (d) => params.yScale(Number(d.__value__)))
    .attr("cursor", params.onPointClick ? "pointer" : "default")
    .on("click", (_event, d) => params.onPointClick?.(d));
}

function renderDualAxesLineLayers(params: {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>;
  data: D3CartesianDatum[];
  xField: string;
  yField: string;
  seriesField?: string;
  categories: string[];
  x: d3.ScalePoint<string>;
  yScale: d3.ScaleLinear<number, number>;
  colors: string[];
  colorOffset: number;
  fallbackColor: string;
  smooth?: boolean;
  shadowPrefix: string;
  dotClassPrefix: string;
  depthVisual?: D3DualAxesRenderConfig["depthVisual"];
  conditionalRules?: D3DualAxesRenderConfig["conditionalRules"];
  onPointClick?: D3DualAxesRenderConfig["onPointClick"];
}): void {
  const normalized = normalizeCartesianData(params.data, params.xField, params.yField, params.seriesField);
  const groups = groupSeries(normalized, params.seriesField);
  const hasMulti = groups.length > 1 && Boolean(params.seriesField);

  if (!hasMulti) {
    renderDualAxesLineSeries({
      plot: params.plot,
      defs: params.defs,
      points: normalized,
      categories: params.categories,
      x: params.x,
      yScale: params.yScale,
      color: params.fallbackColor,
      smooth: params.smooth,
      shadowId: `${params.shadowPrefix}-0`,
      dotClass: params.dotClassPrefix,
      depthVisual: params.depthVisual,
      conditionalRules: params.conditionalRules,
      onPointClick: params.onPointClick,
    });
    return;
  }

  groups.forEach((group, index) => {
    const color = seriesColorAt(params.colors, params.colorOffset + index, params.fallbackColor);
    renderDualAxesLineSeries({
      plot: params.plot,
      defs: params.defs,
      points: group.points,
      categories: params.categories,
      x: params.x,
      yScale: params.yScale,
      color,
      smooth: params.smooth,
      shadowId: `${params.shadowPrefix}-${index}`,
      dotClass: `${params.dotClassPrefix}-${index}`,
      depthVisual: params.depthVisual,
      conditionalRules: params.conditionalRules,
      onPointClick: params.onPointClick,
    });
  });
}

function lineTooltipRows(
  data: D3CartesianDatum[],
  xField: string,
  yField: string,
  seriesField: string | undefined,
  category: string,
  colors: string[],
  fallbackLabel: string,
  fallbackColor: string,
  colorOffset: number,
): Array<{ name: string; color: string; value: number }> {
  const normalized = normalizeCartesianData(data, xField, yField, seriesField);
  const groups = groupSeries(normalized, seriesField);
  if (groups.length > 1 && seriesField) {
    return groups.map((group, index) => {
      const pt = group.points.find((p) => String(p.__category__) === category);
      return {
        name: group.name || fallbackLabel,
        color: seriesColorAt(colors, colorOffset + index, fallbackColor),
        value: Number(pt?.__value__ ?? 0),
      };
    });
  }
  const pt = normalized.find((p) => String(p.__category__) === category);
  return [{ name: fallbackLabel, color: fallbackColor, value: Number(pt?.__value__ ?? 0) }];
}

export function renderD3DualAxesChart(container: HTMLElement, config: D3DualAxesRenderConfig): () => void {
  const incremental = container.dataset.vsIncremental === "true";
  if (!incremental) container.replaceChildren();
  if (config.width <= 0 || config.height <= 0) return () => undefined;

  const {
    width,
    height,
    data: [leftData, rightData],
    xField,
    yField: [leftYField, rightYField],
    geometryOptions,
    columnSeriesField,
    lineSeriesField,
    leftLineSeriesField,
    colors,
    theme,
    showTooltip,
    showLegend = true,
    showLabel = false,
    labelFontSize = 12,
    labelColor,
    labelContent,
    seriesGradient = false,
    tooltipPresentation,
    valueFormat,
    markLines = [],
    conditionalRules,
    dataZoom = false,
    onPointClick,
    legendLayout,
    barWidthRatio,
    barRadius,
    axisStyle,
    smooth: styleSmooth,
    categoryLevelCount,
    depthVisual,
  } = config;
  const lineLabels = config.lineLabels;
  const leftGeom = geometryOptions[0];
  const rightGeom = geometryOptions[1];
  const dualLine = leftGeom.geometry === "line" && rightGeom.geometry === "line";

  const leftSet = normalizeDataset(leftData, xField, leftYField, categoryLevelCount);
  const rightSet = normalizeDataset(rightData, xField, rightYField, categoryLevelCount);
  const domain = normalizeCategoryAxisDomain(
    [...new Set([...leftSet.categories, ...rightSet.categories])],
    categoryLevelCount,
  );
  const allCategories = domain.categories;
  const categories = visibleDataZoomCategories(container, dataZoom, allCategories);
  const structuralLevelCount = domain.structuralLevelCount;
  if (allCategories.length === 0) return () => undefined;

  const leftSmooth = leftGeom.geometry === "line" && (leftGeom.smooth ?? styleSmooth);
  const rightSmooth = rightGeom.geometry === "line" && (rightGeom.smooth ?? styleSmooth);
  const leftColumnOpts =
    leftGeom.geometry === "column" ? leftGeom : { geometry: "column" as const };
  const rightColumnOpts =
    rightGeom.geometry === "column" ? rightGeom : { geometry: "column" as const };

  const leftColor = colors[0] ?? "#465fff";
  const rightColor = colors[1] ?? "#12b76a";
  const leftLabel = lineLabels?.[0] ?? (leftGeom.geometry === "column" ? "柱" : "左");
  const rightLabel = lineLabels?.[1] ?? (rightGeom.geometry === "column" ? "柱" : dualLine ? "右" : "线");
  const legendItems = buildDualAxesLegendItems({
    leftGeom,
    rightGeom,
    leftLabel,
    rightLabel,
    leftColor,
    rightColor,
    columnSeriesField,
    lineSeriesField,
    leftLineSeriesField,
    leftData,
    rightData,
    colors,
  });

  const { margin, innerW, innerH } = resolveCategoryCartesianLayout(width, height, categories, {
    showLegend,
    legendLayout,
    legendItems,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
    marginOverrides: {
      right: 56,
      ...(dataZoom ? { bottom: cartesianMargin().bottom + DATA_ZOOM_SLIDER_RESERVE } : {}),
    },
  });

  const x = d3.scalePoint<string>().domain(categories).range([0, innerW]).padding(0.5);
  const leftMax =
    leftGeom.geometry === "column"
      ? resolveDualAxesColumnMax(
          leftData,
          xField,
          leftYField,
          leftGeom.isGroup || leftGeom.isStack ? columnSeriesField : undefined,
          leftColumnOpts,
        )
      : (d3.max(rowsInCategories(leftSet.points, categories), (d) => Number(d.__value__)) ?? 0);
  const rightMax =
    rightGeom.geometry === "column"
      ? resolveDualAxesColumnMax(
          rightData,
          xField,
          rightYField,
          rightGeom.isGroup || rightGeom.isStack ? columnSeriesField : undefined,
          rightColumnOpts,
        )
      : (d3.max(rowsInCategories(rightSet.points, categories), (d) => Number(d.__value__)) ?? 0);
  const yLeft = d3.scaleLinear().domain([0, leftMax]).nice().range([innerH, 0]);
  const yRight = d3.scaleLinear().domain([0, rightMax]).nice().range([innerH, 0]);

  let root = d3.select(container).select<SVGSVGElement>("svg.vs-chart-svg");
  if (root.empty()) {
    root = appendChartSvg(container, width, height);
  } else {
    root.attr("width", width).attr("height", height);
  }
  let defs = root.select<SVGDefsElement>("defs");
  if (defs.empty()) defs = root.append("defs");
  let g = root.select<SVGGElement>("g.vs-chart-plot-root");
  if (g.empty()) {
    g = root.append("g").attr("class", "vs-chart-plot-root").attr("transform", `translate(${margin.left},${margin.top})`);
  } else {
    g.attr("transform", `translate(${margin.left},${margin.top})`);
    g.selectAll(":not(.data-zoom-slider)").remove();
  }
  const plot = g.append("g").attr("class", "vs-chart-plot");
  drawHorizontalMarkLines(plot, markLines, yLeft, innerW);
  const tooltip = showTooltip ? createTooltip(container, theme, tooltipPresentation) : null;

  drawDualAxesAxes({
    g,
    xScale: x,
    yLeft,
    yRight,
    categories,
    innerW,
    innerH,
    theme,
    valueFormat,
    axisStyle,
    categoryLevelCount: structuralLevelCount,
  });

  if (leftGeom.geometry === "column") {
    renderDualAxesColumnBars({
      plot,
      defs,
      columnData: leftData,
      xField,
      columnYField: leftYField,
      columnSeriesField,
      categories,
      x,
      yRight: yLeft,
      innerH,
      innerW,
      columnOpts: leftColumnOpts,
      colors,
      colorOffset: 0,
      fallbackColor: leftColor,
      theme,
      seriesGradient,
      conditionalRules,
      onPointClick,
      barWidthRatio,
      barRadius,
    });
  } else if (leftGeom.geometry === "line") {
    renderDualAxesLineLayers({
      plot,
      defs,
      data: leftData,
      xField,
      yField: leftYField,
      seriesField: leftLineSeriesField,
      categories,
      x,
      yScale: yLeft,
      colors,
      colorOffset: 0,
      fallbackColor: leftColor,
      smooth: leftSmooth,
      shadowPrefix: "dual-line-left",
      dotClassPrefix: "dual-line-dot-l",
      depthVisual,
      conditionalRules,
      onPointClick,
    });
  }

  if (rightGeom.geometry === "column") {
    renderDualAxesColumnBars({
      plot,
      defs,
      columnData: rightData,
      xField,
      columnYField: rightYField,
      columnSeriesField,
      categories,
      x,
      yRight,
      innerH,
      innerW,
      columnOpts: rightColumnOpts,
      colors,
      colorOffset: 1,
      fallbackColor: rightColor,
      theme,
      seriesGradient,
      conditionalRules,
      onPointClick,
      barWidthRatio,
      barRadius,
    });
  } else if (rightGeom.geometry === "line") {
    renderDualAxesLineLayers({
      plot,
      defs,
      data: rightData,
      xField,
      yField: rightYField,
      seriesField: lineSeriesField,
      categories,
      x,
      yScale: yRight,
      colors,
      colorOffset: 1,
      fallbackColor: rightColor,
      smooth: rightSmooth,
      shadowPrefix: dualLine ? "dual-line-right" : "dual-line-1",
      dotClassPrefix: "dual-line-dot-r",
      depthVisual,
      conditionalRules,
      onPointClick,
    });
  }

  if (showLabel) {
    if (leftGeom.geometry === "line") {
      const leftLabelTotal = sumCartesianLabelTotal(leftSet.points);
      plot
        .selectAll("text.dual-line-label-left")
        .data(leftSet.points)
        .join("text")
        .attr("class", "dual-line-label-left")
        .attr("x", (d) => x(String(d.__category__)) ?? 0)
        .attr("y", (d) => yLeft(Number(d.__value__)) - 8)
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${labelFontSize}px`)
        .text((d) =>
          formatCartesianDatumLabel(d, {
            hasMultiSeries: Boolean(leftLineSeriesField),
            labelContent,
            valueFormat,
            total: leftLabelTotal,
          }),
        );
    } else if (leftGeom.geometry === "column") {
      const colPoints = normalizeCartesianData(leftData, xField, leftYField, columnSeriesField);
      const colLabelTotal = sumCartesianLabelTotal(colPoints);
      const hasColSeries = Boolean(columnSeriesField);
      plot
        .selectAll("text.dual-col-label-left")
        .data(colPoints)
        .join("text")
        .attr("class", "dual-col-label-left")
        .attr("x", (d) => x(String(d.__category__)) ?? 0)
        .attr("y", (d) => yLeft(Number(d.__value__)) - 4)
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${labelFontSize}px`)
        .text((d) =>
          formatCartesianDatumLabel(d, {
            hasMultiSeries: hasColSeries,
            labelContent,
            valueFormat,
            total: colLabelTotal,
          }),
        );
    }

    if (rightGeom.geometry === "line") {
      const rightLabelTotal = sumCartesianLabelTotal(rightSet.points);
      plot
        .selectAll("text.dual-line-label-right")
        .data(rightSet.points)
        .join("text")
        .attr("class", "dual-line-label-right")
        .attr("x", (d) => x(String(d.__category__)) ?? 0)
        .attr("y", (d) => yRight(Number(d.__value__)) - 8)
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${labelFontSize}px`)
        .text((d) =>
          formatCartesianDatumLabel(d, {
            hasMultiSeries: Boolean(lineSeriesField),
            labelContent,
            valueFormat,
            total: rightLabelTotal,
          }),
        );
    } else if (rightGeom.geometry === "column") {
      const colPoints = normalizeCartesianData(rightData, xField, rightYField, columnSeriesField);
      const colLabelTotal = sumCartesianLabelTotal(colPoints);
      const hasColSeries = Boolean(columnSeriesField);
      plot
        .selectAll("text.dual-col-label")
        .data(colPoints)
        .join("text")
        .attr("class", "dual-col-label")
        .attr("x", (d) => x(String(d.__category__)) ?? 0)
        .attr("y", (d) => yRight(Number(d.__value__)) - 4)
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${labelFontSize}px`)
        .text((d) =>
          formatCartesianDatumLabel(d, {
            hasMultiSeries: hasColSeries,
            labelContent,
            valueFormat,
            total: colLabelTotal,
          }),
        );
    }
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
        const [mx] = d3.pointer(event);
        let best = categories[0] ?? "";
        let bestDist = Infinity;
        for (const cat of categories) {
          const px = x(cat) ?? 0;
          const dist = Math.abs(px - mx);
          if (dist < bestDist) {
            bestDist = dist;
            best = cat;
          }
        }
        const rows: Array<{ name: string; color: string; value: number }> = [];

        if (leftGeom.geometry === "line") {
          rows.push(
            ...lineTooltipRows(
              leftData,
              xField,
              leftYField,
              leftLineSeriesField,
              best,
              colors,
              leftLabel,
              leftColor,
              0,
            ),
          );
        } else if (leftGeom.geometry === "column") {
          rows.push(
            ...columnTooltipRows(
              leftData,
              xField,
              leftYField,
              columnSeriesField,
              best,
              colors,
              leftColor,
              0,
            ).map((r) => ({ ...r, name: r.name === "柱" ? leftLabel : r.name })),
          );
        }

        if (rightGeom.geometry === "line") {
          rows.push(
            ...lineTooltipRows(
              rightData,
              xField,
              rightYField,
              lineSeriesField,
              best,
              colors,
              rightLabel,
              rightColor,
              1,
            ),
          );
        } else if (rightGeom.geometry === "column") {
          rows.push(
            ...columnTooltipRows(
              rightData,
              xField,
              rightYField,
              columnSeriesField,
              best,
              colors,
              rightColor,
              1,
            ).map((r) => ({ ...r, name: r.name === "柱" ? rightLabel : r.name })),
          );
        }

        tooltip?.style("opacity", "1").html(tooltipHtml(best, rows, valueFormat));
        const rect = container.getBoundingClientRect();
        tooltip
          ?.style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => tooltip?.style("opacity", "0"));
  }

  renderConfiguredInlineLegend(root, showLegend, legendItems, {
    width,
    height,
    margin,
    theme,
    layout: legendLayout,
    fontSize: legendLayout?.fontSize,
  });

  const detachZoom = dataZoom
    ? attachCartesianDataZoom({
        host: container,
        plotRoot: g,
        innerW,
        innerH,
        marginBottom: margin.bottom,
        categories: allCategories,
        sparkline: cartesianSparkline(allCategories, [...leftSet.points, ...rightSet.points]),
        theme,
        redraw: () => renderD3DualAxesChart(container, config),
      })
    : () => undefined;

  return () => {
    detachZoom();
    container.replaceChildren();
  };
}
