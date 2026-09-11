import { describe, expect, it } from "vitest";
import {
  buildCustomVizAxisPlan,
  measureCustomVizHost,
  thinCategoryTickIndices,
} from "./customVizLayoutHelpers";

describe("thinCategoryTickIndices", () => {
  it("returns all indices when categories fit inner width", () => {
    expect(thinCategoryTickIndices(5, 400, 56)).toEqual([0, 1, 2, 3, 4]);
  });

  it("thins dense categories and keeps last index", () => {
    const indices = thinCategoryTickIndices(40, 320, 56);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(39);
    expect(indices.length).toBeLessThan(40);
    expect(indices.length).toBeGreaterThan(1);
  });
});

describe("buildCustomVizAxisPlan", () => {
  it("subtracts chart padding from layout width", () => {
    const plan = buildCustomVizAxisPlan(40, 320, 56);
    expect(plan?.categoryCount).toBe(40);
    expect(plan?.categoryTickIndices?.[0]).toBe(0);
    expect(plan?.categoryTickIndices?.at(-1)).toBe(39);
    expect(plan?.categoryTickIndices?.length).toBeLessThan(40);
  });
});

describe("measureCustomVizHost", () => {
  it("reads rounded bounding rect", () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ width: 480.6, height: 240.2, top: 0, left: 0, right: 0, bottom: 0 }),
    });
    expect(measureCustomVizHost(host)).toEqual({ width: 481, height: 240 });
  });
});
