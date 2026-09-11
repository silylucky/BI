import * as d3 from "d3";
import { appendChartSvg, drawCartesianHorizontalBandAxes, resolveHorizontalCategoryCartesianLayout } from "@/components/charts/engine/d3/core/sceneGraph";
import { paintHorizontalBar } from "@/components/charts/engine/d3/core/depthEngine";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3BarRangeRenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { resolveBarBandPadding } from "@/lib/applyChartDeStyleBlocks";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";

const BAR_RX = 4;

export function renderD3BarRangeChart(container: HTMLElement, config: D3BarRangeRenderConfig): () => void {
  container.replaceChildren();
  if (config.width <= 0 || config.height <= 0 || config.data.length === 0) return () => undefined;

  const {
    width,
    height,
    data,
    colors,
    theme,
    showTooltip,
    showLabel,
    labelFontSize = 11,
    labelContent,
    valueFormat,
    onPointClick,
    barWidthRatio,
    barRadius,
    axisStyle,
    conditionalRules = [],
  } = config;

  const barRx = barRadius ?? BAR_RX;
  const categories = data.map((d) => d.type);
  const maxVal = d3.max(data, (d) => Math.max(d.low, d.high)) ?? 0;
  const minVal = d3.min(data, (d) => Math.min(d.low, d.high)) ?? 0;
  const { margin, innerW, innerH } = resolveHorizontalCategoryCartesianLayout(width, height, categories, {
    axisStyle,
  });
  const rangeColor = colors[0] ?? "#465fff";

  const y = d3.scaleBand<string>().domain(categories).range([0, innerH]).padding(resolveBarBandPadding(barWidthRatio));
  const x = d3.scaleLinear().domain([Math.min(0, minVal), maxVal]).nice().range([0, innerW]);

  const root = appendChartSvg(container, width, height);
  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const plot = g.append("g");
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  drawCartesianHorizontalBandAxes({ g, xScale: x, yScale: y, innerW, innerH, theme, valueFormat, axisStyle });

  plot
    .selectAll("g.range-bar")
    .data(data)
    .join("g")
    .attr("class", "range-bar")
    .attr("transform", (d) => `translate(0,${y(d.type) ?? 0})`)
    .attr("cursor", onPointClick ? "pointer" : "default")
    .each(function (d) {
      const cell = d3.select(this);
      cell.selectAll("*").remove();
      const x0 = x(Math.min(d.low, d.high));
      const w = Math.max(0, Math.abs(x(d.high) - x(d.low)));
      const barColor =
        conditionalRules.length > 0
          ? resolveDatumColor(d.high, rangeColor, conditionalRules)
          : rangeColor;
      paintHorizontalBar({ plot: cell, x: x0, y: 0, width: w, height: y.bandwidth(), color: barColor, rx: barRx });
      cell.attr("opacity", 0.85);
    })
    .on("click", (_e, d) => onPointClick?.(d));

  if (showTooltip) {
    plot
      .selectAll<SVGGElement, (typeof data)[number]>("g.range-bar")
      .on("mouseenter", (_e, d) => {
        tooltip
          ?.style("opacity", "1")
          .html(
            `<div style="font-weight:600;margin-bottom:2px">${d.type}</div>` +
              `<div>下限 <strong>${formatChartValue(d.low, valueFormat)}</strong></div>` +
              `<div>上限 <strong>${formatChartValue(d.high, valueFormat)}</strong></div>`,
          );
      })
      .on("mousemove", (event) => {
        const rect = container.getBoundingClientRect();
        tooltip
          ?.style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => tooltip?.style("opacity", "0"));
  }

  if (showLabel) {
    const labelTotal = d3.sum(data, (d) => Math.max(d.low, d.high));
    plot
      .selectAll("text.range-label")
      .data(data)
      .join("text")
      .attr("class", "range-label")
      .attr("x", (d) => x(Math.max(d.low, d.high)) + 4)
      .attr("y", (d) => (y(d.type) ?? 0) + y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("fill", theme.axisLabel)
      .style("font-size", `${labelFontSize}px`)
      .text((d) =>
        formatSimpleDataLabel(d.type, d.high, labelTotal, labelContent, valueFormat),
      );
  }

  return () => container.replaceChildren();
}
