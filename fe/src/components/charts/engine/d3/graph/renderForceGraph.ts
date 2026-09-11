import * as d3 from "d3";
import { resolveEffectiveDepth, shadeColor } from "@/components/charts/engine/d3/core/depthEngine";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3Datum, D3RenderConfig } from "@/components/charts/engine/d3/types";
import { VIZ_WHEEL_ZOOM_SURFACE_ATTR } from "@/components/dashboard/pixelCanvas/pixelCanvasWheelScroll";
import {
  inferBipartiteSides,
  resolveBipartiteTargetX,
} from "@/components/charts/engine/d3/graph/graphBipartiteLayout";
import {
  assignBipartiteEdgeOffsets,
  buildStructuredLinkPath,
  seedBipartiteStructuredLayout,
  seedRingStructuredLayout,
  type StructuredGraphLink,
} from "@/components/charts/engine/d3/graph/graphStructuredLayout";
import {
  buildNodeDegreeMap,
  resolveGraphLinkWidth,
  resolveGraphNodeRadius,
} from "@/components/charts/engine/d3/graph/graphVisualMetrics";
import {
  buildGraphLayoutStateKey,
  readForceGraphLayoutState,
  writeForceGraphLayoutState,
} from "@/components/charts/engine/d3/graph/forceGraphLayoutState";
import {
  buildGraphFitTransform,
  computeGraphContentBounds,
} from "@/components/charts/engine/d3/graph/graphFitView";
import { pickGraphVisibleLabelIds } from "@/components/charts/engine/d3/core/nodeLabelThinning";

type GraphNodeInput = { id: string; data?: { label?: string } };
type GraphEdgeInput = { source: string; target: string; weight?: number };
type GraphLayout = { type?: string };

type SimNode = d3.SimulationNodeDatum & { id: string; label: string };
type SimLink = d3.SimulationLinkDatum<SimNode> & { weight?: number };

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

function buildLayoutStateKey(
  instanceKey: string | undefined,
  nodes: SimNode[],
  links: SimLink[],
  layoutType: string,
): string | undefined {
  const base = buildGraphLayoutStateKey(
    instanceKey,
    nodes.map((node) => node.id),
    links.map((link) => {
      const source = typeof link.source === "string" ? link.source : link.source.id;
      const target = typeof link.target === "string" ? link.target : link.target.id;
      return { source, target };
    }),
    layoutType,
  );
  return base ? `${base}|structured-v4` : undefined;
}

function seedStructuredLayout(
  nodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
): boolean {
  if (seedBipartiteStructuredLayout(nodes, links, width, height)) return true;
  seedRingStructuredLayout(nodes, links, width, height);
  return false;
}

function resolveRepulsion(
  span: number,
  nodeCount: number,
  layoutType: string,
  override: unknown,
): number {
  if (Number.isFinite(Number(override))) {
    return Math.max(80, Math.abs(Number(override)));
  }
  const base =
    layoutType === "dagre"
      ? span < 280
        ? 120
        : 180
      : span < 280
        ? 160
        : span < 420
          ? 220
          : 280;
  return Math.max(base, Math.min(520, base * Math.sqrt(nodeCount / 6)));
}

