import * as d3 from "d3";
import { resolveEffectiveDepth } from "@/components/charts/engine/d3/core/depthEngine";
import { radialMargin } from "@/components/charts/engine/d3/core/margin";
import { createTooltip } from "@/components/charts/engine/d3/core/tooltip";
import type { D3Datum, D3RenderConfig } from "@/components/charts/engine/d3/types";
import { formatChartValue } from "@/lib/chartValueFormat";
import { pickSankeyVisibleLabelIds } from "@/components/charts/engine/d3/core/nodeLabelThinning";

type SankeyLink = { source: string; target: string; value: number };
type LayoutNode = { id: string; depth: number; value: number; y: number; height: number; x: number };

function assignDepths(links: SankeyLink[]): Map<string, number> {
  const depths = new Map<string, number>();
  const nodes = new Set(links.flatMap((l) => [l.source, l.target]));
  for (const id of nodes) {
    if (!links.some((l) => l.target === id)) depths.set(id, 0);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of links) {
      const next = (depths.get(link.source) ?? 0) + 1;
      const prev = depths.get(link.target) ?? 0;
      if (next > prev) {
        depths.set(link.target, next);
        changed = true;
      }
    }
  }
  return depths;
}

function layoutSankeyNodes(
  links: SankeyLink[],
  innerW: number,
  innerH: number,
  nodeWidth: number,
  nodePadding: number,
): LayoutNode[] {
  const depths = assignDepths(links);
  const maxDepth = d3.max([...depths.values()]) ?? 0;
  const colW = maxDepth > 0 ? (innerW - nodeWidth) / maxDepth : 0;
  const totals = new Map<string, number>();
  for (const link of links) {
    totals.set(link.source, (totals.get(link.source) ?? 0) + link.value);
    totals.set(link.target, (totals.get(link.target) ?? 0) + link.value);
  }
  const byDepth = d3.group([...totals.keys()], (id) => depths.get(id) ?? 0);
  const nodes: LayoutNode[] = [];

  for (const [depth, ids] of byDepth.entries()) {
    const sorted = [...ids].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
    const sum = d3.sum(sorted, (id) => totals.get(id) ?? 0) || 1;
    const count = sorted.length;
    const gap =
      count > 1
        ? Math.min(nodePadding, Math.max(1, (innerH - nodePadding * 2) / Math.max(1, count * 6)))
        : 0;
    const stackBudget = Math.max(0, innerH - nodePadding * 2 - gap * Math.max(0, count - 1));
    const rawHeights = sorted.map((id) => {
      const value = totals.get(id) ?? 0;
      return Math.max(4, (value / sum) * Math.max(0, innerH - nodePadding * 2));
    });
    const rawStack = d3.sum(rawHeights);
    const scale = rawStack > stackBudget && rawStack > 0 ? stackBudget / rawStack : 1;
    let y = nodePadding;
    sorted.forEach((id, index) => {
      const value = totals.get(id) ?? 0;
      const height = Math.max(2, rawHeights[index]! * scale);
      nodes.push({ id, depth, value, y, height, x: depth * colW });
      y += height + gap;
    });
  }
  return nodes;
}

