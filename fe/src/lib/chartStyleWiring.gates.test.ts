import { describe, expect, it } from "vitest";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import {
  listSeriesGradientChartTypes,
  supportsPaletteOpacity,
  supportsSeriesGradientToggle,
} from "./chartStylePanelGates";
import type { ChartType } from "./chartViewConfig";

/** D3 renderer 实测消费 seriesGradient 的白名单（与 chartStylePanelGates 同步） */
const RENDERER_SERIES_GRADIENT_TYPES = new Set<ChartType>([
  "line",
  "area",
  "area-stack",
  "timeline",
  "bar",
  "bar-stack",
  "percentage-bar-stack",
  "bar-group",
  "bar-group-stack",
  "bar-horizontal",
  "bar-stack-horizontal",
  "percentage-bar-stack-horizontal",
  "combo",
  "chart-mix",
  "chart-mix-group",
  "chart-mix-stack",
  "chart-mix-dual-line",
]);

describe("chartStyleWiring gates", () => {
  it("supportsPaletteOpacity only for 2D map", () => {
    expect(supportsPaletteOpacity("map")).toBe(true);
    for (const def of BUILTIN_PLUGIN_DEFS) {
      if (def.type === "map") continue;
      expect(supportsPaletteOpacity(def.type as ChartType), def.type).toBe(false);
    }
  });

  it("supportsSeriesGradientToggle matches renderer whitelist", () => {
    const gated = listSeriesGradientChartTypes();
    expect(gated.sort()).toEqual([...RENDERER_SERIES_GRADIENT_TYPES].sort());
    for (const def of BUILTIN_PLUGIN_DEFS) {
      const type = def.type as ChartType;
      const expected = RENDERER_SERIES_GRADIENT_TYPES.has(type);
      expect(supportsSeriesGradientToggle(type), type).toBe(expected);
    }
  });

  it("pie and funnel hide series gradient toggle", () => {
    expect(supportsSeriesGradientToggle("pie")).toBe(false);
    expect(supportsSeriesGradientToggle("funnel")).toBe(false);
    expect(supportsSeriesGradientToggle("scatter")).toBe(false);
  });

  it("bar and line show series gradient toggle", () => {
    expect(supportsSeriesGradientToggle("bar")).toBe(true);
    expect(supportsSeriesGradientToggle("line")).toBe(true);
    expect(supportsSeriesGradientToggle("chart-mix")).toBe(true);
  });
});
