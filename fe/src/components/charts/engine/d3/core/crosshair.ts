import * as d3 from "d3";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { nearestCategory } from "@/components/charts/engine/d3/core/interaction";
import type { D3Theme } from "@/components/charts/engine/d3/core/themeEngine";
import { motionDuration } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";

export type CrosshairLayer = {
  group: d3.Selection<SVGGElement, unknown, null, undefined>;
  vLine: d3.Selection<SVGLineElement, unknown, null, undefined>;
  hLine: d3.Selection<SVGLineElement, unknown, null, undefined>;
  dot: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  show: (cx: number, cy: number, dotColor: string, immediate?: boolean) => void;
  hide: () => void;
};

type CreateCrosshairOptions = {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  innerW: number;
  innerH: number;
  theme: D3Theme;
};

export function createCrosshair({ plot, innerW, innerH, theme }: CreateCrosshairOptions): CrosshairLayer {
  let active = false;
  const group = plot.append("g").attr("class", "vs-crosshair").style("opacity", 0).style("pointer-events", "none");

  const vLine = group
    .append("line")
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", theme.crosshair)
    .attr("stroke-dasharray", VCDS.crosshair.dash)
    .attr("stroke-opacity", VCDS.crosshair.opacity);

  const hLine = group
    .append("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("stroke", theme.crosshair)
    .attr("stroke-dasharray", VCDS.crosshair.dash)
    .attr("stroke-opacity", VCDS.crosshair.opacity * 0.7);

  const dot = group
    .append("circle")
    .attr("r", VCDS.dot.radius + 1)
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  return {
    group,
    vLine,
    hLine,
    dot,
    show(cx: number, cy: number, dotColor: string, immediate = false) {
      const snap = immediate || !active || prefersReducedMotion();
      active = true;
      group.style("opacity", 1).raise();
      vLine.interrupt();
      hLine.interrupt();
      dot.interrupt();
      if (!snap) {
        const dur = motionDuration("crosshair");
        const ease = d3.easeCubicOut;
        vLine.transition().duration(dur).ease(ease).attr("x1", cx).attr("x2", cx);
        hLine.transition().duration(dur).ease(ease).attr("y1", cy).attr("y2", cy);
        dot.transition().duration(dur).ease(ease).attr("cx", cx).attr("cy", cy).attr("fill", dotColor);
        return;
      }
      vLine.attr("x1", cx).attr("x2", cx);
      hLine.attr("y1", cy).attr("y2", cy);
      dot.attr("cx", cx).attr("cy", cy).attr("fill", dotColor);
    },
    hide() {
      active = false;
      group.style("opacity", 0);
    },
  };
}

export type CrosshairHoverOptions = {
  plot: d3.Selection<SVGGElement, unknown, null, undefined>;
  innerW: number;
  innerH: number;
  categories: string[];
  xScale: d3.ScalePoint<string>;
  crosshair: CrosshairLayer;
  onCategory: (category: string, mx: number, my: number, event: MouseEvent) => void;
  onLeave: () => void;
};

function pickBandCategory(mx: number, categories: string[], xScale: d3.ScaleBand<string>): string {
  let best = categories[0] ?? "";
  let bestDist = Infinity;
  for (const cat of categories) {
    const px = (xScale(cat) ?? 0) + xScale.bandwidth() / 2;
    const dist = Math.abs(px - mx);
    if (dist < bestDist) {
      bestDist = dist;
      best = cat;
    }
  }
  return best;
}

export type BandCrosshairHoverOptions = Omit<CrosshairHoverOptions, "xScale"> & {
  xScale: d3.ScaleBand<string>;
};

export function attachBandCrosshairHover(opts: BandCrosshairHoverOptions): void {
  opts.plot
    .selectAll("rect.vs-crosshair-hit")
    .data([null])
    .join("rect")
    .attr("class", "vs-crosshair-hit")
    .attr("width", opts.innerW)
    .attr("height", opts.innerH)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .raise()
    .on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event);
      const category = pickBandCategory(mx, opts.categories, opts.xScale);
      opts.onCategory(category, mx, my, event);
    })
    .on("mouseleave", () => {
      opts.crosshair.hide();
      opts.onLeave();
    });
}

export function attachCrosshairHover(opts: CrosshairHoverOptions): void {
  opts.plot
    .selectAll("rect.vs-crosshair-hit")
    .data([null])
    .join("rect")
    .attr("class", "vs-crosshair-hit")
    .attr("width", opts.innerW)
    .attr("height", opts.innerH)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .raise()
    .on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event);
      const category = nearestCategory(mx, opts.categories, opts.xScale);
      opts.onCategory(category, mx, my, event);
    })
    .on("mouseleave", () => {
      opts.crosshair.hide();
      opts.onLeave();
    });
}
