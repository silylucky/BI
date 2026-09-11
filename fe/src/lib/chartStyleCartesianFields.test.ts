import { describe, expect, it } from "vitest";
import { resolveCategoryLabelAxisSides } from "./chartStyleCartesianFields";

describe("resolveCategoryLabelAxisSides", () => {
  it("returns x for vertical cartesian charts", () => {
    expect(resolveCategoryLabelAxisSides("line")).toEqual(["x"]);
    expect(resolveCategoryLabelAxisSides("bar")).toEqual(["x"]);
    expect(resolveCategoryLabelAxisSides("combo")).toEqual(["x"]);
  });

  it("returns y for horizontal bar charts", () => {
    expect(resolveCategoryLabelAxisSides("bar-horizontal")).toEqual(["y"]);
    expect(resolveCategoryLabelAxisSides("progress-bar")).toEqual(["y"]);
    expect(resolveCategoryLabelAxisSides("bidirectional-bar")).toEqual(["y"]);
  });

  it("returns both axes for heatmap", () => {
    expect(resolveCategoryLabelAxisSides("heatmap")).toEqual(["x", "y"]);
  });

  it("returns none for numeric dual-axis scatter charts", () => {
    expect(resolveCategoryLabelAxisSides("scatter")).toEqual([]);
    expect(resolveCategoryLabelAxisSides("quadrant")).toEqual([]);
    expect(resolveCategoryLabelAxisSides("multi-scatter")).toEqual([]);
  });
});
