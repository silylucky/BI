import { describe, expect, it } from "vitest";
import {
  assignBipartiteEdgeOffsets,
  buildStructuredLinkPath,
  seedBipartiteStructuredLayout,
  seedRingStructuredLayout,
  type StructuredGraphLink,
} from "./graphStructuredLayout";
import type { GraphSimNode } from "./graphBipartiteLayout";

describe("graphStructuredLayout", () => {
  it("places bipartite nodes in separated columns with vertical spacing", () => {
    const nodes: GraphSimNode[] = [
      { id: "d1", label: "d1" },
      { id: "d2", label: "d2" },
      { id: "p1", label: "p1" },
      { id: "p2", label: "p2" },
    ];
    const links: StructuredGraphLink[] = [
      { source: "d1", target: "p1" },
      { source: "d2", target: "p2" },
    ];
    expect(seedBipartiteStructuredLayout(nodes, links, 480, 360)).toBe(true);
    const left = nodes.filter((node) => node.id.startsWith("d"));
    const right = nodes.filter((node) => node.id.startsWith("p"));
    expect(left.every((node) => (node.x ?? 0) < 140)).toBe(true);
    expect(right.every((node) => (node.x ?? 0) > 340)).toBe(true);
    expect(Math.abs((left[0].y ?? 0) - (left[1].y ?? 0))).toBeGreaterThan(20);
  });

  it("fans parallel edges with offsets", () => {
    const links: StructuredGraphLink[] = [
      { source: "a", target: "x" },
      { source: "a", target: "y" },
      { source: "a", target: "z" },
    ];
    assignBipartiteEdgeOffsets(links);
    const offsets = links.map((link) => link.edgeOffset ?? 0);
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });

  it("uses curved paths when edges are offset", () => {
    const path = buildStructuredLinkPath(0, 0, 200, 0, "dagre", 12);
    expect(path.includes("Q")).toBe(true);
  });

  it("seeds ring layout deterministically", () => {
    const nodes: GraphSimNode[] = [
      { id: "a", label: "a" },
      { id: "b", label: "b" },
      { id: "c", label: "c" },
    ];
    seedRingStructuredLayout(nodes, [{ source: "a", target: "b" }], 400, 300);
    const xs = nodes.map((node) => node.x ?? 0);
    expect(new Set(xs.map((x) => Math.round(x))).size).toBeGreaterThan(1);
  });
});
