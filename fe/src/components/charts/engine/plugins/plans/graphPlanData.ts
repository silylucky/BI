import {
  GRAPH_EDGE_CAP,
  GRAPH_NODE_CAP,
} from "@/components/charts/engine/buildDatasetEncoding";

export type GraphEdgeRow = { source: string; target: string; weight: number };

export type GraphPlanData = {
  nodes: Array<{ id: string; data: { label: string } }>;
  edges: GraphEdgeRow[];
  truncated: boolean;
};

function colIndex(columns: string[], field: string): number {
  return columns.indexOf(field);
}

function trimGraphByCaps(edges: GraphEdgeRow[], maxEdges: number, maxNodes: number): GraphPlanData {
  let ranked = [...edges].sort((a, b) => b.weight - a.weight);
  let truncated = ranked.length > maxEdges;
  ranked = ranked.slice(0, maxEdges);

  const nodeIds = new Set<string>();
  for (const edge of ranked) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  while (nodeIds.size > maxNodes && ranked.length > 0) {
    truncated = true;
    ranked.pop();
    nodeIds.clear();
    for (const edge of ranked) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  return {
    nodes: [...nodeIds].map((id) => ({ id, data: { label: id } })),
    edges: ranked,
    truncated,
  };
}

export function aggregateGraphFromRows(
  rows: unknown[][],
  columns: string[],
  srcField: string,
  dstField: string,
  metricField: string,
): GraphPlanData {
  const si = colIndex(columns, srcField);
  const di = colIndex(columns, dstField);
  const mi = metricField ? colIndex(columns, metricField) : -1;
  const edgeWeights = new Map<string, number>();

  for (const row of rows) {
    const source = String(row[si] ?? "").trim();
    const target = String(row[di] ?? "").trim();
    if (!source || !target) continue;
    const key = `${source}\0${target}`;
    const weight = mi >= 0 ? Number(row[mi] ?? 0) : 1;
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + (Number.isFinite(weight) ? weight : 0));
  }

  const edges: GraphEdgeRow[] = [...edgeWeights.entries()].map(([key, weight]) => {
    const [source, target] = key.split("\0");
    return { source, target, weight: weight > 0 ? weight : 1 };
  });

  const truncated = rows.length > 0 && edges.length > GRAPH_EDGE_CAP;
  return trimGraphByCaps(edges, GRAPH_EDGE_CAP, GRAPH_NODE_CAP);
}
