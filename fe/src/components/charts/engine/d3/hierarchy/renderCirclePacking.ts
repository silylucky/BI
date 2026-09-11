import * as d3 from "d3";
import { resolveEffectiveDepth, type DepthVisualLevel } from "@/components/charts/engine/d3/core/depthEngine";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3Datum, D3RenderConfig } from "@/components/charts/engine/d3/types";
import { formatSimpleDataLabelLines } from "@/components/charts/engine/d3/core/cartesianDataLabel";
import { setMultilineSvgLabel } from "@/components/charts/engine/d3/core/multilineLabel";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import { formatChartValue } from "@/lib/chartValueFormat";
import { resolveDatumColor } from "@/components/charts/engine/d3/core/series";
import {
  blurPackNode,
  createPackPhysicsNodes,
  createPackPhysicsSimulation,
  enforcePackBounds,
  fitPackLayoutToPlot,
  focusPackNode,
  isPackMotionActive,
  normalizePackDt,
  packNodeRadius,
  pickPackNodeAt,
  resolvePackEdgeInset,
  resolveScaledPackPlotCircle,
  stepPackMotionFrame,
  type PackPhysicsNode,
} from "@/components/charts/engine/d3/hierarchy/circlePackingPhysics";

type PackDatum = { name: string; value: number };
type TreeNode = { name: string; value?: number; children?: TreeNode[] };

const PACK_PLOT_PAD = 4;
const PACK_LAYOUT_PADDING_DEFAULT = 0;
const PACK_LABEL_MIN_RADIUS_DEFAULT = 10;

function resolveEffectivePackLabelMinRadius(
  nodes: PackPhysicsNode[],
  configured: number,
  labelFontSize: number,
): number {
  if (nodes.length === 0) return configured;
  const radii = nodes.map((n) => n.baseR);
  const avgR = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const adaptive = Math.max(labelFontSize * 0.75, avgR * 0.72);
  return Math.min(configured, adaptive);
}

function resolvePackNodeLabelFontSize(radius: number, labelFontSize: number): number {
  return Math.min(labelFontSize + 3, Math.max(labelFontSize, radius / 3.2));
}

function truncatePackLabelLine(text: string, diameter: number, fontSize: number): string {
  const maxChars = Math.max(2, Math.floor((diameter * 0.82) / (fontSize * 0.52)));
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return maxChars <= 2 ? trimmed.slice(0, maxChars) : `${trimmed.slice(0, maxChars - 1)}…`;
}

function positionTooltip(
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  event: MouseEvent,
  container: HTMLElement,
  width: number,
) {
  const rect = container.getBoundingClientRect();
  tooltip
    .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
    .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
}

function packCircleStroke(fill: string, depthLevel: DepthVisualLevel): string {
  const parsed = d3.color(fill);
  if (!parsed) return "rgba(15, 23, 42, 0.65)";
  const darken = depthLevel === "enhanced" ? 0.85 : depthLevel === "standard" ? 0.7 : 0.55;
  return parsed.darker(darken).formatRgb();
}

function appendPackPlotChrome(
  root: d3.Selection<SVGGElement, unknown, null, undefined>,
  innerW: number,
  innerH: number,
  theme: D3RenderConfig["theme"],
  opts: {
    showOuterRing?: boolean;
    backgroundColor?: string;
    plotRadiusScale?: number;
  },
): string {
  const { cx, cy, radius } = resolveScaledPackPlotCircle(innerW, innerH, opts.plotRadiusScale ?? 1);

  if (opts.backgroundColor) {
    const parsed = d3.color(opts.backgroundColor);
    root
      .append("circle")
      .attr("class", "pack-plot-bg")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", radius)
      .attr("fill", parsed?.formatRgb() ?? opts.backgroundColor)
      .attr("stroke", "none");
  }

  if (opts.showOuterRing !== false) {
    root
      .append("circle")
      .attr("class", "pack-plot-frame")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("stroke", theme.axisLabel)
      .attr("stroke-opacity", 0.55);
  }

  const clipId = `vs-pack-clip-${Math.random().toString(36).slice(2, 9)}`;
  root
    .append("defs")
    .append("clipPath")
    .attr("id", clipId)
    .append("circle")
    .attr("cx", cx)
    .attr("cy", cy)
    .attr("r", radius);
  return clipId;
}

function packLeaves(
  data: PackDatum[],
  width: number,
  height: number,
  layoutPadding: number,
): d3.HierarchyCircularNode<TreeNode>[] {
  const root = d3
    .hierarchy<TreeNode>({ name: "root", children: data })
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  d3.pack<TreeNode>().size([width, height]).padding(layoutPadding)(root);
  return root.descendants().filter((d) => d.depth > 0) as d3.HierarchyCircularNode<TreeNode>[];
}

