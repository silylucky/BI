import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";

export type RenderMode = "svg-full" | "svg-sampled" | "hybrid-canvas";

export function resolveRenderMode(pointCount: number, plotType?: string): RenderMode {
  if (pointCount <= VCDS.perf.svgFullMaxPoints) return "svg-full";
  if (pointCount <= VCDS.perf.svgSampleMaxPoints) return "svg-sampled";
  if (plotType === "Scatter" || plotType === "Graph") return "hybrid-canvas";
  return "svg-sampled";
}

export function sampleStride(pointCount: number, maxPoints: number): number {
  if (pointCount <= maxPoints) return 1;
  return Math.ceil(pointCount / maxPoints);
}

export function sampleIndices(length: number, maxPoints: number): number[] {
  const stride = sampleStride(length, maxPoints);
  const indices: number[] = [];
  for (let i = 0; i < length; i += stride) indices.push(i);
  if (indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
}
