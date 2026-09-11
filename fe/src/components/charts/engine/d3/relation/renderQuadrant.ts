import * as d3 from "d3";
import { resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import { renderD3ScatterChart } from "@/components/charts/engine/d3/relation/renderScatter";
import type { D3RenderConfig } from "@/components/charts/engine/d3/types";
import { readCompareStyleFromPlanOptions } from "@/lib/applyChartDeStyleBlocks";

/** 象限图：散点 + 均值十字分割线 */
export function renderD3QuadrantChart(container: HTMLElement, config: D3RenderConfig): () => void {
  const cleanupScatter = renderD3ScatterChart(container, config);
  const svg = container.querySelector("svg");
  if (!svg) return cleanupScatter;

  const data = (config.options.data as Array<Record<string, number>>) ?? [];
  const xField = String(config.options.xField ?? "x");
  const yField = String(config.options.yField ?? "y");
  if (data.length === 0) return cleanupScatter;

  const xMean = d3.mean(data, (d) => Number(d[xField])) ?? 0;
  const yMean = d3.mean(data, (d) => Number(d[yField])) ?? 0;

  const margin = { left: 48, top: 16 };
  const width = Number(svg.getAttribute("width")) || 0;
  const height = Number(svg.getAttribute("height")) || 0;
  const innerW = Math.max(0, width - margin.left - 16);
  const innerH = Math.max(0, height - margin.top - 24);

  const xExtent = d3.extent(data, (d) => Number(d[xField])) as [number, number];
  const yExtent = d3.extent(data, (d) => Number(d[yField])) as [number, number];
  const xScale = d3.scaleLinear().domain(xExtent).nice().range([0, innerW]);
  const yScale = d3.scaleLinear().domain(yExtent).nice().range([innerH, 0]);

  const plot = d3.select(svg).select<SVGGElement>("g");
  if (plot.empty()) return cleanupScatter;

  const quadrantStyle = readCompareStyleFromPlanOptions(config.options);
  const lineColor = quadrantStyle.quadrantLineColor ?? "#64748b";
  const lineWidth = quadrantStyle.quadrantLineWidth ?? 1.5;
  const showRegionBg = quadrantStyle.quadrantShowRegionBg !== false;
  const regionOpacity = quadrantStyle.quadrantRegionOpacity ?? 0.1;

  const depthLevel = resolveEffectiveDepth(config.depthVisual);
  if (depthLevel !== "off" && showRegionBg) {
    const xMid = xScale(xMean);
    const yMid = yScale(yMean);
    const quadrants = [
      { key: "tl", x: margin.left, y: margin.top, w: xMid, h: yMid, cx: 0, cy: 0 },
      { key: "tr", x: margin.left + xMid, y: margin.top, w: innerW - xMid, h: yMid, cx: 1, cy: 0 },
      { key: "bl", x: margin.left, y: margin.top + yMid, w: xMid, h: innerH - yMid, cx: 0, cy: 1 },
      {
        key: "br",
        x: margin.left + xMid,
        y: margin.top + yMid,
        w: innerW - xMid,
        h: innerH - yMid,
        cx: 1,
        cy: 1,
      },
    ];
    const defs = d3.select(svg).select("defs").empty() ? d3.select(svg).append("defs") : d3.select(svg).select("defs");
    const bg = plot.insert("g", ":first-child").attr("class", "quadrant-depth-bg");
    for (const q of quadrants) {
      if (q.w <= 0 || q.h <= 0) continue;
      const gradId = `vs-quadrant-radial-${q.key}`;
      const grad = defs
        .append("radialGradient")
        .attr("id", gradId)
        .attr("cx", q.cx === 0 ? "0%" : "100%")
        .attr("cy", q.cy === 0 ? "0%" : "100%")
        .attr("r", "100%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", "#465fff").attr("stop-opacity", regionOpacity);
      grad.append("stop").attr("offset", "100%").attr("stop-color", "#465fff").attr("stop-opacity", 0);
      bg.append("rect")
        .attr("x", q.x)
        .attr("y", q.y)
        .attr("width", q.w)
        .attr("height", q.h)
        .attr("fill", `url(#${gradId})`)
        .attr("pointer-events", "none");
    }
  }

  plot
    .append("line")
    .attr("class", "quadrant-median-x")
    .attr("x1", margin.left + xScale(xMean))
    .attr("x2", margin.left + xScale(xMean))
    .attr("y1", margin.top)
    .attr("y2", margin.top + innerH)
    .attr("stroke", lineColor)
    .attr("stroke-width", lineWidth)
    .attr("stroke-dasharray", "4 3");

  plot
    .append("line")
    .attr("class", "quadrant-median-y")
    .attr("x1", margin.left)
    .attr("x2", margin.left + innerW)
    .attr("y1", margin.top + yScale(yMean))
    .attr("y2", margin.top + yScale(yMean))
    .attr("stroke", lineColor)
    .attr("stroke-width", lineWidth)
    .attr("stroke-dasharray", "4 3");

  return () => {
    cleanupScatter();
  };
}
