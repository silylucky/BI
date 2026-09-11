import type { SimulationLinkDatum, SimulationNodeDatum } from "d3";

export type GraphSimNode = SimulationNodeDatum & { id: string; label: string };
export type GraphSimLink = SimulationLinkDatum<GraphSimNode>;

export type BipartiteSides = {
  leftIds: Set<string>;
  rightIds: Set<string>;
  middleIds: Set<string>;
};

export function inferBipartiteSides(links: GraphSimLink[]): BipartiteSides {
  const sources = new Set<string>();
  const targets = new Set<string>();
  for (const link of links) {
    const source = typeof link.source === "string" ? link.source : link.source.id;
    const target = typeof link.target === "string" ? link.target : link.target.id;
    sources.add(source);
    targets.add(target);
  }
  const leftIds = new Set<string>();
  const rightIds = new Set<string>();
  const middleIds = new Set<string>();
  for (const id of sources) {
    if (targets.has(id)) middleIds.add(id);
    else leftIds.add(id);
  }
  for (const id of targets) {
    if (sources.has(id)) middleIds.add(id);
    else rightIds.add(id);
  }
  return { leftIds, rightIds, middleIds };
}

function sortByDegree(ids: string[], degree: Map<string, number>): string[] {
  return [...ids].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
}

function buildDegreeMap(links: GraphSimLink[]): Map<string, number> {
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

/** 关系图默认：起点列在左、终点列在右，边从列间穿过而非绕圆心。 */
export function seedBipartiteLayout(
  nodes: GraphSimNode[],
  links: GraphSimLink[],
  width: number,
  height: number,
): boolean {
  if (links.length === 0 || nodes.length < 2) return false;
  const { leftIds, rightIds, middleIds } = inferBipartiteSides(links);
  if (leftIds.size === 0 || rightIds.size === 0) return false;

  const degree = buildDegreeMap(links);
  const padY = Math.max(28, Math.min(56, height * 0.08));
  const placeColumn = (ids: string[], x: number) => {
    const ordered = sortByDegree(ids, degree);
    ordered.forEach((id, index) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;
      const spread = Math.max(1, height - padY * 2);
      node.x = x;
      node.y = padY + (spread * (index + 1)) / (ordered.length + 1);
    });
  };

  placeColumn([...leftIds], width * 0.18);
  placeColumn([...rightIds], width * 0.82);
  placeColumn([...middleIds], width * 0.5);

  for (const node of nodes) {
    if (node.x == null || node.y == null) {
      node.x = width / 2 + (Math.random() - 0.5) * width * 0.08;
      node.y = height / 2 + (Math.random() - 0.5) * height * 0.08;
    }
  }
  return true;
}

export function resolveBipartiteTargetX(
  nodeId: string,
  sides: BipartiteSides,
  width: number,
): number {
  if (sides.leftIds.has(nodeId)) return width * 0.18;
  if (sides.rightIds.has(nodeId)) return width * 0.82;
  if (sides.middleIds.has(nodeId)) return width * 0.5;
  return width / 2;
}
