import * as d3 from "d3";
import { prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import { resolveEffectiveDepth, depthExtrudePx, shadeColor } from "@/components/charts/engine/d3/core/depthEngine";
import { applyScalableChartSvgDisplay } from "@/components/charts/engine/d3/core/sceneGraph";
import { radialMargin } from "@/components/charts/engine/d3/core/margin";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3RenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabel } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveGaugeValuePercent } from "@/lib/applyChartDeStyleBlocks";
import { MIN_CHART_PRESENTATION_FONT_SIZE } from "@/components/charts/engine/d3/core/chartPresentationScale";
import { DEFAULT_GAUGE_MAX, DEFAULT_GAUGE_MIN } from "@/lib/chartDeStyleBlocks";

function gaugeAnglesFromOptions(options: Record<string, unknown>) {
  const startDeg = Number(options.__gaugeStartAngleDeg ?? -135);
  const endDeg = Number(options.__gaugeEndAngleDeg ?? 135);
  return {
    start: (startDeg * Math.PI) / 180,
    end: (endDeg * Math.PI) / 180,
  };
}

function polar(angle: number, r: number): [number, number] {
  return [Math.cos(angle - Math.PI / 2) * r, Math.sin(angle - Math.PI / 2) * r];
}

function gaugeArcPath(
  innerR: number,
  outerR: number,
  start: number,
  end: number,
  corner = 0,
): string {
  const arc = d3
    .arc<d3.DefaultArcObject>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(start)
    .endAngle(end)
    .cornerRadius(corner);
  return arc({ innerRadius: innerR, outerRadius: outerR, startAngle: start, endAngle: end }) ?? "";
}

function pointerPolygon(angle: number, length: number, baseHalf: number): string {
  const [tx, ty] = polar(angle, length);
  const [lx, ly] = polar(angle + Math.PI / 2, baseHalf);
  const [rx, ry] = polar(angle - Math.PI / 2, baseHalf);
  const [bx, by] = polar(angle + Math.PI, baseHalf * 0.55);
  return `M ${tx} ${ty} L ${lx} ${ly} L ${bx} ${by} L ${rx} ${ry} Z`;
}

