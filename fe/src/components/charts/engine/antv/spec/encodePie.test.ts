import { describe, expect, it } from "vitest";
import { encodePieRows, applyPieMergeTopN } from "./encodePie";
import type { RenderSpec } from "@/components/charts/engine/types";

const spec: RenderSpec = {
  engine: "antv",
  chartType: "pie",
  styleVariant: "default",
  encoding: {
    dimensions: [{ field: "region", label: null }],
    metrics: [{ field: "amount", label: null }],
  },
  source: {},
};

describe("encodePieRows", () => {
  it("aggregates duplicate dimension values", () => {
    const rows = [
      ["华东", 10],
      ["华东", 5],
      ["华北", 8],
    ];
    const columns = ["region", "amount"];
    expect(encodePieRows(spec, rows, columns)).toEqual([
      { type: "华东", value: 15 },
      { type: "华北", value: 8 },
    ]);
  });
});

describe("applyPieMergeTopN", () => {
  it("keeps top N and merges the rest", () => {
    const rows = [
      { type: "a", value: 10 },
      { type: "b", value: 8 },
      { type: "c", value: 6 },
      { type: "d", value: 4 },
    ];
    expect(applyPieMergeTopN(rows, { topN: 2, otherLabel: "其他" })).toEqual([
      { type: "a", value: 10 },
      { type: "b", value: 8 },
      { type: "其他", value: 10 },
    ]);
  });
});
