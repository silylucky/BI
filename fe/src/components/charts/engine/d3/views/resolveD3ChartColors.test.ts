import { describe, expect, it } from "vitest";
import { resolveD3ChartColors } from "@/components/charts/engine/d3/views/resolveD3ChartColors";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

const barConfig: ChartViewConfig = {
  chartType: "bar",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "x" }],
  metrics: [{ field: "y" }],
};

const baseStyle: ChartStyleContext = {
  scheme: "light",
  deStyle: {},
  deFeatures: {},
  chartColors: ["#465fff"],
  dataScreenSurface: false,
  showLabel: false,
  showTooltip: true,
  seriesGradient: false,
  depthVisual: "off",
  dataZoom: false,
  labelContent: { showIndicator: true },
  labelPresentation: { fontSize: 12 },
  tooltipPresentation: { fontSize: 12 },
  shellLegend: false,
  embedEdit: false,
};

describe("resolveD3ChartColors", () => {
  it("uses component custom palette for bar series defaults", () => {
    const config: ChartViewConfig = {
      ...barConfig,
      nativeBody: {
        deStyle: {
          paletteId: "default",
          paletteColors: ["#111111", "#222222"],
        },
      },
    };
    const style: ChartStyleContext = {
      ...baseStyle,
      deStyle: config.nativeBody!.deStyle!,
      effectivePaletteId: "default",
      chartColors: ["#111111", "#222222"],
    };
    expect(resolveD3ChartColors(style, { kind: "d3", plotType: "Column", options: {} }, config)).toEqual([
      "#111111",
    ]);
  });

  it("uses full palette when a sub-dimension splits series with a single metric", () => {
    const config: ChartViewConfig = {
      chartType: "line",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [
        { field: "period", label: "周期" },
        { field: "dim", label: "维度" },
      ],
      metrics: [{ field: "cnt", label: "数量" }],
    };
    const style: ChartStyleContext = {
      ...baseStyle,
      chartColors: ["#111111", "#222222", "#333333", "#444444"],
    };
    expect(
      resolveD3ChartColors(
        style,
        { kind: "d3", plotType: "Line", options: { color: ["#465fff"] } },
        config,
      ),
    ).toEqual(["#111111", "#222222", "#333333", "#444444"]);
  });
});
