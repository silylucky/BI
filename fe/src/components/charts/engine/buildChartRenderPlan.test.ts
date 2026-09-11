import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { buildChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartViewModel } from "@/components/charts/engine/types";

function vm(chartType: string): ChartViewModel {
  return {
    chartType,
    styleVariant: "default",
    engine: "antv",
    encoding: { dimensions: [{ field: "x" }], metrics: [{ field: "y" }] },
    dataset: { columns: ["x", "y"], rows: [["a", 1]] },
    source: {},
  };
}

describe("buildChartRenderPlan", () => {
  it("returns d3 plan for line chart", () => {
    const plan = buildChartRenderPlan(vm("line"));
    expect(plan.kind).toBe("d3");
    expect(plan.plotType).toBe("Line");
  });

  it("returns d3 plan for table-info", () => {
    const plan = buildChartRenderPlan(vm("table-info"));
    expect(plan.kind).toBe("d3");
    expect(plan.plotType).toBe("TableInfo");
  });
});
