import { describe, expect, it } from "vitest";
import {
  inferBipartiteSides,
  seedBipartiteLayout,
  type GraphSimLink,
  type GraphSimNode,
} from "./graphBipartiteLayout";

describe("graphBipartiteLayout", () => {
  it("infers left/right sides from directed edges", () => {
    const links: GraphSimLink[] = [
      { source: "2025-06-01", target: "电话销售" },
      { source: "2025-06-02", target: "线下门店" },
    ];
    const sides = inferBipartiteSides(links);
    expect(sides.leftIds).toEqual(new Set(["2025-06-01", "2025-06-02"]));
    expect(sides.rightIds).toEqual(new Set(["电话销售", "线下门店"]));
  });

  it("seeds source nodes left and target nodes right", () => {
    const nodes: GraphSimNode[] = [
      { id: "2025-06-01", label: "2025-06-01" },
      { id: "电话销售", label: "电话销售" },
      { id: "2025-06-02", label: "2025-06-02" },
      { id: "线下门店", label: "线下门店" },
    ];
    const links: GraphSimLink[] = [
      { source: "2025-06-01", target: "电话销售" },
      { source: "2025-06-02", target: "线下门店" },
    ];
    expect(seedBipartiteLayout(nodes, links, 480, 360)).toBe(true);
    const dates = nodes.filter((node) => node.id.startsWith("2025"));
    const channels = nodes.filter((node) => !node.id.startsWith("2025"));
    expect(dates.every((node) => (node.x ?? 0) < 200)).toBe(true);
    expect(channels.every((node) => (node.x ?? 0) > 280)).toBe(true);
  });
});
