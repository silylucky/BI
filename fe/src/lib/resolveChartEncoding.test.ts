import { describe, expect, it } from "vitest";
import {
  appendAxisField,
  deAxisRenderReady,
  migrateChartConfigToDeAxes,
  remapMixAxisSlots,
  removeAxisFieldAt,
  resolveChartEncoding,
  writeAxisField,
} from "@/lib/resolveChartEncoding";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("resolveChartEncoding", () => {
  it("migrates legacy dimensions/metrics to axes", () => {
    const config: ChartViewConfig = {
      chartType: "line",
      dimensions: [{ field: "category" }, { field: "sub" }],
      metrics: [{ field: "value" }],
    };
    const encoding = resolveChartEncoding(config);
    expect(encoding.axes.xAxis?.[0]?.field).toBe("category");
    expect(encoding.axes.xAxisExt?.[0]?.field).toBe("sub");
    expect(encoding.axes.yAxis?.[0]?.field).toBe("value");
    expect(encoding.dimensions.map((d) => d.field)).toContain("category");
    expect(encoding.metrics.map((m) => m.field)).toContain("value");
  });

  it("preserves metric and dimension labels when migrating to axes", () => {
    const config: ChartViewConfig = {
      chartType: "line",
      dimensions: [{ field: "d", label: "日期" }],
      metrics: [{ field: "cnt", label: "数量" }],
    };
    const encoding = resolveChartEncoding(config);
    expect(encoding.axes.yAxis?.[0]).toEqual({ field: "cnt", label: "数量" });
    expect(encoding.metrics[0]).toEqual({ field: "cnt", label: "数量" });
    expect(encoding.axes.xAxis?.[0]).toEqual({ field: "d", label: "日期" });
  });

  it("stock-line maps four metrics to yAxis indices", () => {
    const config: ChartViewConfig = {
      chartType: "stock-line",
      dimensions: [{ field: "date" }],
      metrics: [{ field: "open" }, { field: "close" }, { field: "low" }, { field: "high" }],
    };
    const migrated = migrateChartConfigToDeAxes(config);
    expect(migrated.axes?.yAxis?.map((f) => f.field)).toEqual(["open", "close", "low", "high"]);
    expect(deAxisRenderReady(migrated)).toBe(true);
  });

  it("kpi has no dimension requirement", () => {
    const config: ChartViewConfig = {
      chartType: "kpi",
      metrics: [{ field: "value" }],
    };
    expect(deAxisRenderReady(migrateChartConfigToDeAxes(config))).toBe(true);
  });

  it("multi-scatter requires color, Y and X axes", () => {
    const incomplete: ChartViewConfig = {
      chartType: "multi-scatter",
      dimensions: [{ field: "color" }],
      metrics: [{ field: "y" }],
    };
    expect(deAxisRenderReady(migrateChartConfigToDeAxes(incomplete))).toBe(false);

    const complete: ChartViewConfig = {
      chartType: "multi-scatter",
      dimensions: [{ field: "color" }],
      metrics: [{ field: "y" }, { field: "x" }],
    };
    expect(deAxisRenderReady(migrateChartConfigToDeAxes(complete))).toBe(true);
  });

  it("table-info appends multiple xAxis columns and syncs legacy fields", () => {
    let config: ChartViewConfig = { chartType: "table-info" };
    config = appendAxisField(config, "xAxis", "region");
    config = appendAxisField(config, "xAxis", "amount");
    config = appendAxisField(config, "xAxis", "sale_date");

    const encoding = resolveChartEncoding(config);
    expect(encoding.axes.xAxis?.map((r) => r.field)).toEqual(["region", "amount", "sale_date"]);
    expect(encoding.dimensions.map((d) => d.field)).toContain("region");
    expect(encoding.metrics.map((m) => m.field)).toContain("amount");
    expect(deAxisRenderReady(config)).toBe(true);
  });

  it("table-info removeAxisFieldAt updates axes and legacy", () => {
    let config: ChartViewConfig = {
      chartType: "table-info",
      axes: { xAxis: [{ field: "a" }, { field: "b" }] },
    };
    config = removeAxisFieldAt(config, "xAxis", 0);
    expect(config.axes?.xAxis?.map((r) => r.field)).toEqual(["b"]);
  });

  it("table-info syncs drill field to dimensions tail", () => {
    let config: ChartViewConfig = { chartType: "table-info" };
    config = appendAxisField(config, "xAxis", "region");
    config = writeAxisField(config, { axisId: "drill", index: 0 }, "channel");
    expect(config.dimensions?.map((d) => d.field)).toEqual(["region", "channel"]);
  });

  it("map drill axes sync to dimensions[1/2]", () => {
    let config: ChartViewConfig = {
      chartType: "map",
      dimensions: [{ field: "province" }],
      metrics: [{ field: "value" }],
    };
    config = writeAxisField(migrateChartConfigToDeAxes(config), { axisId: "drill", index: 0 }, "city");
    config = writeAxisField(config, { axisId: "drill", index: 1 }, "district");

    expect(config.dimensions?.[1]?.field).toBe("city");
    expect(config.dimensions?.[2]?.field).toBe("district");
    expect(config.axes?.drill?.[0]?.field).toBe("city");
    expect(config.axes?.drill?.[1]?.field).toBe("district");
  });

  it("remapMixAxisSlots moves legacy chart-mix sub dim from xAxisExt to extBubble", () => {
    const config: ChartViewConfig = {
      chartType: "chart-mix",
      axes: {
        xAxis: [{ field: "sale_date" }],
        xAxisExt: [{ field: "region" }],
        yAxis: [{ field: "amount" }],
        yAxisExt: [{ field: "amount2" }],
      },
    };
    const next = remapMixAxisSlots(config);
    expect(next.axes?.xAxisExt).toEqual([]);
    expect(next.axes?.extBubble?.[0]?.field).toBe("region");
  });
});
