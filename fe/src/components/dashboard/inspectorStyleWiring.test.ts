import { describe, expect, it } from "vitest";
import { chartStyleSectionsForType } from "@/lib/chartStyleSectionRegistry";
import {
  filterStyleSectionsForChart,
  supportsPaletteOpacity,
  supportsSeriesGradientToggle,
} from "@/lib/chartStylePanelGates";
import { resolveChartContentShellStyle } from "@/lib/chartDeStyle";
import { resolveD3InspectorFeatureMatrix } from "@/components/charts/engine/d3/inspectorCapabilityMatrix";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("inspector style wiring registry", () => {
  it("funnel exposes legend section (D3 wired)", () => {
    const sections = filterStyleSectionsForChart("funnel", chartStyleSectionsForType("funnel"));
    expect(sections).toContain("legend");
  });

  it("t-heatmap exposes geo section for cell label and visualMap", () => {
    const sections = chartStyleSectionsForType("t-heatmap");
    expect(sections).toContain("geo");
  });

  it("line charts expose variantBasic then axis", () => {
    const sections = chartStyleSectionsForType("line");
    expect(sections[0]).toBe("variantBasic");
    expect(sections[1]).toBe("axis");
  });

  it("wordCloud D3 matrix aligns with word-cloud", () => {
    expect(resolveD3InspectorFeatureMatrix("wordCloud")).toEqual(
      resolveD3InspectorFeatureMatrix("word-cloud"),
    );
  });

  it("table-info has tableColor not palette", () => {
    const sections = chartStyleSectionsForType("table-info");
    expect(sections).toContain("tableColor");
    expect(sections).not.toContain("palette");
  });

  it("pie enables palette opacity and hides series gradient", () => {
    expect(supportsSeriesGradientToggle("pie")).toBe(false);
    expect(supportsPaletteOpacity("pie")).toBe(true);
  });

  it("map-3d style sections exclude palette", () => {
    expect(chartStyleSectionsForType("map-3d")).not.toContain("palette");
  });

  it("grid shell merges per-chart background override", () => {
    const cfg: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
      nativeBody: {
        deStyle: {
          background: { backgroundShow: true, background: "#112233" },
        },
      },
    };
    const shell = resolveChartContentShellStyle({ borderEnabled: true }, cfg, "light");
    expect(shell.outer.style.backgroundColor ?? shell.outer.style.background).toBeTruthy();
  });
});
