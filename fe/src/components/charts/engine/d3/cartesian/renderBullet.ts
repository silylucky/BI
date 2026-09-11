import * as d3 from "d3";
import { appendChartSvg, drawCartesianHorizontalBandAxes, resolveHorizontalCategoryCartesianLayout } from "@/components/charts/engine/d3/core/sceneGraph";
import { paintHorizontalBar } from "@/components/charts/engine/d3/core/depthEngine";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3BulletRenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { resolveBarBandPadding } from "@/lib/applyChartDeStyleBlocks";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";

const BAR_RX = 3;

export function renderD3BulletChart(container: HTMLElement, config: D3BulletRenderConfig): () => void {
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
    targetLineWidth = 2,
    rangeOpacity = 0.55,
    conditionalRules = [],
  } = config;

  const barRx = barRadius ?? BAR_RX;
  const categories = data.map((d) => d.type);
  const maxRange = d3.max(data, (d) => d.rangeMax) ?? 1;
  const { margin, innerW, innerH } = resolveHorizontalCategoryCartesianLayout(width, height, categories, {
    axisStyle,
  });
  const measureColor = colors[0] ?? "#465fff";
  const zoneColors = [colors[2] ?? "#e4e7ec", colors[3] ?? "#d0d5dd", colors[4] ?? "#98a2b3"];

  const y = d3.scaleBand<string>().domain(categories).range([0, innerH]).padding(resolveBarBandPadding(barWidthRatio));
  const x = d3.scaleLinear().domain([0, maxRange]).nice().range([0, innerW]);
  const barH = Math.max(8, y.bandwidth() * 0.55);
  const labelTotal = d3.sum(data, (d) => d.actual);

  const root = appendChartSvg(container, width, height);
  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const plot = g.append("g");
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  drawCartesianHorizontalBandAxes({ g, xScale: x, yScale: y, innerW, innerH, theme, valueFormat, axisStyle });

  for (const d of data) {
    const y0 = (y(d.type) ?? 0) + (y.bandwidth() - barH) / 2;
    const zones = [
      { end: d.rangeMax * 0.66, color: zoneColors[0] },
      { end: d.rangeMax * 0.85, color: zoneColors[1] },
      { end: d.rangeMax, color: zoneColors[2] },
    ];
    let start = 0;
    for (const zone of zones) {
      plot
        .append("rect")
        .attr("x", x(start))
        .attr("y", y0)
        .attr("width", Math.max(0, x(zone.end) - x(start)))
        .attr("height", barH)
        .attr("fill", zone.color)
        .attr("opacity", rangeOpacity);
      start = zone.end;
    }

    const measure = plot
      .append("g")
      .attr("class", "bullet-measure")
      .attr("transform", `translate(0,${y0})`)
      .attr("cursor", onPointClick ? "pointer" : "default")
      .each(function () {
        const cell = d3.select(this);
        const w = x(d.actual);
        const measureFill =
          conditionalRules.length > 0
            ? resolveDatumColor(d.actual, measureColor, conditionalRules)
            : measureColor;
        paintHorizontalBar({ plot: cell, x: 0, y: 0, width: w, height: barH, color: measureFill, rx: barRx });
      })
      .on("click", () => onPointClick?.(d));

    if (showTooltip) {
      measure
        .on("mouseenter", () => {
          tooltip
            ?.style("opacity", "1")
            .html(
              [
                `<div style="font-weight:600;margin-bottom:2px">${d.type}</div>`,
                `<div>实际 <strong>${formatChartValue(d.actual, valueFormat)}</strong></div>`,
                `<div>目标 <strong>${formatChartValue(d.target, valueFormat)}</strong></div>`,
              ].join(""),
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

    plot
      .append("line")
      .attr("x1", x(d.target))
      .attr("x2", x(d.target))
      .attr("y1", y0 - 2)
      .attr("y2", y0 + barH + 2)
      .attr("stroke", theme.axisLabel)
      .attr("stroke-width", targetLineWidth);

    if (showLabel) {
      plot
        .append("text")
        .attr("x", x(d.actual) + 4)
        .attr("y", y0 + barH / 2)
        .attr("dy", "0.32em")
        .attr("fill", theme.axisLabel)
        .style("font-size", `${labelFontSize}px`)
        .text(
          formatSimpleDataLabel(d.type, d.actual, labelTotal, labelContent, valueFormat),
        );
    }
  }

  return () => container.replaceChildren();
}
