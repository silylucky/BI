import { describe, expect, it } from "vitest";
import {
  applyChartSeriesColorOverrides,
  chartSeriesColorCustomized,
  resolveChartSeriesColorItems,
  resolveSeriesPaletteColors,
} from "./chartSeriesColor";
import type { ChartViewConfig } from "./chartViewConfig";

const barCfg: ChartViewConfig = {
  chartType: "bar",
  metrics: [{ field: "amount", label: "amount" }],
};

describe("chartSeriesColor", () => {
  it("resolves one series per metric", () => {
    const items = resolveChartSeriesColorItems(barCfg, "default");
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("amount");
    expect(items[0]?.color).toBe("#465fff");
  });

  it("detects customized series colors", () => {
    expect(chartSeriesColorCustomized(barCfg, "default")).toBe(false);
    expect(
      chartSeriesColorCustomized(barCfg, "default", [
        { id: "amount", name: "amount", color: "#ff0000" },
      ]),
    ).toBe(true);
  });

  it("applies per-series color overrides", () => {
    const option = applyChartSeriesColorOverrides(
      { series: [{ type: "bar", name: "amount", data: [1] }] },
      [{ id: "amount", name: "amount", color: "#ff0000" }],
    );
    const series = option.series as Array<{ itemStyle?: { color?: string } }>;
    expect(series[0]?.itemStyle?.color).toBe("#ff0000");
  });

  it("inherits dashboard palette when component palette is unset", () => {
    const items = resolveChartSeriesColorItems(barCfg, "pastel");
    expect(items[0]?.color).toBe("#84adff");
  });

  it("prefers component custom palette colors for series defaults", () => {
    const cfg: ChartViewConfig = {
      ...barCfg,
      nativeBody: {
        deStyle: {
          paletteId: "default",
          paletteColors: ["#111111", "#222222"],
        },
      },
    };
    const items = resolveChartSeriesColorItems(cfg, "default", undefined, ["#111111", "#222222"]);
    expect(items[0]?.color).toBe("#111111");
  });

  it("resolveSeriesPaletteColors prefers deStyle custom colors", () => {
    const cfg: ChartViewConfig = {
      ...barCfg,
      nativeBody: {
        deStyle: {
          paletteId: "default",
          paletteColors: ["#abcdef"],
        },
      },
    };
    expect(resolveSeriesPaletteColors(cfg, ["#465fff"])).toEqual(["#abcdef"]);
    expect(resolveSeriesPaletteColors(barCfg, ["#465fff"])).toEqual(["#465fff"]);
  });
});
