import { describe, expect, it } from "vitest";
import { migrateChartViewConfig } from "@/lib/migrateChartTypes";

describe("migrateChartViewConfig", () => {
  it("migrates legacy table to table-info", () => {
    const next = migrateChartViewConfig({ chartType: "table" });
    expect(next.chartType).toBe("table-info");
  });

  it("migrates bar stacked variant to bar-stack", () => {
    const next = migrateChartViewConfig({
      chartType: "bar",
      styleVariant: "stacked",
    });
    expect(next.chartType).toBe("bar-stack");
    expect(next.styleVariant).toBe("default");
  });

  it("migrates combo to chart-mix", () => {
    const next = migrateChartViewConfig({ chartType: "combo" });
    expect(next.chartType).toBe("chart-mix");
  });

  it("migrates timeline to smooth line", () => {
    const next = migrateChartViewConfig({ chartType: "timeline" });
    expect(next.chartType).toBe("line");
    expect(next.styleVariant).toBe("smooth");
  });

  it("migrates legacy heatmap to t-heatmap", () => {
    const next = migrateChartViewConfig({ chartType: "heatmap" });
    expect(next.chartType).toBe("t-heatmap");
  });

  it("migrates legacy wordCloud to word-cloud", () => {
    const next = migrateChartViewConfig({ chartType: "wordCloud" });
    expect(next.chartType).toBe("word-cloud");
  });

  it("remaps leftover Chinese SQL aliases on axes", () => {
    const next = migrateChartViewConfig({
      chartType: "table-info",
      axes: {
        xAxis: [{ field: "网格" }, { field: "事件数" }, { field: "已办结" }],
      },
    });
    expect(next.axes?.xAxis?.map((item) => item.field)).toEqual([
      "grid_name",
      "event_count",
      "resolved_count",
    ]);
  });

  it("preserves deFeatures when stripping leftover sql nativeBody", () => {
    const next = migrateChartViewConfig({
      chartType: "bar-group",
      dataSourceId: "ds-1",
      configId: "cfg-1",
      sql: "SELECT 1",
      nativeBody: {
        leftoverQuery: { sql: "SELECT 1" },
        deFeatures: {
          markLines: [{ id: "l1", enabled: true, axis: "y", value: 10 }],
        },
        deDisplay: { resultLimit: 100 },
      },
    });
    expect(next.sql).toBeUndefined();
    expect(next.nativeBody?.leftoverQuery).toBeUndefined();
    expect(next.nativeBody?.deFeatures).toEqual({
      markLines: [{ id: "l1", enabled: true, axis: "y", value: 10 }],
    });
    expect(next.nativeBody?.deDisplay).toEqual({ resultLimit: 100 });
  });

  it("forces dataset mode and clears legacy sql binding", () => {
    const next = migrateChartViewConfig({
      chartType: "line",
      dataSourceId: "ds-1",
      sql: "SELECT 1",
    });
    expect(next.mode).toBe("dataset");
    expect(next.sql).toBeUndefined();
    expect(next.bindingId).toBeUndefined();
  });

  it("keeps dataset mode and clears sql when configId missing", () => {
    const next = migrateChartViewConfig({
      chartType: "line",
      mode: "dataset",
      dataSourceId: "ds-1",
      sql: "SELECT 1",
    });
    expect(next.mode).toBe("dataset");
    expect(next.sql).toBeUndefined();
  });
});
