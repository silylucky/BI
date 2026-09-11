import * as d3 from "d3";
import type { ChartMarkLine } from "@/lib/chartDeFeatures";

export function drawHorizontalMarkLines(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  markLines: ChartMarkLine[] | undefined,
  yScale: d3.ScaleLinear<number, number>,
  innerW: number,
): void {
  const layer = plot.append("g").attr("class", "mark-lines");
  for (const line of (markLines ?? []).filter((m) => m.enabled && Number.isFinite(m.value))) {
    const y = yScale(line.value);
    layer
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", line.color ?? "#465fff")
      .attr("stroke-opacity", 0.85)
      .attr("stroke-dasharray", line.lineStyle === "solid" ? undefined : "5 4");
  }
}

export function drawVerticalMarkLines(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  markLines: ChartMarkLine[] | undefined,
  xScale: d3.ScaleLinear<number, number>,
  innerH: number,
): void {
  const layer = plot.append("g").attr("class", "mark-lines");
  for (const line of (markLines ?? []).filter((m) => m.enabled && Number.isFinite(m.value))) {
    const x = xScale(line.value);
    layer
      .append("line")
      .attr("x1", x)
      .attr("x2", x)
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", line.color ?? "#465fff")
      .attr("stroke-opacity", 0.85)
      .attr("stroke-dasharray", line.lineStyle === "solid" ? undefined : "5 4");
  }
}

export function drawScatterMarkLines(
  plot: d3.Selection<SVGGElement, unknown, null, undefined>,
  markLines: ChartMarkLine[] | undefined,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  innerW: number,
  innerH: number,
): void {
  const layer = plot.append("g").attr("class", "mark-lines");
  for (const line of (markLines ?? []).filter((m) => m.enabled && Number.isFinite(m.value))) {
    const y = yScale(line.value);
    layer
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", line.color ?? "#94a3b8")
      .attr("stroke-dasharray", "6 4")
      .attr("stroke-opacity", 0.9);
    const x = xScale(line.value);
    if (Number.isFinite(x) && x >= 0 && x <= innerW) {
      layer
        .append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", line.color ?? "#94a3b8")
        .attr("stroke-dasharray", "6 4")
        .attr("stroke-opacity", 0.9);
    }
  }
}
