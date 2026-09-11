import * as d3 from "d3";

type FitNode = { x?: number; y?: number };

export function computeGraphContentBounds(
  nodes: FitNode[],
  showLabel: boolean,
  labelFontSize: number,
  nodeRadius = 12,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (nodes.length === 0) return null;
  const padX = nodeRadius + 6;
  const padTop = nodeRadius + 4;
  const padBottom = nodeRadius + (showLabel ? labelFontSize + 10 : 4);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    minX = Math.min(minX, x - padX);
    maxX = Math.max(maxX, x + padX);
    minY = Math.min(minY, y - padTop);
    maxY = Math.max(maxY, y + padBottom);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

export function buildGraphFitTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  width: number,
  height: number,
  padding = 24,
): d3.ZoomTransform {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((width - padding * 2) / bw, (height - padding * 2) / bh, 1.2);
  const tx = width / 2 - (scale * (bounds.minX + bounds.maxX)) / 2;
  const ty = height / 2 - (scale * (bounds.minY + bounds.maxY)) / 2;
  return d3.zoomIdentity.translate(tx, ty).scale(scale);
}
