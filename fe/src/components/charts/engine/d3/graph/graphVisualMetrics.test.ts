import { describe, expect, it } from "vitest";
import {
  buildGraphLinkPath,
  buildNodeDegreeMap,
  resolveGraphLinkWidth,
  resolveGraphNodeRadius,
} from "./graphVisualMetrics";

describe("graphVisualMetrics", () => {
  it("builds node degree from links", () => {
    const degree = buildNodeDegreeMap([
      { source: "a", target: "b", weight: 1 },
      { source: "b", target: "c", weight: 2 },
    ]);
    expect(degree.get("a")).toBe(1);
    expect(degree.get("b")).toBe(2);
    expect(degree.get("c")).toBe(1);
  });

  it("scales node radius by degree in force layout", () => {
    expect(resolveGraphNodeRadius(1, "force")).toBeLessThan(resolveGraphNodeRadius(6, "force"));
  });

  it("scales link width by weight", () => {
    expect(resolveGraphLinkWidth(10, 100)).toBeLessThan(resolveGraphLinkWidth(80, 100));
  });

  it("uses curved paths for force layout", () => {
    const path = buildGraphLinkPath(0, 0, 100, 0, "force");
    expect(path.startsWith("M")).toBe(true);
    expect(path.includes("Q")).toBe(true);
  });
});
