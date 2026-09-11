import type { SimulationLinkDatum, SimulationNodeDatum } from "d3";
import {
  inferBipartiteSides,
  type GraphSimLink,
  type GraphSimNode,
} from "./graphBipartiteLayout";

export type StructuredGraphLink = SimulationLinkDatum<GraphSimNode> & {
  weight?: number;
  edgeOffset?: number;
};

function linkEndpointId(endpoint: string | GraphSimNode): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function buildDegreeMap(links: GraphSimLink[]): Map<string, number> {
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  for (const link of links) {
    bump(linkEndpointId(link.source));
    bump(linkEndpointId(link.target));
  }
  return degree;
}

function sortByDegree(ids: string[], degree: Map<string, number>): string[] {
  return [...ids].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
}

/** 在可用高度内等距排布，保证节点不超出画布。 */
function columnYPositions(count: number, height: number, padY: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [height / 2];
  const usable = Math.max(1, height - padY * 2);
  const step = usable / (count - 1);
  return Array.from({ length: count }, (_, index) => padY + step * index);
}

/** 起点/终点分列，纵向等距，避免节点堆叠。 */
export function seedBipartiteStructuredLayout(
  nodes: GraphSimNode[],
  links: GraphSimLink[],
  width: number,
  height: number,
): boolean {
  if (links.length === 0 || nodes.length < 2) return false;
  const { leftIds, rightIds, middleIds } = inferBipartiteSides(links);
  if (leftIds.size === 0 || rightIds.size === 0) return false;

  const degree = buildDegreeMap(links);
  const padY = Math.max(32, Math.min(64, height * 0.08));

  const placeColumn = (ids: string[], x: number) => {
    const ordered = sortByDegree(ids, degree);
    const ys = columnYPositions(ordered.length, height, padY);
    ordered.forEach((id, index) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;
      node.x = x;
      node.y = ys[index] ?? height / 2;
    });
  };

  placeColumn([...leftIds], width * 0.18);
  placeColumn([...rightIds], width * 0.82);
  placeColumn([...middleIds], width * 0.5);

  for (const node of nodes) {
    if (node.x == null || node.y == null) {
      node.x = width / 2;
      node.y = height / 2;
    }
  }
  return true;
}

/** 非二分图：按度数排序后环形等距排布，避免随机一团。 */
export function seedRingStructuredLayout(
  nodes: GraphSimNode[],
  links: GraphSimLink[],
  width: number,
  height: number,
): void {
  const degree = buildDegreeMap(links);
  const ordered = sortByDegree(
    nodes.map((node) => node.id),
    degree,
  );
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  ordered.forEach((id, index) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    const angle = (Math.PI * 2 * index) / ordered.length - Math.PI / 2;
    node.x = cx + radius * Math.cos(angle);
    node.y = cy + radius * Math.sin(angle);
  });
}

export function assignBipartiteEdgeOffsets(links: StructuredGraphLink[]): void {
  const bySource = new Map<string, StructuredGraphLink[]>();
  for (const link of links) {
    const source = linkEndpointId(link.source);
    const bucket = bySource.get(source) ?? [];
    bucket.push(link);
    bySource.set(source, bucket);
  }
  for (const bucket of bySource.values()) {
    bucket.sort((a, b) => linkEndpointId(a.target).localeCompare(linkEndpointId(b.target)));
    const spread = Math.min(28, 6 + bucket.length * 2);
    bucket.forEach((link, index) => {
      link.edgeOffset = bucket.length <= 1 ? 0 : (index - (bucket.length - 1) / 2) * (spread / bucket.length);
    });
  }
}

export function buildStructuredLinkPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  layoutType: string,
  edgeOffset = 0,
): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy) || 1;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2 + edgeOffset;
  if (layoutType === "dagre" || Math.abs(edgeOffset) > 0.5) {
    return `M${sourceX},${sourceY}Q${midX},${midY} ${targetX},${targetY}`;
  }
  return `M${sourceX},${sourceY}L${targetX},${targetY}`;
}
