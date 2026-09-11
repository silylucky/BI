import { describe, expect, it } from "vitest";
import {
  barRangePlan,
  bulletGraphPlan,
  progressBarPlan,
  stockLinePlan,
} from "./buildComparePlans";
import type { RenderSpec } from "@/components/charts/engine/types";

const baseSpec = (metrics: string[], dim = "category"): RenderSpec => ({
  engine: "antv",
  chartType: "bar",
  styleVariant: "default",
  encoding: {
    dimensions: [{ field: dim, label: null }],
    metrics: metrics.map((field) => ({ field, label: null })),
  },
  source: {},
});

describe("buildComparePlans", () => {
  const rows = [
    ["A", 10, 30, 5, 35],
    ["B", 20, 25, 15, 28],
  ];
  const columns = ["category", "open", "close", "low", "high"];

  it("barRangePlan encodes low/high interval", () => {
    const plan = barRangePlan(baseSpec(["low", "high"]), rows, ["category", "low", "high"]);
    expect(plan.plotType).toBe("BarRange");
    expect(plan.options.data).toEqual([
      { type: "A", low: 10, high: 30 },
      { type: "B", low: 20, high: 25 },
    ]);
  });

  it("progressBarPlan computes completion from target and current metrics", () => {
    const progressRows = [
      ["A", 100, 10],
      ["B", 100, 20],
    ];
    const plan = progressBarPlan(
      baseSpec(["target", "current"]),
      progressRows,
      ["category", "target", "current"],
    );
    expect(plan.plotType).toBe("ProgressBar");
    expect(plan.options.data).toEqual([
      { type: "A", value: 10, target: 100, progress: 10, max: 100 },
      { type: "B", value: 20, target: 100, progress: 20, max: 100 },
    ]);
  });

  it("bulletGraphPlan encodes actual/target/rangeMax", () => {
    const plan = bulletGraphPlan(
      baseSpec(["actual", "target", "rangeMax"]),
      [
        ["North", 80, 100, 120],
        ["South", 60, 70, 100],
      ],
      ["category", "actual", "target", "rangeMax"],
    );
    expect(plan.plotType).toBe("Bullet");
    expect(plan.options.data).toEqual([
      { type: "North", actual: 80, target: 100, rangeMax: 120 },
      { type: "South", actual: 60, target: 70, rangeMax: 100 },
    ]);
  });

  it("stockLinePlan encodes OHLC", () => {
    const plan = stockLinePlan(baseSpec(["open", "close", "low", "high"]), rows, columns);
    expect(plan.plotType).toBe("Stock");
    expect(plan.options.data?.[0]).toMatchObject({ type: "A", open: 10, close: 30, low: 5, high: 35 });
  });
});
