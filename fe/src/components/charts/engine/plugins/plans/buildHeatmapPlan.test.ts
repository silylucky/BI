import { describe, expect, it } from "vitest";
import { buildPlanForType } from "./buildPlan";
import type { ChartViewModel } from "@/components/charts/engine/types";

describe("heatmapMatrixPlan", () => {
  it("aggregates duplicate x/y cells by summing metric", () => {
    const vm: ChartViewModel = {
      chartType: "t-heatmap",
      styleVariant: "default",
      engine: "d3",
      encoding: {
        dimensions: [{ field: "product", label: null }, { field: "date", label: null }],
        metrics: [{ field: "amount", label: null }],
        axes: {
          xAxis: [{ field: "product" }],
          xAxisExt: [{ field: "date" }],
          yAxis: [{ field: "amount" }],
        },
      },
      dataset: {
        columns: ["product", "date", "amount"],
        rows: [
          ["A4打印纸", "2025-05-22", 890],
          ["A4打印纸", "2025-05-22", 1780],
          ["平板", "2025-07-01", 100],
        ],
      },
      source: {},
    };
    const plan = buildPlanForType("t-heatmap", vm);
    const data = plan.options.data as Array<{ x: string; y: string; value: number }>;
    expect(data).toHaveLength(2);
    const merged = data.find((d) => d.x === "A4打印纸" && d.y === "2025-05-22");
    expect(merged?.value).toBe(2670);
  });
});