export function renderD3CirclePackingChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();
  const {
    width,
    height,
    colors,
    theme,
    showLabel,
    showTooltip,
    valueFormat,
    labelContent,
    options,
    onPointClick,
    depthVisual,
    labelFontSize = 11,
    labelColor,
    renderTier,
    conditionalRules = [],
  } = config;
  const depthLevel = resolveEffectiveDepth(depthVisual);
  const data = (options.data as PackDatum[]) ?? [];
  const labelTotal = d3.sum(data, (d) => d.value ?? 0);
  const valueByName = new Map(data.map((d) => [d.name, d.value ?? 0]));
  const layoutPadding = Number(options.__circlePackingPadding ?? PACK_LAYOUT_PADDING_DEFAULT);
  const labelMinRadiusBase = Number(options.__circlePackingLabelMinRadius ?? PACK_LABEL_MIN_RADIUS_DEFAULT);
  const labelMinRadius =
    renderTier === "thumbnail" ? labelMinRadiusBase * 1.6 : labelMinRadiusBase;
  const sizePercent = Number(options.__circlePackingSizePercent ?? 100) / 100;
  const showOuterRing = options.__circlePackingShowOuterRing !== false;
  const backgroundColor = options.__circlePackingBackgroundColor as string | undefined;
  const plotRadiusScale = sizePercent;
  if (width <= 0 || height <= 0 || data.length === 0) return () => undefined;

  const innerW = Math.max(0, width - PACK_PLOT_PAD * 2);
  const innerH = Math.max(0, height - PACK_PLOT_PAD * 2);
  const strokeWidth = depthLevel === "off" ? 1.5 : 1;

  const packed = packLeaves(data, innerW, innerH, layoutPadding);
  const rawLayout = packed.map((d) => ({ name: d.data.name, x: d.x, y: d.y, r: d.r }));
  const maxR = rawLayout.length > 0 ? Math.max(...rawLayout.map((d) => d.r)) : 0;
  const avgR =
    rawLayout.length > 0 ? rawLayout.reduce((sum, d) => sum + d.r, 0) / rawLayout.length : maxR;
  const edgeMargin = resolvePackEdgeInset(avgR, strokeWidth);
  const layout = fitPackLayoutToPlot(rawLayout, innerW, innerH, edgeMargin, sizePercent);

  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(layout.map((d) => d.name))
    .range(colors);

  const physicsNodes = createPackPhysicsNodes(layout);
  const effectiveLabelMinRadius = resolveEffectivePackLabelMinRadius(
    physicsNodes,
    labelMinRadius,
    labelFontSize,
  );
  const labelFill = resolveLabelFill(theme, labelColor);
  const simulation = createPackPhysicsSimulation(physicsNodes, innerW, innerH, strokeWidth, plotRadiusScale);
  simulation.alpha(0);
  simulation.alphaTarget(0);

  let hovered: PackPhysicsNode | null = null;
  let visualFrame: number | null = null;
  let lastFrameMs: number | null = null;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .attr("data-pixel-no-drag", "true")
    .style("touch-action", "none");

  const plot = svg.append("g").attr("transform", `translate(${PACK_PLOT_PAD},${PACK_PLOT_PAD})`);
  const clipId = appendPackPlotChrome(plot, innerW, innerH, theme, {
    showOuterRing,
    backgroundColor,
    plotRadiusScale,
  });
  const layer = plot.append("g").attr("clip-path", `url(#${clipId})`);

  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;
  const groups = layer
    .selectAll<SVGGElement, PackPhysicsNode>("g.pack-node")
    .data(physicsNodes)
    .join("g")
    .attr("class", "pack-node")
    .attr("transform", (d) => `translate(${d.x ?? d.targetX},${d.y ?? d.targetY})`);

  groups
    .append("circle")
    .attr("r", (d) => packNodeRadius(d))
    .attr("fill", (d) => {
      const base = colorScale(d.name) ?? colors[0] ?? "#465fff";
      const value = valueByName.get(d.name) ?? 0;
      return conditionalRules.length > 0
        ? resolveDatumColor(value, base, conditionalRules)
        : base;
    })
    .attr("opacity", 0.92)
    .attr("stroke", (d) => packCircleStroke(colorScale(d.name) ?? colors[0] ?? "#465fff", depthLevel))
    .attr("stroke-opacity", 0.92)
    .attr("stroke-width", strokeWidth)
    .style("paint-order", depthLevel === "off" ? undefined : "stroke fill")
    .style("cursor", "default")
    .style("pointer-events", "all")
    .on("pointerdown", (event, d) => {
      event.stopPropagation();
      beginHover(d);
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      const packedNode = packed.find((item) => item.data.name === d.name);
      onPointClick?.({ name: d.name, value: packedNode?.value ?? 0 } as D3Datum);
    });

  const labels = showLabel
    ? groups
        .append("text")
        .attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", 0)
        .attr("fill", labelFill)
        .attr("fill-opacity", 1)
        .style("pointer-events", "none")
    : null;

  const refreshPackNodeLabel = (
    labelSel: d3.Selection<SVGTextElement, PackPhysicsNode, SVGGElement, unknown>,
    node: PackPhysicsNode,
  ) => {
    const r = packNodeRadius(node);
    if (r <= effectiveLabelMinRadius) {
      labelSel.selectAll("tspan").remove();
      labelSel.text("");
      return;
    }
    const fs = resolvePackNodeLabelFontSize(r, labelFontSize);
    const lines = formatSimpleDataLabelLines(
      node.name,
      valueByName.get(node.name) ?? 0,
      labelTotal,
      labelContent,
      valueFormat,
    );
    const diameter = r * 2;
    const fittedLines = lines.map((line) => truncatePackLabelLine(line, diameter, fs));
    const maxLines = Math.max(1, Math.floor((r * 2) / Math.round(fs * 1.25)));
    labelSel.style("font-size", `${fs}px`).attr("fill", labelFill).attr("fill-opacity", 1);
    setMultilineSvgLabel(labelSel, fittedLines.slice(0, maxLines), {
      fontSize: fs,
      anchor: "middle",
      x: 0,
      centerBlock: true,
    });
  };

  const updateVisual = () => {
    groups.attr("transform", (d) => `translate(${d.x ?? d.targetX},${d.y ?? d.targetY})`);
    groups.select("circle").attr("r", (d) => packNodeRadius(d));
    if (labels) {
      labels.each(function (d) {
        refreshPackNodeLabel(d3.select(this), d);
      });
      labels.raise();
    }
  };

  const stopVisualPump = () => {
    if (visualFrame !== null) {
      cancelAnimationFrame(visualFrame);
      visualFrame = null;
    }
  };

  const pumpVisual = (now: number) => {
    const dt = normalizePackDt(lastFrameMs == null ? 16.67 : now - lastFrameMs);
    lastFrameMs = now;

    stepPackMotionFrame(physicsNodes, {
      width: innerW,
      height: innerH,
      strokeWidth,
      plotRadiusScale,
      interaction: hovered ? "hover" : "idle",
      dt,
    });
    updateVisual();

    if (isPackMotionActive(physicsNodes, hovered ? "hover" : "idle")) {
      visualFrame = requestAnimationFrame(pumpVisual);
    } else {
      visualFrame = null;
      lastFrameMs = null;
    }
  };

  const ensureVisualPump = () => {
    if (visualFrame === null) {
      lastFrameMs = null;
      visualFrame = requestAnimationFrame(pumpVisual);
    }
  };

  const beginHover = (d: PackPhysicsNode) => {
    if (hovered === d) {
      ensureVisualPump();
      return;
    }
    if (hovered) blurPackNode(hovered);
    hovered = d;
    focusPackNode(d);
    simulation.setInteraction("hover");
    simulation.stop();
    simulation.alphaTarget(0);
    ensureVisualPump();
  };

  const endHover = () => {
    if (!hovered) return;
    blurPackNode(hovered);
    hovered = null;
    simulation.setInteraction("idle");
    simulation.stop();
    simulation.alphaTarget(0);
    ensureVisualPump();
  };

  const handlePointerMove = (event: PointerEvent) => {
    const layerEl = layer.node();
    if (!layerEl) return;
    const [x, y] = d3.pointer(event, layerEl);
    const hit = pickPackNodeAt(physicsNodes, x, y);
    if (hit) {
      beginHover(hit);
      d3.select(groups.nodes().find((el) => (d3.select(el).datum() as PackPhysicsNode).name === hit.name)).raise();
    } else {
      endHover();
    }

    if (tooltip && hit) {
      const packedNode = packed.find((item) => item.data.name === hit.name);
      tooltip
        .style("opacity", "1")
        .html(
          `<div style="font-weight:600;margin-bottom:2px">${hit.name}</div>` +
            `<div><strong>${formatChartValue(packedNode?.value ?? 0, valueFormat)}</strong></div>`,
        );
      positionTooltip(tooltip, event, container, width);
    } else {
      tooltip?.style("opacity", "0");
    }
  };

  layer
    .style("pointer-events", "all")
    .on("pointermove", handlePointerMove)
    .on("pointerleave", () => {
      endHover();
      tooltip?.style("opacity", "0");
    });

  simulation.on("tick", updateVisual);
  updateVisual();

  simulation.on("end", () => {
    if (hovered) return;
    for (const node of physicsNodes) {
      node.x = node.targetX;
      node.y = node.targetY;
      node.vx = 0;
      node.vy = 0;
    }
    enforcePackBounds(physicsNodes, innerW, innerH, strokeWidth, plotRadiusScale);
    updateVisual();
  });

  return () => {
    stopVisualPump();
    lastFrameMs = null;
    simulation.stop();
    container.replaceChildren();
  };
}
