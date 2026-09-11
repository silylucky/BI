import * as d3 from "d3";
import { appendChartSvg, drawCartesianBandAxes, resolveCategoryCartesianLayout } from "@/components/charts/engine/d3/core/sceneGraph";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import { resolveEffectiveDepth, shadeColor } from "@/components/charts/engine/d3/core/depthEngine";
import type { D3StockRenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";

export function renderD3StockChart(container: HTMLElement, config: D3StockRenderConfig): () => void {
  container.replaceChildren();
  if (config.width <= 0 || config.height <= 0 || config.data.length === 0) return () => undefined;

  const { width, height, data, colors, theme, showTooltip, showLabel, labelFontSize, labelColor, labelContent, valueFormat, onPointClick, axisStyle, bodyWidthRatio = 0.6, conditionalRules = [] } = config;

  const categories = data.map((d) => d.type);
  const yMin = d3.min(data, (d) => d.low) ?? 0;
  const yMax = d3.max(data, (d) => d.high) ?? 0;
  const { margin, innerW, innerH } = resolveCategoryCartesianLayout(width, height, categories, {
    axisStyle,
  });
  const upColor = colors[0] ?? "#12b76a";
  const downColor = colors[1] ?? "#f04438";

  const x = d3.scaleBand<string>().domain(categories).range([0, innerW]).padding(0.3);
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);
  const bodyW = Math.max(4, x.bandwidth() * bodyWidthRatio);
  const depthOn = resolveEffectiveDepth() !== "off";
  const labelTotal = d3.sum(data, (d) => d.close);

  const root = appendChartSvg(container, width, height);
  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const plot = g.append("g");
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  drawCartesianBandAxes({ g, xScale: x, yScale: y, categories, innerW, innerH, theme, valueFormat, axisStyle });

  for (const d of data) {
    const cx = (x(d.type) ?? 0) + x.bandwidth() / 2;
    const up = d.close >= d.open;
    const baseColor = up ? upColor : downColor;
    const color =
      conditionalRules.length > 0
        ? resolveDatumColor(d.close, baseColor, conditionalRules)
        : baseColor;
    const bodyTop = y(Math.max(d.open, d.close));
    const bodyBottom = y(Math.min(d.open, d.close));
    const bodyH = Math.max(1, bodyBottom - bodyTop);

    plot
      .append("line")
      .attr("x1", cx)
      .attr("x2", cx)
      .attr("y1", y(d.high))
      .attr("y2", y(d.low))
      .attr("stroke", color)
      .attr("stroke-width", 1.5);

    const candle = plot
      .append("rect")
      .attr("class", "candle")
      .attr("x", cx - bodyW / 2)
      .attr("y", bodyTop)
      .attr("width", bodyW)
      .attr("height", bodyH)
      .attr("fill", color)
      .attr("cursor", onPointClick ? "pointer" : "default")
      .on("click", () => onPointClick?.(d));

    if (depthOn) {
      candle
        .attr("stroke", shadeColor(color, "top"))
        .attr("stroke-width", 1)
        .style("paint-order", "stroke fill");
    }

    if (showTooltip) {
      candle
        .on("mouseenter", () => {
          tooltip
            ?.style("opacity", "1")
            .html(
              `<div style="font-weight:600;margin-bottom:2px">${d.type}</div>` +
                `<div>开 <strong>${formatChartValue(d.open, valueFormat)}</strong> · 收 <strong>${formatChartValue(d.close, valueFormat)}</strong></div>` +
                `<div>低 <strong>${formatChartValue(d.low, valueFormat)}</strong> · 高 <strong>${formatChartValue(d.high, valueFormat)}</strong></div>`,
            );
        })
        .on("mousemove", (event) => {
          const rect = container.getBoundingClientRect();
          tooltip
            ?.style("left", `${Math.min(event.clientX - rect.left + 12, width - 180)}px`)
            .style("top", `${Math.max(event.clientY - rect.top - 56, 8)}px`);
        })
        .on("mouseleave", () => tooltip?.style("opacity", "0"));
    }

    if (showLabel) {
      plot
        .append("text")
        .attr("x", cx)
        .attr("y", y(d.close) - 6)
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${labelFontSize}px`)
        .style("pointer-events", "none")
        .text(
          formatSimpleDataLabel(d.type, d.close, labelTotal, labelContent, valueFormat),
        );
    }
  }

  return () => container.replaceChildren();
}
