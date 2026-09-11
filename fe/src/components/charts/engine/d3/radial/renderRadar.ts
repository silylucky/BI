import * as d3 from "d3";
import { prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import { resolveEffectiveDepth, shadeColor } from "@/components/charts/engine/d3/core/depthEngine";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";
import { createTooltip, tooltipHtml } from "@/components/charts/engine/d3/core/tooltip";
import type { D3Datum, D3RenderConfig } from "@/components/charts/engine/d3/types";
import {
  DEFAULT_RADAR_RADIUS_PERCENT,
  RADAR_RADIUS_PERCENT_MAX,
  RADAR_RADIUS_PERCENT_MIN,
} from "@/lib/chartDeStyleBlocks";
import { applyScalableChartSvgDisplay } from "@/components/charts/engine/d3/core/sceneGraph";
import { computeRadarLayout } from "./radarLayout";
import {
  buildRadarPointLabelText,
  layoutRadarAxisLabelIndices,
  layoutRadarPointLabelKeys,
  radarAxisLabelBboxes,
  radarAxisLabelLayout,
  radarPointLabelOutwardOffset,
} from "./radarLabels";

export function renderD3RadarChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();

  const {
    width,
    height,
    colors,
    theme,
    showLabel,
    showTooltip,
    labelFontSize,
    labelContent,
    valueFormat,
    conditionalRules = [],
    onPointClick,
    options,
  } = config;

  const data = (options.data as D3Datum[]) ?? [];
  const xField = String(options.xField ?? "type");
  const yField = String(options.yField ?? "value");
  const radarShape = String(options.__radarShape ?? "circle");
  const radarAreaOpacity = Number(options.__radarAreaOpacity ?? 0.25);
  const showArea = options.__radarShowArea !== false;
  const showAxisName = options.__radarShowAxisName !== false;
  const showSymbol = options.__radarShowSymbol === true;
  const axisLineColor = String(options.__radarAxisLineColor ?? theme.gridLine);
  const axisLabelColor = String(options.__radarAxisLabelColor ?? theme.axisLabel);
  const axisLineWidth = Number(options.__radarAxisLineWidth ?? 1);
  const splitNumber = Math.max(2, Math.min(10, Number(options.__radarSplitNumber ?? 5)));
  const radarRadiusPercent = Number(options.__radarRadiusPercent ?? DEFAULT_RADAR_RADIUS_PERCENT);

  if (width <= 0 || height <= 0 || data.length === 0) return () => undefined;

  const axisTexts = data.map((row) => String(row[xField] ?? ""));
  const compact = Math.min(width, height) < 320;
  const effectiveRadiusPercent = compact
    ? Math.min(radarRadiusPercent, 52)
    : radarRadiusPercent;
  const layout = computeRadarLayout(width, height, false, effectiveRadiusPercent);
  const { cx, cy, radius, axisLabelGap } = layout;
  const maxValue = d3.max(data, (d) => Number(d[yField] ?? 0)) ?? 1;
  const baseColor = colors[0] ?? "#465fff";
  const depthOn = resolveEffectiveDepth() !== "off";

  const root = d3
    .select(container)
    .append("svg")
    .attr("class", "vs-chart-svg")
    .attr("data-vs-embedded-fit", "viewport")
    .attr("role", "img");
  applyScalableChartSvgDisplay(root, width, height);
  root.style("overflow", "hidden");

  const g = root.append("g").attr("transform", `translate(${cx},${cy})`);
  const angleStep = (Math.PI * 2) / data.length;
  const angles = data.map((_, i) => i * angleStep - Math.PI / 2);
  const labelR = radius + axisLabelGap;

  const axisVisibleIndices = showAxisName
    ? layoutRadarAxisLabelIndices(axisTexts, angles, labelR, labelFontSize)
    : [];
  const axisOccupied = showAxisName
    ? radarAxisLabelBboxes(axisVisibleIndices, axisTexts, angles, labelR, labelFontSize)
    : [];

  for (let level = 1; level <= splitNumber; level += 1) {
    const r = (radius * level) / splitNumber;
    if (radarShape === "circle") {
      g.append("circle")
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", axisLineColor)
        .attr("stroke-width", axisLineWidth)
        .attr("stroke-opacity", 0.85);
    } else {
      const ring = d3.range(data.length).map((i) => {
        const angle = angles[i]!;
        return [Math.cos(angle) * r, Math.sin(angle) * r] as [number, number];
      });
      ring.push(ring[0]!);
      g.append("path")
        .attr("d", d3.line()(ring) ?? "")
        .attr("fill", "none")
        .attr("stroke", axisLineColor)
        .attr("stroke-width", axisLineWidth)
        .attr("stroke-opacity", 0.85);
    }
  }

  data.forEach((row, i) => {
    const angle = angles[i]!;
    g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", Math.cos(angle) * radius)
      .attr("y2", Math.sin(angle) * radius)
      .attr("stroke", axisLineColor)
      .attr("stroke-width", axisLineWidth)
      .attr("stroke-opacity", 0.85);

    if (showAxisName && axisVisibleIndices.includes(i)) {
      const labelLayout = radarAxisLabelLayout(angle, labelR);
      g.append("text")
        .attr("x", labelLayout.x)
        .attr("y", labelLayout.y)
        .attr("text-anchor", labelLayout.anchor)
        .attr("dx", labelLayout.dx)
        .attr("dy", labelLayout.dy)
        .attr("fill", axisLabelColor)
        .style("font-size", `${labelFontSize}px`)
        .text(String(row[xField] ?? ""));
    }
  });

  const points: [number, number][] = data.map((row, i) => {
    const v = Number(row[yField] ?? 0);
    const r = (v / (maxValue || 1)) * radius;
    const angle = angles[i]!;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
  points.push(points[0]!);

  const areaPath = g
    .append("path")
    .attr("fill", baseColor)
    .attr("fill-opacity", showArea ? radarAreaOpacity : 0)
    .attr("stroke", depthOn ? shadeColor(baseColor, "top") : baseColor)
    .attr("stroke-width", depthOn ? 2.5 : 2)
    .attr("stroke-linejoin", "round")
    .style("paint-order", depthOn ? "stroke fill" : null);

  if (!prefersReducedMotion()) {
    areaPath
      .attr("d", d3.line()([points[0]!]) ?? "")
      .transition()
      .duration(680)
      .ease(d3.easeCubicOut)
      .attrTween("d", () => {
        const interp = d3.interpolateArray([points[0]!], points);
        return (t) => d3.line()(interp(t)) ?? "";
      });
  } else {
    areaPath.attr("d", d3.line()(points) ?? "");
  }

  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;

  if (showSymbol) {
    const dots = g
      .selectAll<SVGCircleElement, D3Datum>("circle.radar-dot")
      .data(data)
      .join("circle")
      .attr("class", "radar-dot")
      .attr("r", 4)
      .attr("fill", (d) => resolveDatumColor(Number(d[yField] ?? 0), baseColor, conditionalRules))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", onPointClick ? "pointer" : "default")
      .attr("cx", (_d, i) => points[i]![0])
      .attr("cy", (_d, i) => points[i]![1])
      .on("mouseenter", (_event, d) => {
        if (!tooltip) return;
        const color = resolveDatumColor(Number(d[yField] ?? 0), baseColor, conditionalRules);
        tooltip
          .style("opacity", "1")
          .html(tooltipHtml(String(d[xField] ?? ""), [{ name: "", color, value: d[yField] }], valueFormat));
      })
      .on("mousemove", (event) => {
        if (!tooltip) return;
        const rect = container.getBoundingClientRect();
        tooltip
          .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => tooltip?.style("opacity", "0"))
      .on("click", (_event, d) => onPointClick?.(d));

    if (!prefersReducedMotion()) {
      dots.attr("r", 0).transition().duration(480).delay((_d, i) => i * 40).attr("r", 4);
    }
  } else if (showTooltip || onPointClick) {
    g
      .selectAll<SVGCircleElement, D3Datum>("circle.radar-hit")
      .data(data)
      .join("circle")
      .attr("class", "radar-hit")
      .attr("r", 6)
      .attr("fill", "transparent")
      .attr("cursor", onPointClick ? "pointer" : "default")
      .attr("cx", (_d, i) => points[i]![0])
      .attr("cy", (_d, i) => points[i]![1])
      .on("mouseenter", (_event, d) => {
        if (!tooltip) return;
        const color = resolveDatumColor(Number(d[yField] ?? 0), baseColor, conditionalRules);
        tooltip
          .style("opacity", "1")
          .html(tooltipHtml(String(d[xField] ?? ""), [{ name: "", color, value: d[yField] }], valueFormat));
      })
      .on("mousemove", (event) => {
        if (!tooltip) return;
        const rect = container.getBoundingClientRect();
        tooltip
          .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => tooltip?.style("opacity", "0"))
      .on("click", (_event, d) => onPointClick?.(d));
  }

  if (showLabel) {
    const pointItems = data.map((row, i) => ({
      key: String(i),
      text: buildRadarPointLabelText(
        row as Record<string, unknown>,
        xField,
        yField,
        maxValue,
        labelContent,
        valueFormat,
      ),
      px: points[i]![0],
      py: points[i]![1],
      angle: angles[i]!,
      priority: Number(row[yField] ?? 0),
    }));
    const pointVisible = layoutRadarPointLabelKeys(pointItems, labelFontSize, axisOccupied, radius);

    g
      .selectAll<SVGTextElement, D3Datum>("text.radar-value-label")
      .data(data)
      .join("text")
      .attr("class", "radar-value-label")
      .attr("text-anchor", "middle")
      .attr("fill", axisLabelColor)
      .style("font-size", `${labelFontSize}px`)
      .attr("x", (_d, i) => {
        const cos = Math.cos(angles[i]!);
        const dist = Math.hypot(points[i]![0], points[i]![1]);
        return points[i]![0] + cos * radarPointLabelOutwardOffset(dist, radius, labelFontSize);
      })
      .attr("y", (_d, i) => {
        const sin = Math.sin(angles[i]!);
        const dist = Math.hypot(points[i]![0], points[i]![1]);
        return points[i]![1] + sin * radarPointLabelOutwardOffset(dist, radius, labelFontSize);
      })
      .attr("dy", "-0.55em")
      .style("visibility", (_d, i) => (pointVisible.has(String(i)) ? "visible" : "hidden"))
      .text((_d, i) => pointItems[i]!.text);
  }

  return () => container.replaceChildren();
}
