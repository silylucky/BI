import { describe, expect, it } from "vitest";
import { applyGisMapScatterConfig } from "@/lib/gisMapScatter";
import { sanitizeChartFieldsForValidate } from "@/lib/chartFieldRules";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("sanitizeChartFieldsForValidate gis-map scatter", () => {
  it("keeps lng/lat/label slots after persist sanitize", () => {
    const cfg = applyGisMapScatterConfig({ chartType: "gis-map" }, "sample-ds");
    const sanitized = sanitizeChartFieldsForValidate(cfg);
    expect(sanitized.dimensions?.map((d) => d.field)).toEqual(["lng", "lat", "point_name"]);
    expect(sanitized.metrics?.[0]?.field).toBe("amount");
  });

  it("keeps drill label when legacy dimensions were truncated", () => {
    const cfg: ChartViewConfig = {
      chartType: "gis-map",
      mode: "sql",
      sql: "SELECT 1",
      dimensions: [{ field: "lng" }, { field: "lat" }],
      metrics: [{ field: "amount" }],
      axes: {
        xAxis: [{ field: "lng" }],
        xAxisExt: [{ field: "lat" }],
        yAxis: [{ field: "amount" }],
        drill: [{ field: "point_name" }],
      },
    };
    const sanitized = sanitizeChartFieldsForValidate(cfg);
    expect(sanitized.dimensions?.map((d) => d.field)).toEqual(["lng", "lat", "point_name"]);
  });
});
