import * as d3 from "d3";
import { appendChartSvg, drawCartesianHorizontalBandAxes, resolveHorizontalCategoryCartesianLayout } from "@/components/charts/engine/d3/core/sceneGraph";
import { paintHorizontalBar } from "@/components/charts/engine/d3/core/depthEngine";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3ProgressBarRenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { resolveBarBandPadding } from "@/lib/applyChartDeStyleBlocks";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";

const BAR_RX = 6;

export function renderD3ProgressBarChart(
  container: HTMLElement,
  config: D3ProgressBarRenderConfig,
): () => void {
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
    trackOpacity = 0.35,
    conditionalRules = [],
  } = config;

  const barRx = barRadius ?? BAR_RX;
  const categories = data.map((d) => d.type);
  const { margin, innerW, innerH } = resolveHorizontalCategoryCartesianLayout(width, height, categories, {
    axisStyle,
  });
  const fillColor = colors[0] ?? "#465fff";
  const trackColor = theme.gridLine;

  const y = d3.scaleBand<string>().domain(categories).range([0, innerH]).padding(resolveBarBandPadding(barWidthRatio));
  const x = d3.scaleLinear().domain([0, 1]).range([0, innerW]);

  const root = appendChartSvg(container, width, height);
  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const plot = g.append("g");
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  drawCartesianHorizontalBandAxes({
    g,
    xScale: x,
    yScale: y,
    innerW,
    innerH,
    theme,
    valueFormat,
    axisStyle,
    xTickFormat: (d) => `${Math.round(Number(d) * 100)}%`,
  });

  plot
    .selectAll("rect.track")
    .data(data)
    .join("rect")
    .attr("class", "track")
    .attr("x", 0)
    .attr("y", (d) => y(d.type) ?? 0)
    .attr("width", innerW)
    .attr("height", y.bandwidth())
    .attr("rx", barRx)
    .attr("fill", trackColor)
    .attr("opacity", trackOpacity);

  plot
    .selectAll("g.progress")
    .data(data)
    .join("g")
    .attr("class", "progress")
    .attr("transform", (d) => `translate(0,${y(d.type) ?? 0})`)
    .attr("cursor", onPointClick ? "pointer" : "default")
    .each(function (d) {
      const cell = d3.select(this);
      cell.selectAll("*").remove();
      const ratio = d.max > 0 ? d.value / d.max : 0;
      const w = x(Math.min(1, Math.max(0, ratio)));
      const barColor =
        conditionalRules.length > 0
          ? resolveDatumColor(d.value, fillColor, conditionalRules)
          : fillColor;
      paintHorizontalBar({ plot: cell, x: 0, y: 0, width: w, height: y.bandwidth(), color: barColor, rx: barRx });
    })
    .on("click", (_e, d) => onPointClick?.(d));

  if (showTooltip) {
    plot
      .selectAll<SVGGElement, (typeof data)[number]>("g.progress")
      .on("mouseenter", (_e, d) => {
        const pct = d.max > 0 ? (d.value / d.max) * 100 : 0;
        tooltip
          ?.style("opacity", "1")
          .html(
            `<div style="font-weight:600;margin-bottom:2px">${d.type}</div>` +
              `<div>进度 <strong>${pct.toFixed(1)}%</strong></div>` +
              `<div>数值 <strong>${formatChartValue(d.value, valueFormat)}</strong> / ${formatChartValue(d.max, valueFormat)}</div>`,
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
    plot
      .selectAll("text.progress-label")
      .data(data)
      .join("text")
      .attr("class", "progress-label")
      .attr("x", (d) => x(d.max > 0 ? d.value / d.max : 0) + 6)
      .attr("y", (d) => (y(d.type) ?? 0) + y.bandwidth() / 2)
      .attr("dy", "0.32em")
      .attr("fill", theme.axisLabel)
      .style("font-size", `${labelFontSize}px`)
      .text((d) =>
        formatSimpleDataLabel(d.type, d.value, d.max, labelContent, valueFormat),
      );
  }

  return () => container.replaceChildren();
}
