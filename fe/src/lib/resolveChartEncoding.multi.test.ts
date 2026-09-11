import { describe, expect, it } from "vitest";
import {
  appendAxisField,
  migrateChartConfigToDeAxes,
  syncLegacyFieldsFromAxes,
} from "@/lib/resolveChartEncoding";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("resolveChartEncoding multi slots", () => {
  it("table-normal syncs multiple xAxis dimensions and yAxis metrics", () => {
    let cfg: ChartViewConfig = {
      chartType: "table-normal",
      mode: "sql",
      dataSourceId: "ds",
      dimensions: [],
      metrics: [],
      axes: {
        xAxis: [{ field: "metric_code" }, { field: "metric_name" }, { field: "stat_date" }],
        yAxis: [
          { field: "total_amount" },
          { field: "region_id" },
        ],
        drill: [],
      },
    };
    cfg = syncLegacyFieldsFromAxes(cfg);
    expect(cfg.dimensions?.map((d) => d.field)).toEqual([
      "metric_code",
      "metric_name",
      "stat_date",
    ]);
    expect(cfg.metrics?.map((m) => m.field)).toEqual(["total_amount", "region_id"]);
  });

  it("line chart syncs multiple yAxis metrics from axes", () => {
    const cfg = syncLegacyFieldsFromAxes({
      chartType: "line",
      mode: "sql",
      dataSourceId: "ds",
      dimensions: [],
      metrics: [],
      axes: {
        xAxis: [{ field: "region" }],
        xAxisExt: [],
        yAxis: [{ field: "amount" }, { field: "qty" }],
        drill: [],
      },
    });
    expect(cfg.dimensions?.map((d) => d.field)).toEqual(["region"]);
    expect(cfg.metrics?.map((m) => m.field)).toEqual(["amount", "qty"]);
  });

  it("migrates legacy table-normal dimensions and metrics into multi axes", () => {
    const migrated = migrateChartConfigToDeAxes({
      chartType: "table-normal",
      mode: "sql",
      dataSourceId: "ds",
      dimensions: [{ field: "a" }, { field: "b" }],
      metrics: [{ field: "m1" }, { field: "m2" }],
    });
    expect(migrated.axes?.xAxis?.map((r) => r.field)).toEqual(["a", "b"]);
    expect(migrated.axes?.yAxis?.map((r) => r.field)).toEqual(["m1", "m2"]);
  });

  it("appendAxisField adds to multi yAxis on line chart", () => {
    const base: ChartViewConfig = {
      chartType: "line",
      mode: "sql",
      dataSourceId: "ds",
      dimensions: [{ field: "region" }],
      metrics: [{ field: "amount" }],
      axes: {
        xAxis: [{ field: "region" }],
        yAxis: [{ field: "amount" }],
      },
    };
    const next = appendAxisField(base, "yAxis", "qty");
    expect(next.axes?.yAxis?.map((r) => r.field)).toEqual(["amount", "qty"]);
    expect(next.metrics?.map((m) => m.field)).toEqual(["amount", "qty"]);
  });
});
