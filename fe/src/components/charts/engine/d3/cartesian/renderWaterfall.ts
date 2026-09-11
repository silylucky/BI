import * as d3 from "d3";
import { drawCartesianBandAxes, appendChartSvg, resolveCategoryCartesianLayout } from "@/components/charts/engine/d3/core/sceneGraph";
import { paintVerticalBar } from "@/components/charts/engine/d3/core/depthEngine";
import { renderConfiguredInlineLegend } from "@/components/charts/engine/d3/core/d3Legend";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3WaterfallDatum, D3WaterfallRenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveBarBandPadding } from "@/lib/applyChartDeStyleBlocks";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";

const BAR_RX = 4;

type WaterfallSegment = D3WaterfallDatum & { start: number; end: number; runningTotal: number };

function buildSegments(data: D3WaterfallDatum[]): WaterfallSegment[] {
  let running = 0;
  return data.map((d) => {
    const start = running;
    const end = running + d.value;
    running = end;
    return { ...d, start, end, runningTotal: end };
  });
}

export function renderD3WaterfallChart(container: HTMLElement, config: D3WaterfallRenderConfig): () => void {
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
    labelColor,
    showLegend = true,
    legendLayout,
    valueFormat,
    labelContent,
    onPointClick,
    barWidthRatio,
    barRadius,
    axisStyle,
    conditionalRules = [],
  } = config;

  const barRx = barRadius ?? BAR_RX;
  const posColor = colors[0] ?? "#465fff";
  const negColor = colors[1] ?? "#f04438";

  const segments = buildSegments(data);
  const categories = segments.map((d) => d.type);
  const yMin = Math.min(0, d3.min(segments, (d) => Math.min(d.start, d.end)) ?? 0);
  const yMax = d3.max(segments, (d) => Math.max(d.start, d.end)) ?? 0;
  const legendItems = [
    { label: "增加", color: posColor },
    { label: "减少", color: negColor },
  ];
  const { margin, innerW, innerH } = resolveCategoryCartesianLayout(width, height, categories, {
    showLegend,
    legendLayout,
    legendItems,
    axisStyle,
  });

  const x = d3.scaleBand<string>().domain(categories).range([0, innerW]).padding(resolveBarBandPadding(barWidthRatio));
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);

  const root = appendChartSvg(container, width, height);
  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const plot = g.append("g");
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  drawCartesianBandAxes({ g, xScale: x, yScale: y, categories, innerW, innerH, theme, valueFormat, axisStyle });

  if (yMin < 0 && yMax > 0) {
    plot
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", theme.gridLine)
      .attr("stroke-dasharray", "4 4");
  }

  plot
    .selectAll("g.waterfall")
    .data(segments)
    .join("g")
    .attr("class", "waterfall")
    .attr("transform", (d) => `translate(${x(d.type) ?? 0},0)`)
    .attr("cursor", onPointClick ? "pointer" : "default")
    .each(function (d) {
      const cell = d3.select(this);
      cell.selectAll("*").remove();
      const yTop = y(Math.max(d.start, d.end));
      const yBottom = y(Math.min(d.start, d.end));
      const h = Math.max(0, yBottom - yTop);
      const baseBarColor = d.value >= 0 ? posColor : negColor;
      const barColor =
        conditionalRules.length > 0
          ? resolveDatumColor(d.value, baseBarColor, conditionalRules)
          : baseBarColor;
      paintVerticalBar({
        plot: cell,
        x: 0,
        y1: yTop,
        height: h,
        width: x.bandwidth(),
        color: barColor,
        rx: barRx,
      });
    })
    .on("click", (_event, d) => onPointClick?.(d));

  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1];
    const cur = segments[i];
    const x0 = (x(prev.type) ?? 0) + x.bandwidth();
    const x1 = x(cur.type) ?? 0;
    const y0 = y(prev.end);
    plot
      .append("line")
      .attr("x1", x0)
      .attr("x2", x1)
      .attr("y1", y0)
      .attr("y2", y0)
      .attr("stroke", theme.gridLine)
      .attr("stroke-dasharray", "3 3");
  }

  if (showTooltip) {
    plot
      .selectAll<SVGGElement, WaterfallSegment>("g.waterfall")
      .on("mouseenter", (_event, d) => {
        tooltip
          ?.style("opacity", "1")
          .html(
            `<div style="font-weight:600;margin-bottom:2px">${d.type}</div>` +
              `<div>增量 <strong>${formatChartValue(d.value, valueFormat)}</strong></div>` +
              `<div>累计 <strong>${formatChartValue(d.runningTotal, valueFormat)}</strong></div>`,
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
    const labelTotal = d3.sum(segments, (d) => Math.abs(d.value));
    plot
      .selectAll("text.wf-label")
      .data(segments)
      .join("text")
      .attr("class", "wf-label")
      .attr("x", (d) => (x(d.type) ?? 0) + x.bandwidth() / 2)
      .attr("y", (d) => y(Math.max(d.start, d.end)) - 4)
      .attr("text-anchor", "middle")
      .attr("fill", resolveLabelFill(theme, labelColor))
      .style("font-size", `${labelFontSize}px`)
      .text((d) =>
        formatSimpleDataLabel(d.type, d.value, labelTotal, labelContent, valueFormat),
      );
  }

  renderConfiguredInlineLegend(
    root,
    showLegend,
    legendItems,
    { width, height, margin, theme, layout: legendLayout, fontSize: legendLayout?.fontSize },
  );

  return () => container.replaceChildren();
}
