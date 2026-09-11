import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { buildPlanForType } from "@/components/charts/engine/plugins/plans/buildPlan";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { PIE_RADIUS_FRAC_DEFAULT } from "@/components/charts/engine/d3/radial/pieLayout";

describe("piePlan", () => {
  it("pie-donut-rose plan exposes radius constant without ReferenceError", () => {
    const vm = buildChartViewModel(
      {
        chartType: "pie-donut-rose",
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        mode: "sql",
        sql: "SELECT 1",
        dimensions: [{ field: "region" }],
        metrics: [{ field: "amount" }],
      },
      {
        columns: ["region", "amount"],
        rows: [
          ["A", 10],
          ["B", 20],
        ],
      },
    );

    const plan = buildPlanForType("pie-donut-rose", vm);
    expect(plan.plotType).toBe("Pie");
    expect(plan.options.radius).toBe(PIE_RADIUS_FRAC_DEFAULT);
    expect(plan.options.innerRadius).toBe(0.5);
    expect(plan.options.roseType).toBe("radius");
  });

  it("pie-rose plan uses zero inner radius (full rose, not ring)", () => {
    const vm = buildChartViewModel(
      {
        chartType: "pie-rose",
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        mode: "sql",
        sql: "SELECT 1",
        dimensions: [{ field: "region" }],
        metrics: [{ field: "amount" }],
      },
      {
        columns: ["region", "amount"],
        rows: [
          ["A", 10],
          ["B", 20],
        ],
      },
    );

    const plan = buildPlanForType("pie-rose", vm);
    expect(plan.plotType).toBe("Pie");
    expect(plan.options.innerRadius).toBe(0);
    expect(plan.options.roseType).toBe("radius");
  });
});
