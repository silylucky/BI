import * as d3 from "d3";
import type { D3CartesianDatum } from "@/components/charts/engine/d3/types";

let chartAnimationSuppressed = false;

/** 看板拖拽缩放期间跳过入场动画，避免每帧 replaceChildren 后重播 transition */
export function setChartAnimationSuppressed(suppressed: boolean): void {
  chartAnimationSuppressed = suppressed;
}

function nativePrefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function prefersReducedMotion(): boolean {
  return chartAnimationSuppressed || nativePrefersReducedMotion();
}

/** 连续型 3D 场景动画等不受看板缩放 suppress 影响 */
export function prefersNativeReducedMotion(): boolean {
  return nativePrefersReducedMotion();
}

type TransitionLike = {
  duration: (ms: number) => TransitionLike;
  ease: (fn: (t: number) => number) => TransitionLike;
  delay: (ms: number) => TransitionLike;
  attr: (name: string, value: string | number | null) => TransitionLike;
};

/** 缩放/无障碍时直接落终态，否则返回 d3 transition */
export function chartTransition<T extends d3.BaseType>(
  sel: d3.Selection<T, unknown, null, undefined>,
): TransitionLike | d3.Transition<T, unknown, null, undefined> {
  if (prefersReducedMotion()) {
    const mock: TransitionLike = {
      duration: () => mock,
      ease: () => mock,
      delay: () => mock,
      attr: (name, value) => {
        if (value !== null) sel.attr(name, value);
        return mock;
      },
    };
    return mock;
  }
  return sel.transition();
}

export function animateStrokePath(
  path: d3.Selection<SVGPathElement, D3CartesianDatum[], null, undefined>,
  durationMs = 720,
) {
  if (prefersReducedMotion()) return;
  const node = path.node();
  if (!node) return;
  const length = node.getTotalLength();
  path
    .attr("stroke-dasharray", `${length} ${length}`)
    .attr("stroke-dashoffset", length)
    .transition()
    .duration(durationMs)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);
}

export function animateBarHeight(
  rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
  targetY: number,
  targetH: number,
  durationMs = 600,
) {
  if (prefersReducedMotion()) {
    rect.attr("y", targetY).attr("height", targetH);
    return;
  }
  rect
    .attr("y", targetY + targetH)
    .attr("height", 0)
    .transition()
    .duration(durationMs)
    .ease(d3.easeCubicOut)
    .attr("y", targetY)
    .attr("height", targetH);
}
