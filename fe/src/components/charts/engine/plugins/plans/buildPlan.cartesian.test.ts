import { describe, expect, it } from "vitest";
import { buildPlanForType } from "./buildPlan";
import type { ChartViewModel } from "@/components/charts/engine/types";

function vm(chartType: string, rows: unknown[][], columns: string[]): ChartViewModel {
  return {
    chartType,
    styleVariant: "default",
    engine: "antv",
    encoding: {
      dimensions: [{ field: "sale_date", label: null }],
      metrics: [{ field: "amount", label: null }],
    },
    dataset: { rows, columns },
    source: {},
  };
}

describe("buildPlanForType cartesian field mapping", () => {
  const rows = [
    ["2025-01-05", 8999],
    ["2025-01-06", 2598],
  ];
  const columns = ["sale_date", "amount"];

  it("keeps category/value fields for horizontal bar (no axis swap in plan)", () => {
    const plan = buildPlanForType("bar-horizontal", vm("bar-horizontal", rows, columns));
    expect(plan.plotType).toBe("Bar");
    expect(plan.options.isHorizontal).toBe(true);
    expect(plan.options.xField).toBe("__category__");
    expect(plan.options.yField).toBe("__value__");
    const data = plan.options.data as Array<{ __category__: string; __value__: number }>;
    expect(data[0]).toMatchObject({ __category__: "2025-01-05", __value__: 8999 });
  });

  it("keeps category/value fields for vertical column", () => {
    const plan = buildPlanForType("bar", vm("bar", rows, columns));
    expect(plan.plotType).toBe("Column");
    expect(plan.options.xField).toBe("__category__");
    expect(plan.options.yField).toBe("__value__");
  });
});
