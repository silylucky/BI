import { describe, expect, it } from "vitest";
import {
  pickGraphVisibleLabelIds,
  pickSankeyVisibleLabelIds,
  pickTreemapVisibleLabelKeys,
  treemapLeafLabelKey,
  pickVerticalStackIndicesWithoutOverlap,
  verticalLabelBandHeight,
} from "@/components/charts/engine/d3/core/nodeLabelThinning";
import { anyVerticalBandsOverlap } from "@/components/charts/engine/d3/core/labelOverlap";

describe("nodeLabelThinning", () => {
  it("keeps all labels when vertical spacing is enough", () => {
    const count = 12;
    const fontSize = 11;
    const band = verticalLabelBandHeight(fontSize);
    const indices = pickVerticalStackIndicesWithoutOverlap(
      count,
      (index) => index * (band + 4),
      (index) => `2025-06-${String(index + 1).padStart(2, "0")}`,
      fontSize,
    );
    expect(indices.length).toBe(count);
  });

  it("thins dense vertical stacks without overlap", () => {
    const count = 24;
    const fontSize = 11;
    const indices = pickVerticalStackIndicesWithoutOverlap(
      count,
      (index) => index * 6,
      (index) => `2025-06-${String(index + 1).padStart(2, "0")}`,
      fontSize,
    );
    expect(indices.length).toBeLessThan(count);
    const half = verticalLabelBandHeight(fontSize) / 2;
    const bands = indices.map((index) => {
      const y = index * 6;
      return { top: y - half, bottom: y + half };
    });
    expect(anyVerticalBandsOverlap(bands)).toBe(false);
  });

  it("keeps more sankey labels when nodes are not extremely dense", () => {
    const nodes = Array.from({ length: 20 }, (_, index) => ({
      id: `2025-06-${String(index + 1).padStart(2, "0")}`,
      depth: 1,
      y: index * 14,
      height: 6,
    }));
    const visible = pickSankeyVisibleLabelIds(nodes, 10);
    expect(visible.size).toBeGreaterThan(8);
  });

  it("thins dense sankey columns independently", () => {
    const nodes = Array.from({ length: 20 }, (_, index) => ({
      id: `2025-06-${String(index + 1).padStart(2, "0")}`,
      depth: 1,
      y: index * 7,
      height: 4,
    }));
    const visible = pickSankeyVisibleLabelIds(nodes, 10);
    expect(visible.size).toBeGreaterThan(0);
    expect(visible.size).toBeLessThan(nodes.length);
  });

  it("keeps all treemap labels when bboxes do not overlap", () => {
    const leaves = [
      { data: { name: "a" }, x0: 0, y0: 0, x1: 120, y1: 80, value: 40 },
      { data: { name: "b" }, x0: 130, y0: 0, x1: 250, y1: 80, value: 40 },
      { data: { name: "c" }, x0: 0, y0: 90, x1: 120, y1: 170, value: 40 },
    ];
    const visible = pickTreemapVisibleLabelKeys({
      leaves,
      fontSize: 12,
      labelLinesFor: (leaf) => [leaf.data.name],
    });
    expect(visible.size).toBe(3);
  });

  it("thins crowded treemap labels by cell area priority", () => {
    const leaves = [
      { data: { name: "big" }, x0: 0, y0: 0, x1: 180, y1: 120, value: 80 },
      ...Array.from({ length: 12 }, (_, index) => ({
        data: { name: `small-${index}` },
        x0: 180 + index * 10,
        y0: 0,
        x1: 190 + index * 10,
        y1: 18,
        value: 2,
      })),
    ];
    const visible = pickTreemapVisibleLabelKeys({
      leaves,
      fontSize: 12,
      labelLinesFor: (leaf) => [leaf.data.name, "1,234", "12.3%"],
    });
    expect(visible.has(treemapLeafLabelKey(leaves[0]!))).toBe(true);
    expect(visible.size).toBeLessThan(leaves.length);
  });

  it("thins bipartite graph columns vertically", () => {
    const leftIds = new Set(Array.from({ length: 18 }, (_, index) => `left-${index}`));
    const rightIds = new Set(["right-a", "right-b", "right-c", "right-d"]);
    const nodes = [
      ...[...leftIds].map((id, index) => ({
        id,
        label: `2025-06-${String(index + 1).padStart(2, "0")}`,
        x: 40,
        y: 20 + index * 8,
      })),
      ...[...rightIds].map((id, index) => ({
        id,
        label: `渠道-${index}`,
        x: 280,
        y: 40 + index * 48,
      })),
    ];
    const visible = pickGraphVisibleLabelIds({
      nodes,
      fontSize: 11,
      nodeRadius: () => 6,
      nodeDegree: new Map(nodes.map((node) => [node.id, 1])),
      leftIds,
      rightIds,
    });
    const leftVisible = [...visible].filter((id) => leftIds.has(id));
    expect(leftVisible.length).toBeGreaterThan(0);
    expect(leftVisible.length).toBeLessThan(leftIds.size);
    expect([...visible].filter((id) => rightIds.has(id)).length).toBe(rightIds.size);
  });
});
