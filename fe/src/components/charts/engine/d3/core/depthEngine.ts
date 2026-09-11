import * as d3 from "d3";
import { animateBarHeight, prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import { VCDS, type DepthVisualLevel, getDepthVisual, setDepthVisual } from "@/components/charts/engine/d3/core/chartVisualTokens";

export { setDepthVisual, getDepthVisual };
export type { DepthVisualLevel };

export type DepthRole = "top" | "side" | "shadow";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (!hex.startsWith("#")) return null;
  const raw = hex.slice(1);
  if (raw.length === 3) {
    return [
      parseInt(raw[0] + raw[0], 16),
      parseInt(raw[1] + raw[1], 16),
      parseInt(raw[2] + raw[2], 16),
    ];
  }
  if (raw.length === 6) {
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  return null;
}

export function shadeColor(base: string, role: DepthRole): string {
  const rgb = parseHex(base);
  if (!rgb) return base;
  const [r, g, b] = rgb;
  const factor =
    role === "top"
      ? 1 + VCDS.depth.topLighten
      : role === "side"
        ? 1 - VCDS.depth.sideDarken
        : 1 - VCDS.depth.sideDarken * 1.35;
  // channel 为 0–255；不可用 clamp01（那是 0–1）
  const mix = (c: number) => Math.round(Math.max(0, Math.min(255, c * factor)));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function resolveEffectiveDepth(requested?: DepthVisualLevel): DepthVisualLevel {
  const level = requested ?? getDepthVisual();
  return level;
}

export function depthExtrudePx(level: DepthVisualLevel): number {
  if (level === "off") return 0;
  return VCDS.depth.extrudePx[level];
}

export function depthShadowBlur(level: DepthVisualLevel): number {
  if (level === "off") return 0;
  return VCDS.depth.shadowBlur[level];
}

export function depthPieExtrudeOffset(level: DepthVisualLevel): number {
  if (level === "off") return 0;
  return VCDS.depth.pieExtrudeOffset[level];
}

export function ensureDepthShadowFilter(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  id: string,
  level: DepthVisualLevel,
): string | null {
  if (level === "off") return null;
  const safeId = `vs-depth-shadow-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const blur = depthShadowBlur(level);
  const dy = level === "enhanced" ? 2 : 1;
  let filter = defs.select<SVGFilterElement>(`#${safeId}`);
  if (filter.empty()) {
    filter = defs
      .append("filter")
      .attr("id", safeId)
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    filter.append("feDropShadow").attr("class", "vs-depth-drop");
  }
  filter.select("feDropShadow").attr("dx", 0).attr("dy", dy).attr("stdDeviation", blur).attr("flood-opacity", 0.28);
  return safeId;
}

type ExtrudedBarOpts = {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rx?: number;
  depthLevel?: DepthVisualLevel;
  className?: string;
};

export function drawExtrudedBar(opts: ExtrudedBarOpts): d3.Selection<SVGGElement, unknown, null, undefined> {
  const level = resolveEffectiveDepth(opts.depthLevel);
  const group = opts.plot.append("g").attr("class", opts.className ?? "vs-extruded-bar");
  if (level === "off" || opts.height <= 0) {
    group
      .append("rect")
      .attr("x", opts.x)
      .attr("y", opts.y)
      .attr("width", opts.width)
      .attr("height", Math.max(0, opts.height))
      .attr("rx", opts.rx ?? VCDS.bar.rx)
      .attr("fill", opts.color);
    return group;
  }

  const depth = depthExtrudePx(level);
  const w = opts.width;
  const h = Math.max(0, opts.height);
  const x = opts.x;
  const y = opts.y;
  const topColor = shadeColor(opts.color, "top");
  const sideColor = shadeColor(opts.color, "side");

  group
    .append("path")
    .attr("class", "vs-bar-side")
    .attr(
      "d",
      `M ${x + w} ${y} L ${x + w + depth} ${y - depth} L ${x + w + depth} ${y + h - depth} L ${x + w} ${y + h} Z`,
    )
    .attr("fill", sideColor);

  group
    .append("path")
    .attr("class", "vs-bar-top")
    .attr("d", `M ${x} ${y} L ${x + depth} ${y - depth} L ${x + w + depth} ${y - depth} L ${x + w} ${y} Z`)
    .attr("fill", topColor);

  group
    .append("rect")
    .attr("class", "vs-bar-front")
    .attr("x", x)
    .attr("y", y)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", opts.rx ?? VCDS.bar.rx)
    .attr("fill", opts.color);

  return group;
}

type ExtrudedHorizontalBarOpts = Omit<ExtrudedBarOpts, "plot"> & {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
};

export function drawExtrudedHorizontalBar(opts: ExtrudedHorizontalBarOpts): d3.Selection<SVGGElement, unknown, null, undefined> {
  const level = resolveEffectiveDepth(opts.depthLevel);
  const group = opts.plot.append("g").attr("class", opts.className ?? "vs-extruded-hbar");
  if (level === "off" || opts.width <= 0) {
    group
      .append("rect")
      .attr("x", opts.x)
      .attr("y", opts.y)
      .attr("width", Math.max(0, opts.width))
      .attr("height", opts.height)
      .attr("rx", opts.rx ?? VCDS.bar.rx)
      .attr("fill", opts.color);
    return group;
  }

  const depth = depthExtrudePx(level);
  const w = Math.max(0, opts.width);
  const h = opts.height;
  const x = opts.x;
  const y = opts.y;
  const topColor = shadeColor(opts.color, "top");
  const sideColor = shadeColor(opts.color, "side");

  // 横柱数值沿 x：挤出在厚度(y)与末端(x)，不沿数值轴拉长柱长
  group
    .append("path")
    .attr("class", "vs-hbar-bottom")
    .attr(
      "d",
      `M ${x} ${y + h} L ${x + depth} ${y + h + depth} L ${x + w + depth} ${y + h + depth} L ${x + w} ${y + h} Z`,
    )
    .attr("fill", sideColor);

  group
    .append("path")
    .attr("class", "vs-hbar-top")
    .attr("d", `M ${x} ${y} L ${x + depth} ${y + depth} L ${x + w} ${y + depth} L ${x + w} ${y} Z`)
    .attr("fill", topColor);

  group
    .append("path")
    .attr("class", "vs-hbar-side")
    .attr(
      "d",
      `M ${x + w} ${y} L ${x + w + depth} ${y + depth} L ${x + w + depth} ${y + h + depth} L ${x + w} ${y + h} Z`,
    )
    .attr("fill", sideColor);

  group
    .append("rect")
    .attr("class", "vs-hbar-front")
    .attr("x", x)
    .attr("y", y)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", opts.rx ?? VCDS.bar.rx)
    .attr("fill", opts.color);

  return group;
}

export function drawPieExtrude(
  parent: d3.Selection<SVGGElement, d3.PieArcDatum<unknown>, SVGGElement, unknown>,
  arcPath: string | null,
  color: string,
  level?: DepthVisualLevel,
): void {
  const depthLevel = resolveEffectiveDepth(level);
  const offset = depthPieExtrudeOffset(depthLevel);
  if (!arcPath || offset <= 0) return;
  parent
    .insert("path", ":first-child")
    .attr("class", "vs-pie-extrude")
    .attr("d", arcPath)
    .attr("transform", `translate(${offset * 0.6}, ${offset})`)
    .attr("fill", shadeColor(color, "shadow"))
    .attr("stroke", "none")
    .attr("opacity", 0.85);
}

export function applyPathDepthShadow(
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  path: d3.Selection<SVGPathElement, unknown, null, undefined>,
  color: string,
  filterKey: string,
  level?: DepthVisualLevel,
): void {
  const depthLevel = resolveEffectiveDepth(level);
  const filterId = ensureDepthShadowFilter(defs, filterKey, depthLevel);
  if (!filterId) return;
  const offset = depthExtrudePx(depthLevel) * 0.45;
  path
    .clone(true)
    .lower()
    .attr("transform", `translate(${offset * 0.55}, ${offset})`)
    .attr("fill", "none")
    .attr("stroke", shadeColor(color, "shadow"))
    .attr("stroke-width", VCDS.line.width + 2)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", depthLevel === "enhanced" ? 0.42 : 0.32)
    .attr("filter", `url(#${filterId})`);
}

export function applyDepthHoverLift(
  selection: d3.Selection<SVGElement, unknown, null, undefined>,
  dy = -2,
): void {
  if (resolveEffectiveDepth() === "off") return;
  selection.attr("transform", `translate(0, ${dy})`);
}

export function applyCellBevel(
  rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
  level?: DepthVisualLevel,
): void {
  if (resolveEffectiveDepth(level) === "off") return;
  rect
    .attr("stroke", shadeColor(rect.attr("fill") || "#465fff", "top"))
    .attr("stroke-width", 1)
    .style("paint-order", "stroke fill");
}

type PaintVerticalBarOpts = {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  x: number;
  y1: number;
  height: number;
  width: number;
  color: string;
  rx?: number;
  depthLevel?: DepthVisualLevel;
  animate?: boolean;
};

export function paintVerticalBar(opts: PaintVerticalBarOpts): void {
  const level = resolveEffectiveDepth(opts.depthLevel);
  const h = Math.max(0, opts.height);
  if (level === "off") {
    const rect = opts.plot
      .append("rect")
      .attr("x", opts.x)
      .attr("width", opts.width)
      .attr("rx", opts.rx ?? VCDS.bar.rx)
      .attr("fill", opts.color);
    if (opts.animate !== false) animateBarHeight(rect, opts.y1, h);
    else rect.attr("y", opts.y1).attr("height", h);
    return;
  }
  drawExtrudedBar({
    plot: opts.plot,
    x: opts.x,
    y: opts.y1,
    width: opts.width,
    height: h,
    color: opts.color,
    rx: opts.rx,
    depthLevel: level,
  });
}

type PaintHorizontalBarOpts = {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rx?: number;
  depthLevel?: DepthVisualLevel;
  animate?: boolean;
};

export function paintHorizontalBar(opts: PaintHorizontalBarOpts): void {
  const level = resolveEffectiveDepth(opts.depthLevel);
  const w = Math.max(0, opts.width);
  if (level === "off") {
    const rect = opts.plot
      .append("rect")
      .attr("y", opts.y)
      .attr("height", opts.height)
      .attr("rx", opts.rx ?? VCDS.bar.rx)
      .attr("fill", opts.color)
      .attr("x", opts.x)
      .attr("width", w);
    if (opts.animate === false) return;
    rect.attr("width", 0).transition().duration(480).attr("width", w);
    return;
  }
  drawExtrudedHorizontalBar({
    plot: opts.plot,
    x: opts.x,
    y: opts.y,
    width: w,
    height: opts.height,
    color: opts.color,
    rx: opts.rx,
    depthLevel: level,
  });
}
