import * as d3 from "d3";
import { shadeColor } from "@/components/charts/engine/d3/core/depthEngine";

export function funnelTrapezoidPath(
  cx: number,
  topY: number,
  bottomY: number,
  topW: number,
  bottomW: number,
): string {
  const tHalf = topW / 2;
  const bHalf = bottomW / 2;
  return `M ${cx - tHalf} ${topY} L ${cx + tHalf} ${topY} L ${cx + bHalf} ${bottomY} L ${cx - bHalf} ${bottomY} Z`;
}

function funnelCorners(cx: number, topY: number, bottomY: number, topW: number, bottomW: number) {
  const tHalf = topW / 2;
  const bHalf = bottomW / 2;
  return {
    tl: { x: cx - tHalf, y: topY },
    tr: { x: cx + tHalf, y: topY },
    br: { x: cx + bHalf, y: bottomY },
    bl: { x: cx - bHalf, y: bottomY },
  };
}

/** 与纵柱一致：挤出朝右上 (+dx, -dy) */
export function funnelTopFacePath(
  cx: number,
  topY: number,
  bottomY: number,
  topW: number,
  bottomW: number,
  depth: number,
): string {
  const { tl, tr } = funnelCorners(cx, topY, bottomY, topW, bottomW);
  return `M ${tl.x} ${tl.y} L ${tl.x + depth} ${tl.y - depth} L ${tr.x + depth} ${tr.y - depth} L ${tr.x} ${tr.y} Z`;
}

export function funnelRightFacePath(
  cx: number,
  topY: number,
  bottomY: number,
  topW: number,
  bottomW: number,
  depth: number,
): string {
  const { tr, br } = funnelCorners(cx, topY, bottomY, topW, bottomW);
  return `M ${tr.x} ${tr.y} L ${tr.x + depth} ${tr.y - depth} L ${br.x + depth} ${br.y - depth} L ${br.x} ${br.y} Z`;
}

type DrawOpts = {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  cx: number;
  topY: number;
  bottomY: number;
  topW: number;
  bottomW: number;
  color: string;
  depth: number;
};

export function drawFunnelLayer(opts: DrawOpts): d3.Selection<SVGGElement, unknown, null, undefined> {
  const group = opts.plot.append("g").attr("class", "vs-funnel-item");
  const { cx, topY, bottomY, topW, bottomW, color, depth } = opts;

  if (depth > 0) {
    group
      .append("path")
      .attr("class", "vs-funnel-side")
      .attr("d", funnelRightFacePath(cx, topY, bottomY, topW, bottomW, depth))
      .attr("fill", shadeColor(color, "side"))
      .attr("stroke", "none")
      .attr("pointer-events", "none");
    group
      .append("path")
      .attr("class", "vs-funnel-top")
      .attr("d", funnelTopFacePath(cx, topY, bottomY, topW, bottomW, depth))
      .attr("fill", shadeColor(color, "top"))
      .attr("stroke", "none")
      .attr("pointer-events", "none");
  }

  group
    .append("path")
    .attr("class", "vs-funnel-layer")
    .attr("d", funnelTrapezoidPath(cx, topY, bottomY, topW, bottomW))
    .attr("fill", color)
    .attr("stroke", shadeColor(color, "side"))
    .attr("stroke-width", depth > 0 ? 0.6 : 1);

  return group;
}
