import { describe, expect, it } from "vitest";
import { buildPlanForType } from "./buildPlan";
import type { ChartViewModel } from "@/components/charts/engine/types";

function quotaVm(rows: unknown[][], columns: string[], metricField: string): ChartViewModel {
  return {
    chartType: "gauge",
    styleVariant: "default",
    engine: "antv",
    encoding: {
      dimensions: [],
      metrics: [{ field: metricField, label: null }],
    },
    dataset: { rows, columns },
    source: {},
  };
}

describe("buildPlanForType quota charts", () => {
  it("gauge aggregates metric across all rows", () => {
    const plan = buildPlanForType(
      "gauge",
      quotaVm(
        [
          [10],
          [20],
          [30],
        ],
        ["amount"],
        "amount",
      ),
    );
    expect(plan.options.rawValue).toBe(60);
  });

  it("liquid aggregates metric across all rows", () => {
    const plan = buildPlanForType(
      "liquid",
      quotaVm(
        [
          [0.2],
          [0.3],
        ],
        ["ratio"],
        "ratio",
      ),
    );
    expect(plan.options.rawValue).toBe(0.5);
    expect(plan.options.rows).toHaveLength(2);
    expect(plan.options.columns).toEqual(["ratio"]);
    expect(plan.options.metricField).toBe("ratio");
  });

  it("kpi passes label dimension for multi-row indicators", () => {
    const plan = buildPlanForType("kpi", {
      chartType: "kpi",
      styleVariant: "default",
      engine: "antv",
      encoding: {
        dimensions: [{ field: "指标", label: null }],
        metrics: [{ field: "数值", label: null }],
      },
      dataset: {
        rows: [
          ["办件量", 1280],
          ["在线率", 92.5],
        ],
        columns: ["指标", "数值"],
      },
      source: {},
    });
    expect(plan.options.labelField).toBe("指标");
    expect(plan.options.metrics).toEqual([{ field: "数值", label: "数值" }]);
  });
});

describe("buildPlanForType scatter encoding", () => {
  it("maps category dimension to category x and value metric to y", () => {
    const plan = buildPlanForType("scatter", {
      chartType: "scatter",
      styleVariant: "default",
      engine: "antv",
      encoding: {
        dimensions: [{ field: "category", label: null }],
        metrics: [{ field: "value", label: null }],
      },
      dataset: {
        rows: [
          ["A", 20],
          ["B", 25],
          ["C", 18],
        ],
        columns: ["category", "value"],
      },
      source: {},
    });
    expect(plan.options.colorField).toBe("series");
    expect(plan.options.xAxisMode).toBe("category");
    expect(plan.options.xCategories).toEqual(["A", "B", "C"]);
    const data = plan.options.data as Array<{ x: string; y: number; series: string }>;
    expect(data[0]).toMatchObject({ x: "A", y: 20, series: "A" });
    expect(data[1]).toMatchObject({ x: "B", y: 25, series: "B" });
    expect(data[2]).toMatchObject({ x: "C", y: 18, series: "C" });
  });
});
