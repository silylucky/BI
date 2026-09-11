import type { SimulationLinkDatum, SimulationNodeDatum } from "d3";

export type GraphMetricNode = SimulationNodeDatum & { id: string };
export type GraphMetricLink = SimulationLinkDatum<GraphMetricNode> & { weight?: number };

export function buildNodeDegreeMap(links: GraphMetricLink[]): Map<string, number> {
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  for (const link of links) {
    const source = typeof link.source === "string" ? link.source : link.source.id;
    const target = typeof link.target === "string" ? link.target : link.target.id;
    bump(source);
    bump(target);
  }
  return degree;
}

export function resolveGraphNodeRadius(degree: number, layoutType: string): number {
  const base = layoutType === "force" ? 7 : 9;
  return Math.min(14, base + Math.sqrt(Math.max(1, degree)));
}

export function resolveGraphLinkWidth(weight: number, maxWeight: number): number {
  const ratio = maxWeight > 0 ? weight / maxWeight : 1;
  return 1 + ratio * 3;
}

export function buildGraphLinkPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  layoutType: string,
): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy) || 1;
  if (layoutType !== "force") {
    return `M${sourceX},${sourceY}L${targetX},${targetY}`;
  }
  const curve = Math.min(36, dist * 0.18);
  const cx = (sourceX + targetX) / 2 + (-dy / dist) * curve;
  const cy = (sourceY + targetY) / 2 + (dx / dist) * curve;
  return `M${sourceX},${sourceY}Q${cx},${cy} ${targetX},${targetY}`;
}