function dedupeLinks(links: SimLink[]): SimLink[] {
  const seen = new Map<string, SimLink>();
  for (const link of links) {
    const source = typeof link.source === "string" ? link.source : link.source.id;
    const target = typeof link.target === "string" ? link.target : link.target.id;
    const key = `${source}\0${target}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { source, target, weight: link.weight ?? 1 });
      continue;
    }
    existing.weight = (existing.weight ?? 1) + (link.weight ?? 1);
  }
  return [...seen.values()];
}

function lockNodePositions(nodes: SimNode[]): void {
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    node.fx = node.x;
    node.fy = node.y;
  }
}

function applySavedLayout(nodes: SimNode[], saved: Record<string, { x: number; y: number; fx: number; fy: number }>): boolean {
  let restored = 0;
  for (const node of nodes) {
    const pos = saved[node.id];
    if (!pos) continue;
    node.x = pos.x;
    node.y = pos.y;
    node.fx = pos.fx;
    node.fy = pos.fy;
    restored += 1;
  }
  return restored === nodes.length;
}

export function renderD3ForceGraph(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();
  const {
    width,
    height,
    colors,
    theme,
    showLabel,
    showTooltip,
    options,
    onPointClick,
    depthVisual,
    labelFontSize,
    instanceKey,
  } = config;
  const depthLevel = resolveEffectiveDepth(depthVisual);
  const nodesInput = (options.nodes as GraphNodeInput[]) ?? [];
  const edgesInput = (options.edges as GraphEdgeInput[]) ?? [];
  const layout = (options.layout as GraphLayout | undefined) ?? {};
  const styleLayout = String(options.__graphLayout ?? "");
  if (width <= 0 || height <= 0 || nodesInput.length === 0) return () => undefined;

  container.setAttribute(VIZ_WHEEL_ZOOM_SURFACE_ATTR, "true");

  const simNodes: SimNode[] = nodesInput.map((n) => ({
    id: n.id,
    label: n.data?.label ?? n.id,
  }));
  const nodeById = new Map(simNodes.map((n) => [n.id, n]));
  const simLinks: SimLink[] = dedupeLinks(
    edgesInput
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
  );
  assignBipartiteEdgeOffsets(simLinks as StructuredGraphLink[]);

  const layoutType = styleLayout || layout.type || "force";
  const layoutStateKey = buildLayoutStateKey(instanceKey, simNodes, simLinks, layoutType);
  const savedLayout = readForceGraphLayoutState(layoutStateKey);
  const restoredLayout = savedLayout ? applySavedLayout(simNodes, savedLayout) : false;
  const bipartiteSides = inferBipartiteSides(simLinks);
  const isBipartite = bipartiteSides.leftIds.size > 0 && bipartiteSides.rightIds.size > 0;
  if (!restoredLayout) {
    seedStructuredLayout(simNodes, simLinks, width, height);
  }

  const nodeDegree = buildNodeDegreeMap(simLinks);
  const maxLinkWeight = Math.max(1, ...simLinks.map((link) => link.weight ?? 1));
  const nodeRadius = (id: string) =>
    resolveGraphNodeRadius(nodeDegree.get(id) ?? 1, layoutType);

  const colorScale = d3
    .scaleOrdinal<string>()
    .domain(simNodes.map((n) => n.id))
    .range(colors);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img")
    .style("cursor", "grab");

  const zoomRoot = svg.append("g").attr("class", "graph-zoom-root");
  const linkLayer = zoomRoot.append("g").attr("class", "links");
  const nodeLayer = zoomRoot.append("g").attr("class", "nodes");
  const defs = depthLevel !== "off" ? zoomRoot.append("defs") : null;

  const nodeFill = (id: string): string => {
    const color = colorScale(id) ?? colors[0] ?? "#465fff";
    if (!defs || depthLevel === "off") return color;
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const gradId = `vs-force-node-${safeId}`;
    if (defs.select(`#${gradId}`).empty()) {
      const grad = defs
        .append("radialGradient")
        .attr("id", gradId)
        .attr("cx", "35%")
        .attr("cy", "35%")
        .attr("r", "70%");
      grad.append("stop").attr("offset", "0%").attr("stop-color", shadeColor(color, "top"));
      grad.append("stop").attr("offset", "100%").attr("stop-color", color);
    }
    return `url(#${gradId})`;
  };

  const linkOpacity = simLinks.length > 24 ? 0.42 : simLinks.length > 12 ? 0.55 : 0.72;
  const link = linkLayer
    .selectAll<SVGPathElement, SimLink>("path")
    .data(simLinks)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", theme.axisLine)
    .attr("stroke-opacity", linkOpacity)
    .attr("stroke-width", (d) => resolveGraphLinkWidth(d.weight ?? 1, maxLinkWeight));

  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;
  const node = nodeLayer
    .selectAll<SVGGElement, SimNode>("g.node")
    .data(simNodes)
    .join("g")
    .attr("class", "node")
    .style("cursor", onPointClick ? "pointer" : "grab");

  node
    .append("circle")
    .attr("r", (d) => nodeRadius(d.id))
    .attr("fill", (d) => nodeFill(d.id))
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .on("mouseenter", function (_event, d) {
      d3.select(this).attr("r", nodeRadius(d.id) + 2);
    })
    .on("mouseleave", function (_event, d) {
      d3.select(this).attr("r", nodeRadius(d.id));
      tooltip?.style("opacity", "0");
    })
    .on("mousemove", (event, d) => {
      if (!tooltip) return;
      tooltip
        .style("opacity", "1")
        .html(`<div style="font-weight:600">${d.label}</div>`);
      positionTooltip(tooltip, event, container, width);
    })
    .on("click", (_event, d) => onPointClick?.({ id: d.id, label: d.label } as D3Datum));

  if (showLabel) {
    node
      .append("text")
      .attr("y", (d) => nodeRadius(d.id) + 11)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", theme.axisLabel)
      .style("font-size", `${labelFontSize}px`)
      .style("pointer-events", "none")
      .text((d) => d.label);
  }

  const syncLabelVisibility = () => {
    if (!showLabel) return;
    const visibleIds = pickGraphVisibleLabelIds({
      nodes: simNodes,
      fontSize: labelFontSize,
      nodeRadius,
      nodeDegree,
      leftIds: bipartiteSides.leftIds,
      rightIds: bipartiteSides.rightIds,
      middleIds: bipartiteSides.middleIds,
    });
    node.select("text").style("display", (d) => (visibleIds.has(d.id) ? null : "none"));
  };

  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .filter((event) => {
      if (event.type === "wheel") return true;
      const target = event.target as Element | null;
      if (!target) return false;
      return target === svg.node() || target.tagName === "path" || target.tagName === "line";
    })
    .on("zoom", (event) => {
      zoomRoot.attr("transform", event.transform);
    });

  svg.call(zoomBehavior).on("dblclick.zoom", null);
  svg.on("wheel", (event) => {
    event.stopPropagation();
  });

  const span = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const repulsion = resolveRepulsion(span, simNodes.length, layoutType, options.__graphRepulsion);
  const edgeLength = Number.isFinite(Number(options.__graphEdgeLength))
    ? Math.abs(Number(options.__graphEdgeLength))
    : layoutType === "dagre"
      ? 72
      : isBipartite
        ? Math.max(72, Math.min(160, span * 0.24))
        : Math.max(64, Math.min(140, span * 0.2));
  const collideRadius = (node: SimNode) => nodeRadius(node.id) + (showLabel ? 16 : 8);

  const simulation = d3
    .forceSimulation(simNodes)
    .force(
      "link",
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(edgeLength)
        .strength(layoutType === "dagre" ? 0.95 : 0.85),
    )
    .force("charge", d3.forceManyBody().strength(-repulsion).distanceMax(span * 1.4))
    .force("center", d3.forceCenter(cx, cy).strength(isBipartite ? 0.03 : 0.06))
    .force("collide", d3.forceCollide<SimNode>().radius(collideRadius).strength(1).iterations(3))
    .alpha(restoredLayout ? 0.02 : 0.65)
    .alphaDecay(0.05)
    .velocityDecay(0.58)
    .alphaMin(0.001);

  if (isBipartite) {
    simulation.force(
      "bipartiteX",
      d3
        .forceX<SimNode>((node) => resolveBipartiteTargetX(node.id, bipartiteSides, width))
        .strength(layoutType === "dagre" ? 0.88 : 0.62),
    );
    simulation.force(
      "bipartiteY",
      d3
        .forceY<SimNode>((node) => node.y ?? cy)
        .strength(layoutType === "dagre" ? 0.35 : 0.18),
    );
  }

  const persistLayout = () => {
    writeForceGraphLayoutState(layoutStateKey, simNodes);
  };

  const freezeLayout = () => {
    lockNodePositions(simNodes);
    simulation.stop();
    persistLayout();
  };

  const applyFitToView = () => {
    const bounds = computeGraphContentBounds(simNodes, showLabel, labelFontSize);
    if (!bounds) return;
    const transform = buildGraphFitTransform(bounds, width, height);
    svg.call(zoomBehavior.transform, transform);
  };

  const syncPaint = () => {
    link.attr("d", (d) =>
      buildStructuredLinkPath(
        (d.source as SimNode).x ?? 0,
        (d.source as SimNode).y ?? 0,
        (d.target as SimNode).x ?? 0,
        (d.target as SimNode).y ?? 0,
        layoutType,
        (d as StructuredGraphLink).edgeOffset ?? 0,
      ),
    );
    node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
  };

  const finishLayout = () => {
    freezeLayout();
    syncPaint();
    syncLabelVisibility();
    applyFitToView();
  };

  let settleFrameId = 0;
  const cancelSettle = () => {
    if (settleFrameId) {
      cancelAnimationFrame(settleFrameId);
      settleFrameId = 0;
    }
  };

  const runUntilSettledAsync = (maxTicks = Math.max(420, simNodes.length * 18), ticksPerFrame = 24) => {
    cancelSettle();
    let ticks = 0;
    const step = () => {
      settleFrameId = 0;
      const batch = Math.min(ticksPerFrame, maxTicks - ticks);
      for (let i = 0; i < batch && simulation.alpha() > simulation.alphaMin(); i += 1) {
        simulation.tick();
        ticks += 1;
      }
      syncPaint();
      if (simulation.alpha() > simulation.alphaMin() && ticks < maxTicks) {
        settleFrameId = requestAnimationFrame(step);
        return;
      }
      finishLayout();
    };
    settleFrameId = requestAnimationFrame(step);
  };

  simulation.on("tick", syncPaint);

  simulation.on("end", () => {
    finishLayout();
  });

  if (restoredLayout) {
    finishLayout();
  } else {
    runUntilSettledAsync();
  }

  svg.on("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    applyFitToView();
  });

  const dragBehavior = d3
    .drag<SVGGElement, SimNode>()
    .on("start", (event, d) => {
      event.sourceEvent.stopPropagation();
      if (!event.active) simulation.alpha(0.12).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      if (d.x != null && d.y != null) {
        d.fx = d.x;
        d.fy = d.y;
      }
      freezeLayout();
      syncLabelVisibility();
    });
  node.call(dragBehavior);

  return () => {
    cancelSettle();
    persistLayout();
    simulation.stop();
    svg.on(".zoom", null);
    svg.on("dblclick", null);
    svg.on("wheel", null);
    container.removeAttribute(VIZ_WHEEL_ZOOM_SURFACE_ATTR);
    container.replaceChildren();
  };
}