export function renderD3GaugeChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();

  const {
    width,
    height,
    colors,
    theme,
    showLabel,
    showTooltip,
    labelColor,
    labelFontSize,
    tooltipPresentation,
    valueFormat,
    labelContent,
    options,
  } = config;
  const rawValue = Number(options.rawValue ?? NaN);
  const percent = resolveGaugeValuePercent(options, rawValue, Math.min(1, Math.max(0, Number(options.percent ?? 0))));
  const usePercent = !Number.isFinite(rawValue);
  const gaugeMin = Number(options.__gaugeMin ?? DEFAULT_GAUGE_MIN);
  const gaugeMax = Number(options.__gaugeMax ?? DEFAULT_GAUGE_MAX);
  const splitNumber = Math.max(2, Math.min(20, Math.round(Number(options.__gaugeSplitNumber ?? 5))));

  if (width <= 0 || height <= 0) return () => undefined;

  const margin = radialMargin(false);
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const cx = margin.left + innerW / 2;
  const cy = margin.top + innerH * 0.56;
  const radius = Math.min(innerW, innerH) * 0.4;
  const innerR = radius * 0.78;
  const outerR = radius;
  const corner = Math.min(6, (outerR - innerR) * 0.45);
  const { start: START_ANGLE, end: END_ANGLE } = gaugeAnglesFromOptions(options);
  const span = END_ANGLE - START_ANGLE;
  const rangeColors = (options.range as { color?: string[] } | undefined)?.color;
  const activeColor = rangeColors?.[0] ?? colors[0] ?? "#465fff";
  const trackColor = rangeColors?.[1] ?? theme.axisLine;
  const pointerColor = String(options.__gaugePointerColor || "").trim() || shadeColor(activeColor, "shadow");
  const depthLevel = resolveEffectiveDepth(config.depthVisual);
  const depthOn = depthLevel !== "off";
  const depthOffset = depthOn ? depthExtrudePx(depthLevel) : 0;
  const valueEnd = START_ANGLE + span * percent;
  const uid = `g${Math.random().toString(36).slice(2, 8)}`;

  const root = d3
    .select(container)
    .append("svg")
    .attr("class", "vs-chart-svg")
    .attr("data-vs-embedded-fit", "viewport")
    .attr("role", "img")
    .attr("data-testid", "d3-gauge-chart");
  applyScalableChartSvgDisplay(root, width, height);
  root.style("overflow", "hidden");

  const defs = root.append("defs");
  const grad = defs
    .append("linearGradient")
    .attr("id", `${uid}-fill`)
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "0%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", shadeColor(activeColor, "top"));
  grad.append("stop").attr("offset", "100%").attr("stop-color", activeColor);

  const g = root.append("g").attr("transform", `translate(${cx},${cy})`);

  const trackArc = gaugeArcPath(innerR, outerR, START_ANGLE, END_ANGLE, corner);
  const valueArc = gaugeArcPath(innerR, outerR, START_ANGLE, valueEnd, corner);

  g.append("path").attr("d", trackArc).attr("fill", trackColor).attr("opacity", 0.92);
  if (depthOn) {
    g
      .append("path")
      .attr("d", trackArc)
      .attr("fill", shadeColor(trackColor, "top"))
      .attr("opacity", 0.4)
      .attr("transform", `translate(0, ${depthOffset * 0.55})`);
  }

  let valueShadowPath: d3.Selection<SVGPathElement, unknown, null, undefined> | null = null;
  if (depthOn) {
    valueShadowPath = g
      .append("path")
      .attr("fill", shadeColor(activeColor, "shadow"))
      .attr("opacity", depthLevel === "enhanced" ? 0.62 : 0.48)
      .attr("transform", `translate(0, ${depthOffset * 0.65})`)
      .attr("d", valueArc);
  }
  const valuePath = g
    .append("path")
    .attr("fill", `url(#${uid}-fill)`)
    .attr("opacity", 0.98)
    .attr("d", valueArc);

  if (!prefersReducedMotion()) {
    const interp = d3.interpolateNumber(START_ANGLE, valueEnd);
    const collapsed = gaugeArcPath(innerR, outerR, START_ANGLE, START_ANGLE, corner);
    const tween = () => (t: number) => gaugeArcPath(innerR, outerR, START_ANGLE, interp(t), corner);
    valuePath.attr("d", collapsed).transition().duration(720).ease(d3.easeCubicOut).attrTween("d", tween);
    valueShadowPath
      ?.attr("d", collapsed)
      .transition()
      .duration(720)
      .ease(d3.easeCubicOut)
      .attrTween("d", tween);
  }

  const tickG = g.append("g").attr("class", "gauge-ticks");
  const tickOuter = outerR + 2;
  for (let i = 0; i <= splitNumber; i++) {
    const t = i / splitNumber;
    const ang = START_ANGLE + span * t;
    const major = i === 0 || i === splitNumber || i % Math.ceil(splitNumber / 5) === 0;
    const len = major ? 10 : 5;
    const [x1, y1] = polar(ang, tickOuter);
    const [x2, y2] = polar(ang, tickOuter + len);
    tickG
      .append("line")
      .attr("x1", x1)
      .attr("y1", y1)
      .attr("x2", x2)
      .attr("y2", y2)
      .attr("stroke", major ? theme.axisLabel : theme.axisLine)
      .attr("stroke-width", major ? 1.5 : 1)
      .attr("stroke-linecap", "round")
      .attr("opacity", major ? 0.75 : 0.55);

    if (showLabel && major) {
      const tickVal = gaugeMin + (gaugeMax - gaugeMin) * t;
      const [lx, ly] = polar(ang, tickOuter + len + 12);
      tickG
        .append("text")
        .attr("x", lx)
        .attr("y", ly)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", resolveLabelFill(theme, labelColor))
        .style("font-size", `${Math.max(MIN_CHART_PRESENTATION_FONT_SIZE, Math.round(labelFontSize * 0.85))}px`)
        .style("font-weight", "500")
        .attr("opacity", 0.8)
        .text(formatChartValue(tickVal, valueFormat));
    }
  }

  const pointerLen = innerR * 0.88;
  const pointer = g
    .append("path")
    .attr("d", pointerPolygon(valueEnd, pointerLen, Math.max(4, radius * 0.045)))
    .attr("fill", pointerColor)
    .attr("opacity", 0.95);

  if (!prefersReducedMotion()) {
    const from = START_ANGLE;
    const to = valueEnd;
    const half = Math.max(4, radius * 0.045);
    pointer
      .attr("d", pointerPolygon(from, pointerLen, half))
      .transition()
      .duration(720)
      .ease(d3.easeCubicOut)
      .attrTween("d", () => (t) => pointerPolygon(from + (to - from) * t, pointerLen, half));
  }

  g.append("circle").attr("r", radius * 0.11).attr("fill", theme.tooltipBg).attr("stroke", trackColor).attr("stroke-width", 1.5);
  g.append("circle").attr("r", radius * 0.07).attr("fill", activeColor).attr("opacity", 0.18);
  g.append("circle").attr("r", radius * 0.045).attr("fill", pointerColor);

  const dimensionLabel = String(options.dimensionLabel ?? "").trim();
  const centerText = formatSimpleDataLabel(
    dimensionLabel,
    usePercent ? percent : rawValue,
    usePercent ? 1 : gaugeMax,
    labelContent,
    valueFormat,
    usePercent,
  );

  // 仪表中心读数是主信息：始终展示（标签开关仅控制刻度数字）
  if (centerText) {
    g.append("text")
      .attr("y", radius * 0.42)
      .attr("text-anchor", "middle")
      .attr("fill", resolveLabelFill(theme, labelColor))
      .style("font-size", `${Math.round(labelFontSize * 2)}px`)
      .style("font-weight", "700")
      .style("letter-spacing", "-0.02em")
      .text(centerText);
  }

  if (showTooltip) {
    const tip = createTooltip(container, theme, tooltipPresentation);
    root
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mousemove", (event) => {
        tip.style("opacity", "1").text(centerText);
        const rect = container.getBoundingClientRect();
        tip
          .style("left", `${event.clientX - rect.left + 10}px`)
          .style("top", `${event.clientY - rect.top - 28}px`);
      })
      .on("mouseleave", () => tip.style("opacity", "0"));
  }

  return () => container.replaceChildren();
}
