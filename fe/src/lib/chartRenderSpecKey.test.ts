import { describe, expect, it } from "vitest";
import { chartRenderSpecKey } from "./chartRenderSpecKey";
import type { ChartViewConfig } from "./chartViewConfig";

const base: ChartViewConfig = {
  chartType: "funnel",
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  mode: "sql",
  sql: "SELECT 1",
  dimensions: [{ field: "stage" }],
  metrics: [{ field: "value" }],
};

describe("chartRenderSpecKey", () => {
  it("is stable for equivalent configs", () => {
    expect(chartRenderSpecKey({ ...base })).toBe(chartRenderSpecKey({ ...base }));
  });

  it("changes when chart type changes", () => {
    expect(chartRenderSpecKey(base)).not.toBe(
      chartRenderSpecKey({ ...base, chartType: "gauge" }),
    );
  });
});
