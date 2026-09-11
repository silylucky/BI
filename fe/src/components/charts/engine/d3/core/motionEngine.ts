import * as d3 from "d3";
import { chartTransition, prefersReducedMotion } from "@/components/charts/engine/d3/core/animate";
import { motionDuration, VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";

export function morphAttr(
  sel: d3.Selection<SVGElement, unknown, null, undefined>,
  name: string,
  value: number | string,
): void {
  chartTransition(sel).duration(motionDuration("dataUpdate")).attr(name, value);
}

export function morphNumber(
  from: number,
  to: number,
  onFrame: (v: number) => void,
  durationMs = motionDuration("dataUpdate"),
): () => void {
  if (prefersReducedMotion() || durationMs <= 0) {
    onFrame(to);
    return () => undefined;
  }
  const start = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = d3.easeCubicOut(t);
    onFrame(from + (to - from) * eased);
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function staggerDelay(index: number): number {
  return index * VCDS.motion.stagger;
}

export function pulseSelection(
  sel: d3.Selection<SVGElement, unknown, null, undefined>,
): void {
  if (prefersReducedMotion()) return;
  sel
    .transition()
    .duration(motionDuration("hover"))
    .attr("opacity", 0.7)
    .transition()
    .duration(motionDuration("hover"))
    .attr("opacity", 1);
}
