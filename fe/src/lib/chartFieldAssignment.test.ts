import { describe, expect, it } from "vitest";
import {
  resolveAutoAssignTarget,
  validateFieldAssignment,
} from "./chartFieldAssignment";

describe("chartFieldAssignment", () => {
  it("allows sale_date on line category axis and amount on metric axis", () => {
    const cfg = { chartType: "line" as const, dimensions: [{ field: "" }], metrics: [{ field: "" }] };
    expect(
      validateFieldAssignment("sale_date", { axisId: "xAxis", index: 0 }, "line").ok,
    ).toBe(true);
    expect(
      validateFieldAssignment("amount", { axisId: "yAxis", index: 0 }, "line").ok,
    ).toBe(true);
    expect(resolveAutoAssignTarget(cfg, "line", "sale_date")).toEqual({
      target: { axisId: "xAxis", index: 0 },
    });
    expect(resolveAutoAssignTarget(cfg, "line", "amount")).toEqual({
      target: { axisId: "yAxis", index: 0 },
    });
  });

  it("rejects metric field in dimension slot", () => {
    const result = validateFieldAssignment(
      "amount",
      { axisId: "xAxis", index: 0 },
      "line",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("指标字段");
    }
  });

  it("allows both field types on word-cloud label axis", () => {
    expect(
      validateFieldAssignment("word", { axisId: "xAxis", index: 0 }, "word-cloud").ok,
    ).toBe(true);
    expect(
      validateFieldAssignment("weight", { axisId: "xAxis", index: 0 }, "word-cloud").ok,
    ).toBe(true);
  });

  it("rejects non-date field on timeline dimension", () => {
    const result = validateFieldAssignment(
      "region",
      { axisId: "xAxis", index: 0 },
      "timeline",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("时间");
    }
  });

  it("allows region_id on map geo dimension (demo mysql id mapping)", () => {
    const result = validateFieldAssignment(
      "region_id",
      { axisId: "xAxis", index: 0 },
      "map",
    );
    expect(result.ok).toBe(true);
  });

  it("allows dimension field in kpi metric slot (DataEase count)", () => {
    expect(
      validateFieldAssignment("region_name", { axisId: "yAxis", index: 0 }, "kpi").ok,
    ).toBe(true);
  });

  it("table-info appends fields to multi data column", () => {
    const cfg = { chartType: "table-info" as const, axes: { xAxis: [{ field: "sale_date" }] } };
    expect(resolveAutoAssignTarget(cfg, "table-info", "amount")).toEqual({
      target: { axisId: "xAxis", index: 0 },
      append: true,
    });
  });

  it("table-info rejects duplicate field in multi column", () => {
    const cfg = {
      chartType: "table-info" as const,
      axes: { xAxis: [{ field: "amount" }] },
    };
    const result = resolveAutoAssignTarget(cfg, "table-info", "amount");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("已在");
    }
  });

  it("gis-map auto-assigns lng/lat to coordinate slots", () => {
    const cfg = { chartType: "gis-map" as const, dimensions: [], metrics: [] };
    expect(resolveAutoAssignTarget(cfg, "gis-map", "lng")).toEqual({
      target: { axisId: "xAxis", index: 0 },
    });
    expect(resolveAutoAssignTarget(cfg, "gis-map", "lat")).toEqual({
      target: { axisId: "xAxisExt", index: 0 },
    });
    expect(resolveAutoAssignTarget(cfg, "gis-map", "point_name")).toEqual({
      target: { axisId: "drill", index: 0 },
    });
  });

  it("gis-map rejects province in longitude slot", () => {
    const result = validateFieldAssignment(
      "province",
      { axisId: "xAxis", index: 0 },
      "gis-map",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("经度");
    }
  });
});
