import { describe, expect, it } from "vitest";
import { aggregateGraphFromRows } from "./graphPlanData";
import { GRAPH_EDGE_CAP, GRAPH_NODE_CAP } from "@/components/charts/engine/buildDatasetEncoding";

describe("aggregateGraphFromRows", () => {
  it("aggregates duplicate edges by weight", () => {
    const rows = [
      ["A", "B", 2],
      ["A", "B", 3],
      ["A", "C", 1],
    ];
    const graph = aggregateGraphFromRows(rows, ["src", "dst", "amt"], "src", "dst", "amt");
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { source: "A", target: "B", weight: 5 },
        { source: "A", target: "C", weight: 1 },
      ]),
    );
  });

  it("keeps strongest edges when exceeding caps", () => {
    const rows = Array.from({ length: GRAPH_EDGE_CAP + 40 }, (_, index) => [
      `S${index}`,
      `T${index}`,
      index + 1,
    ]);
    const graph = aggregateGraphFromRows(rows, ["src", "dst", "amt"], "src", "dst", "amt");
    expect(graph.edges.length).toBeLessThanOrEqual(GRAPH_EDGE_CAP);
    expect(graph.nodes.length).toBeLessThanOrEqual(GRAPH_NODE_CAP);
    expect(graph.truncated).toBe(true);
  });
});
