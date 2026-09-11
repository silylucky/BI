import { describe, expect, it } from "vitest";
import { chartHasAdvancedTab, chartInspectorCapabilities, supportsEmbeddedShellLegend } from "./chartInspectorCapabilities";
import { filterStyleSectionsForChart } from "./chartStylePanelGates";

describe("chartInspectorCapabilities", () => {
  it("disables legend for table", () => {
    expect(chartInspectorCapabilities("table").legend).toBe(false);
  });

  it("enables mark lines and conditional for bar", () => {
    const caps = chartInspectorCapabilities("bar");
    expect(caps.markLines).toBe(true);
    expect(caps.conditional).toBe(true);
  });

  it("disables legend for graph (D3 matrix missing)", () => {
    expect(chartInspectorCapabilities("graph").legend).toBe(false);
  });

  it("uses shell legend for all chart types with legend except map-like", () => {
    expect(supportsEmbeddedShellLegend("bar")).toBe(true);
    expect(supportsEmbeddedShellLegend("line")).toBe(true);
    expect(supportsEmbeddedShellLegend("area-stack")).toBe(true);
    expect(supportsEmbeddedShellLegend("pie")).toBe(true);
    expect(supportsEmbeddedShellLegend("funnel")).toBe(true);
    expect(supportsEmbeddedShellLegend("waterfall")).toBe(true);
    expect(supportsEmbeddedShellLegend("map")).toBe(false);
    expect(supportsEmbeddedShellLegend("gauge")).toBe(false);
  });

  it("hides advanced tab for kpi without timeRange", () => {
    expect(chartHasAdvancedTab("kpi")).toBe(false);
    expect(chartHasAdvancedTab("bar")).toBe(true);
    expect(chartHasAdvancedTab("pie")).toBe(true);
  });

  it("shows advanced tab for 2D map bubble effect", () => {
    expect(chartHasAdvancedTab("map")).toBe(true);
    expect(chartHasAdvancedTab("map-3d")).toBe(true);
  });

  it("enables label format for funnel and graph", () => {
    expect(chartInspectorCapabilities("funnel").labelFormat).toBe(true);
    expect(chartInspectorCapabilities("graph").labelFormat).toBe(true);
    expect(filterStyleSectionsForChart("funnel", ["label", "legend"])).toContain("label");
    expect(filterStyleSectionsForChart("graph", ["label", "graphShape"])).toContain("label");
  });

  it("enables sankey node label section", () => {
    expect(chartInspectorCapabilities("sankey").label).toBe(true);
    expect(filterStyleSectionsForChart("sankey", ["label", "sankeyShape"])).toContain("label");
  });
});
