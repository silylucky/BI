import { describe, expect, it } from "vitest";
import { barRangePlan, stockLinePlan } from "@/components/charts/engine/plugins/plans/buildComparePlans";
import { encodePieRows } from "@/components/charts/engine/antv/spec/encodePie";
import { sanitizeChartFieldsForValidate } from "@/lib/chartFieldRules";
import { writeAxisField } from "@/lib/resolveChartEncoding";
import type { RenderSpec } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

function axesOnlySpec(
  chartType: string,
  axes: RenderSpec["encoding"]["axes"],
): RenderSpec {
  return {
    engine: "antv",
    chartType,
    styleVariant: "default",
    encoding: { dimensions: [], metrics: [], axes },
    source: {},
  };
}

describe("DE axes-only encoding path", () => {
  it("barRangePlan reads yAxis/yAxisExt from axes without legacy metrics", () => {
    const spec = axesOnlySpec("bar-range", {
      xAxis: [{ field: "category" }],
      yAxis: [{ field: "low" }],
      yAxisExt: [{ field: "high" }],
    });
    const plan = barRangePlan(spec, [
      ["A", 10, 30],
      ["B", 20, 25],
    ], ["category", "low", "high"]);
    expect(plan.options.data).toEqual([
      { type: "A", low: 10, high: 30 },
      { type: "B", low: 20, high: 25 },
    ]);
  });

  it("stockLinePlan reads four yAxis slots from axes", () => {
    const spec = axesOnlySpec("stock-line", {
      xAxis: [{ field: "date" }],
      yAxis: [
        { field: "open" },
        { field: "close" },
        { field: "low" },
        { field: "high" },
      ],
    });
    const plan = stockLinePlan(
      spec,
      [["2025-01-01", 10, 12, 8, 14]],
      ["date", "open", "close", "low", "high"],
    );
    expect(plan.options.data?.[0]).toMatchObject({
      type: "2025-01-01",
      open: 10,
      close: 12,
      low: 8,
      high: 14,
    });
  });

  it("encodePieRows reads word-cloud label and weight from axes", () => {
    const spec = axesOnlySpec("word-cloud", {
      xAxis: [{ field: "keyword" }],
      yAxis: [{ field: "weight" }],
    });
    expect(
      encodePieRows(
        spec,
        [
          ["foo", 3],
          ["bar", 5],
        ],
        ["keyword", "weight"],
      ),
    ).toEqual([
      { type: "foo", value: 3 },
      { type: "bar", value: 5 },
    ]);
  });

  it("sanitizeChartFieldsForValidate persists trimmed axes and synced legacy", () => {
    let cfg: ChartViewConfig = {
      chartType: "kpi",
      mode: "sql",
      sql: "SELECT 1",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
    };
    cfg = writeAxisField(cfg, { axisId: "yAxis", index: 0 }, "amount");
    const sanitized = sanitizeChartFieldsForValidate(cfg);
    expect(sanitized.axes?.yAxis?.[0]?.field).toBe("amount");
    expect(sanitized.metrics?.[0]?.field).toBe("amount");
  });
});
