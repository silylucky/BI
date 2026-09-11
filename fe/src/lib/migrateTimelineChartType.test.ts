import { describe, expect, it } from "vitest";
import { migrateLayoutTimelineCharts, migrateTimelineChartConfig } from "./migrateTimelineChartType";

describe("migrateTimelineChartType", () => {
  it("converts timeline chartConfig to line", () => {
    const next = migrateTimelineChartConfig({
      chartType: "timeline",
      dimensions: [{ field: "dt" }],
      metrics: [{ field: "v" }],
    });
    expect(next.chartType).toBe("line");
    expect(next.dimensions).toEqual([{ field: "dt" }]);
  });

  it("walks layoutJson widgets", () => {
    const layout = {
      version: 1,
      widgets: [{ id: "w1", type: "chart", chartConfig: { chartType: "timeline" } }],
    };
    const migrated = migrateLayoutTimelineCharts(layout) as typeof layout;
    expect(migrated.widgets[0].chartConfig.chartType).toBe("line");
  });
});
