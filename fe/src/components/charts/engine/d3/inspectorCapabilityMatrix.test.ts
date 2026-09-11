import { describe, expect, it } from "vitest";
import {
  listD3WiringChartTypes,
  resolveD3InspectorFeatureMatrix,
  resolveD3WiredCapabilities,
} from "./inspectorCapabilityMatrix";
import { resolveEngineCapabilities } from "@/components/charts/engine/capabilities";
import { chartInspectorCapabilities } from "@/lib/chartInspectorCapabilities";

describe("inspectorCapabilityMatrix", () => {
  it("registers all major canvas chart types", () => {
    const types = listD3WiringChartTypes();
    expect(types).toContain("line");
    expect(types).toContain("area");
    expect(types).toContain("bar-horizontal");
    expect(types).toContain("chart-mix-stack");
    expect(types.length).toBeGreaterThan(30);
  });

  it("wires conditional for scatter after D3 renderer hook-up", () => {
    const caps = resolveD3WiredCapabilities("scatter");
    expect(caps?.conditional).toBe(true);
    expect(resolveD3InspectorFeatureMatrix("scatter")?.conditional).toBe("wired");
  });

  it("enables dataZoom for dual axes after P0 wiring", () => {
    expect(resolveD3WiredCapabilities("chart-mix")?.dataZoom).toBe(true);
  });

  it("resolveEngineCapabilities uses D3 matrix for canvas types", () => {
    expect(resolveEngineCapabilities("scatter").conditional).toBe(true);
    expect(resolveEngineCapabilities("line").dataZoom).toBe(true);
    expect(resolveEngineCapabilities("gauge").label).toBe(true);
  });

  it("map-3d disables label in inspector matrix", () => {
    expect(resolveD3InspectorFeatureMatrix("map-3d")?.label).toBe("missing");
    expect(resolveD3WiredCapabilities("map-3d")?.label).toBe(false);
  });

  it("chartInspectorCapabilities stays aligned with D3 matrix", () => {
    const scatter = chartInspectorCapabilities("scatter");
    expect(scatter.conditional).toBe(true);
    expect(scatter.markLines).toBe(true);
    expect(scatter.legendPartial).toBe(false);

    const mix = chartInspectorCapabilities("chart-mix");
    expect(mix.dataZoom).toBe(true);
    expect(mix.label).toBe(true);
    expect(mix.conditionalPartial).toBe(false);

    const dual = chartInspectorCapabilities("chart-mix-dual-line");
    expect(dual.legendPartial).toBe(false);
  });
});
