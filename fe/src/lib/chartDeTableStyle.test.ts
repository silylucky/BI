import { describe, expect, it } from "vitest";
import {
  patchChartDeTableStyle,
  patchTableColumnWidthMode,
  readChartDeTableStyle,
  resolveChartFieldLabel,
  resolveEffectiveTableZebraBg,
  resolveTableStyleDisplayColumns,
} from "@/lib/chartDeTableStyle";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

const baseCfg = {
  chartType: "table-info",
  mode: "sql",
} as ChartViewConfig;

describe("chartDeTableStyle column width mode patches", () => {
  it("clears drag pixel widths when switching to auto", () => {
    const cfg = patchChartDeTableStyle(baseCfg, {
      columnWidthMode: "custom",
      columnWidths: { a: 40, b: 60 },
      columnWidthsPx: { a: 120, b: 180 },
    });
    const next = patchTableColumnWidthMode(cfg, "auto");
    const style = readChartDeTableStyle(next);
    expect(style.columnWidthMode).toBe("auto");
    expect(style.columnWidths).toBeUndefined();
    expect(style.columnWidthsPx).toBeUndefined();
  });

  it("clears percentage widths when switching to fixed", () => {
    const cfg = patchChartDeTableStyle(baseCfg, {
      columnWidthMode: "custom",
      columnWidths: { a: 30, b: 70 },
      columnWidthsPx: { a: 100 },
    });
    const next = patchTableColumnWidthMode(cfg, "fixed");
    const style = readChartDeTableStyle(next);
    expect(style.columnWidthMode).toBe("fixed");
    expect(style.columnWidths).toBeUndefined();
    expect(style.columnWidthsPx).toBeUndefined();
  });
});

describe("resolveChartFieldLabel", () => {
  it("prefers dimension/metric labels over raw field names", () => {
    const cfg = patchChartDeTableStyle(baseCfg, {});
    const withLabels: ChartViewConfig = {
      ...cfg,
      dimensions: [{ field: "grid_name", label: "网格名称" }],
      metrics: [{ field: "event_count", label: "事件数" }],
    };
    expect(resolveChartFieldLabel(withLabels, "grid_name")).toBe("网格名称");
    expect(resolveChartFieldLabel(withLabels, "event_count")).toBe("事件数");
  });

  it("humanizes table-info xAxis-only fields without explicit labels", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      axes: { xAxis: [{ field: "grid_name" }, { field: "event_count" }] },
    };
    expect(resolveChartFieldLabel(cfg, "grid_name")).toBe("网格名称");
    expect(resolveChartFieldLabel(cfg, "event_count")).toBe("事件数");
  });
});

describe("readChartDeTableStyle", () => {
  it("rounds fractional rowHeightPx on read", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      nativeBody: { deTableStyle: { rowHeightPx: 21.212383270263672 } },
    };
    expect(readChartDeTableStyle(cfg).rowHeightPx).toBe(21);
  });
});

describe("resolveTableStyleDisplayColumns", () => {
  it("uses xAxis slot order for table-info", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      axes: {
        xAxis: [{ field: "grid_name" }, { field: "event_count" }],
      },
      dimensions: [{ field: "grid_name" }],
      metrics: [{ field: "event_count" }],
    };
    expect(resolveTableStyleDisplayColumns(cfg, ["event_count", "grid_name"])).toEqual([
      "grid_name",
      "event_count",
    ]);
  });
});

describe("resolveEffectiveTableZebraBg", () => {
  it("respects zebraStriped=false and skips theme fallback", () => {
    expect(
      resolveEffectiveTableZebraBg({ zebraStriped: false }, { "--dashboard-table-zebra-bg": "#eee" }),
    ).toBeUndefined();
  });

  it("falls back to theme zebra when no component override", () => {
    expect(
      resolveEffectiveTableZebraBg({}, { "--dashboard-table-zebra-bg": "rgba(0,0,0,0.08)" }),
    ).toBe("rgba(0,0,0,0.08)");
  });
});
