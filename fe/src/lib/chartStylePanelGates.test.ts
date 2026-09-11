import { describe, expect, it } from "vitest";
import {
  filterStyleSectionsForChart,
  resolveLegendEditorMode,
  supportsDepthVisualToggle,
  supportsPaletteOpacity,
  supportsSeriesGradientToggle,
} from "./chartStylePanelGates";

describe("chartStylePanelGates", () => {
  it("hides legend for gauge and shows for bar", () => {
    expect(filterStyleSectionsForChart("gauge", ["legend", "label", "palette"])).toEqual([
      "label",
      "palette",
    ]);
    expect(filterStyleSectionsForChart("bar", ["legend", "label", "palette"])).toEqual([
      "legend",
      "label",
      "palette",
    ]);
  });

  it("keeps label section for kpi format controls", () => {
    expect(filterStyleSectionsForChart("kpi", ["label", "palette"])).toEqual(["label", "palette"]);
  });

  it("keeps label section for funnel, treemap and sankey", () => {
    expect(filterStyleSectionsForChart("funnel", ["legend", "label", "funnelShape"])).toContain("label");
    expect(filterStyleSectionsForChart("treemap", ["remark", "label", "treemapShape"])).toContain("label");
    expect(filterStyleSectionsForChart("sankey", ["label", "sankeyShape"])).toContain("label");
  });

  it("depth visual for bar, line, gauge and related cartesian types", () => {
    expect(supportsDepthVisualToggle("bar")).toBe(true);
    expect(supportsDepthVisualToggle("line")).toBe(true);
    expect(supportsDepthVisualToggle("area")).toBe(true);
    expect(supportsDepthVisualToggle("gauge")).toBe(true);
    expect(supportsDepthVisualToggle("pie")).toBe(true);
    expect(supportsDepthVisualToggle("table-info")).toBe(false);
  });

  it("series gradient whitelist: bar/line yes, pie/map no", () => {
    expect(supportsSeriesGradientToggle("bar")).toBe(true);
    expect(supportsSeriesGradientToggle("line")).toBe(true);
    expect(supportsSeriesGradientToggle("pie")).toBe(false);
    expect(supportsSeriesGradientToggle("map")).toBe(false);
    expect(supportsSeriesGradientToggle("gauge")).toBe(false);
    expect(supportsSeriesGradientToggle("scatter")).toBe(false);
  });

  it("palette opacity only for 2D map", () => {
    expect(supportsPaletteOpacity("map")).toBe(true);
    expect(supportsPaletteOpacity("bar")).toBe(false);
    expect(supportsPaletteOpacity("t-heatmap")).toBe(false);
  });

  it("resolves legend editor mode", () => {
    expect(resolveLegendEditorMode("bar")).toBe("shell");
    expect(resolveLegendEditorMode("pie")).toBe("shell");
    expect(resolveLegendEditorMode("gauge")).toBe("none");
    expect(resolveLegendEditorMode("waterfall")).toBe("shell");
    expect(resolveLegendEditorMode("map")).toBe("none");
  });
});