function formatSankeyNodeLabel(id: string, maxLen = 12): string {
  const trimmed = id.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLen - 1))}…`;
}

function linkPath(
  sx: number,
  sy: number,
  sh: number,
  tx: number,
  ty: number,
  th: number,
  nodeWidth: number,
): string {
  const x0 = sx + nodeWidth;
  const x1 = tx;
  const xm = (x0 + x1) / 2;
  return `M ${x0} ${sy} C ${xm} ${sy}, ${xm} ${ty}, ${x1} ${ty} L ${x1} ${ty + th} C ${xm} ${ty + th}, ${xm} ${sy + sh}, ${x0} ${sy + sh} Z`;
}

export function renderD3SankeyChart(container: HTMLElement, config: D3RenderConfig): () => void {
  container.replaceChildren();

  const { width, height, colors, theme, showLabel, showTooltip, valueFormat, options, depthVisual, labelFontSize } = config;
  const depthLevel = resolveEffectiveDepth(depthVisual);
  const defaultLinkOpacity = depthLevel === "enhanced" ? 0.38 : depthLevel === "standard" ? 0.32 : 0.28;
  const sourceField = String(options.sourceField ?? "source");
  const targetField = String(options.targetField ?? "target");
  const weightField = String(options.weightField ?? "value");
  const raw = (options.data as D3Datum[]) ?? [];
  const links: SankeyLink[] = raw.map((row) => ({
    source: String(row[sourceField] ?? ""),
    target: String(row[targetField] ?? ""),
    value: Math.max(0, Number(row[weightField] ?? 0)),
  }));

  if (width <= 0 || height <= 0 || links.length === 0) return () => undefined;

  const margin = radialMargin(false);
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);
  const nodeWidth = Number(options.__sankeyNodeWidth ?? 12);
  const nodePadding = Number(options.__sankeyNodeGap ?? 10);
  const linkOpacity = Number(options.__sankeyLinkOpacity ?? defaultLinkOpacity);
  const nodes = layoutSankeyNodes(links, innerW, innerH, nodeWidth, nodePadding);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const colorScale = d3.scaleOrdinal<string>().domain(nodes.map((n) => n.id)).range(colors);

  const root = d3
    .select(container)
    .append("svg")
    .attr("class", "vs-chart-svg")
    .attr("data-vs-embedded-fit", "content")
    .attr("width", width)
    .attr("height", height)
    .attr("role", "img");

  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const tooltip = showTooltip ? createTooltip(container, theme, config.tooltipPresentation) : null;
  const maxLink = d3.max(links, (l) => l.value) ?? 1;

  for (const link of links) {
    const s = nodeMap.get(link.source);
    const t = nodeMap.get(link.target);
    if (!s || !t) continue;
    const strokeW = Math.max(1, (link.value / maxLink) * Math.min(s.height, t.height));
    const sy = s.y + (s.height - strokeW) / 2;
    const ty = t.y + (t.height - strokeW) / 2;
    const color = colorScale(link.source) ?? colors[0] ?? "#465fff";

    g.append("path")
      .attr("d", linkPath(s.x, sy, strokeW, t.x, ty, strokeW, nodeWidth))
      .attr("fill", color)
      .attr("opacity", linkOpacity)
      .on("mouseenter", (event) => {
        if (!tooltip) return;
        tooltip
          .style("opacity", "1")
          .html(
            `<div style="font-weight:600">${link.source} → ${link.target}</div>` +
              `<div style="margin-top:4px">${formatChartValue(link.value, valueFormat)}</div>`,
          );
        const rect = container.getBoundingClientRect();
        tooltip
          .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mousemove", (event) => {
        if (!tooltip) return;
        const rect = container.getBoundingClientRect();
        tooltip
          .style("left", `${Math.min(event.clientX - rect.left + 12, width - 160)}px`)
          .style("top", `${Math.max(event.clientY - rect.top - 48, 8)}px`);
      })
      .on("mouseleave", () => tooltip?.style("opacity", "0"));
  }

  g.selectAll<SVGRectElement, LayoutNode>("rect.node")
    .data(nodes)
    .join("rect")
    .attr("class", "node")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", nodeWidth)
    .attr("height", (d) => d.height)
    .attr("rx", 3)
    .attr("fill", (d) => colorScale(d.id) ?? colors[0] ?? "#465fff")
    .attr("opacity", 0.92);

  if (showLabel) {
    const visibleLabelIds = pickSankeyVisibleLabelIds(nodes, labelFontSize, (node) =>
      formatSankeyNodeLabel(node.id),
    );
    g.selectAll<SVGTextElement, LayoutNode>("text.node-label")
      .data(nodes.filter((node) => visibleLabelIds.has(node.id)))
      .join("text")
      .attr("class", "node-label")
      .attr("x", (d) => d.x + (d.depth === 0 ? -6 : nodeWidth + 6))
      .attr("y", (d) => d.y + d.height / 2)
      .attr("text-anchor", (d) => (d.depth === 0 ? "end" : "start"))
      .attr("dominant-baseline", "middle")
      .attr("fill", theme.axisLabel)
      .style("font-size", `${labelFontSize}px`)
      .text((d) => formatSankeyNodeLabel(d.id));
  }

  return () => container.replaceChildren();
}
