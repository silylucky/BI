import { describe, expect, it } from "vitest";
import { resolveGisOverlayStyle } from "@/components/charts/engine/maplibre/gisProject";
import {
  buildClusterCirclePaint,
  buildClusterCountPaint,
  buildHeatmapColorExpression,
  buildHeatmapPaint,
  buildMetricColorExpression,
  buildScatterGlowPaint,
  buildScatterHaloPaint,
  buildScatterRadiusExpression,
} from "@/components/charts/engine/maplibre/gisOverlayVisual";

describe("gisOverlayVisual", () => {
  it("uses ember warm transparent start for heatmap color", () => {
    const expr = buildHeatmapColorExpression("ember");
    expect(expr[0]).toBe("interpolate");
    expect(expr).toContain("rgba(255, 110, 35, 0.18)");
  });

  it("uses night glow transparent start for heatmap color", () => {
    const expr = buildHeatmapColorExpression("night");
    expect(expr[0]).toBe("interpolate");
    expect(expr).toContain("rgba(0, 0, 0, 0)");
  });

  it("builds zoom-aware scatter radius", () => {
    const resolved = resolveGisOverlayStyle({ scaleByMetric: true, radiusMin: 5, radiusMax: 18 });
    const radius = buildScatterRadiusExpression(resolved);
    expect(radius[0]).toBe("interpolate");
    expect(radius[1]).toEqual(["linear"]);
    expect(radius[2]).toEqual(["zoom"]);
  });

  it("builds metric gradient color when not category colored", () => {
    const resolved = resolveGisOverlayStyle({ colorByCategory: false, scaleByMetric: true });
    const color = buildMetricColorExpression(resolved, ["#111", "#22d3ee", "#fbbf24", "#f43f5e"]);
    expect(color[0]).toBe("interpolate");
    expect(color[2]).toEqual(["coalesce", ["get", "sizeNorm"], 0.45]);
  });

  it("builds scatter halo with full blur for emissive bloom", () => {
    const resolved = resolveGisOverlayStyle({ glowStrength: 0.78, opacity: 0.9 });
    const paint = buildScatterHaloPaint(resolved, 1, ["#3366cc"]);
    expect(paint["circle-blur"]).toBe(1);
    expect((paint["circle-radius"] as unknown[])[0]).toBe("interpolate");
  });

  it("builds scatter glow radius with top-level zoom interpolate", () => {
    const resolved = resolveGisOverlayStyle({ glowStrength: 0.5, opacity: 0.8 });
    const paint = buildScatterGlowPaint(resolved, 1, ["#3366cc"]);
    const radius = paint["circle-radius"] as unknown[];
    expect(radius[0]).toBe("interpolate");
    expect(radius[2]).toEqual(["zoom"]);
    expect(radius).not.toContain("*");
  });

  it("builds heatmap paint with zoom intensity and radius", () => {
    const resolved = resolveGisOverlayStyle({ heatmapIntensity: 1, heatmapRadiusMax: 22 });
    const paint = buildHeatmapPaint(resolved, 1, ["#3366cc"]);
    expect(paint["heatmap-weight"]).toBeDefined();
    expect(paint["heatmap-intensity"]?.[0]).toBe("interpolate");
    expect(paint["heatmap-radius"]?.[0]).toBe("interpolate");
    expect(paint["heatmap-color"]?.[0]).toBe("interpolate");
  });

  it("builds cluster count without text halo", () => {
    const paint = buildClusterCountPaint(["#3b82f6"]);
    expect(paint["text-color"]).toBe("#ffffff");
    expect(paint["text-halo-color"]).toBeUndefined();
    expect(paint["text-halo-width"]).toBeUndefined();
  });

  it("builds valid cluster radius step expression", () => {
    const resolved = resolveGisOverlayStyle({ radiusMin: 8, radiusMax: 24 });
    const paint = buildClusterCirclePaint(resolved, ["#3b82f6"]);
    const radius = paint["circle-radius"] as unknown[];
    expect(radius[0]).toBe("step");
    // default + 3 stop/output pairs
    expect(radius.length).toBe(2 + 1 + 6);
    expect(radius[2]).toBe(8);
    expect(radius[4]).toBe(8);
    expect(radius[8]).toBe(24);
  });

  it("builds glassy cluster core with configurable stroke and radius", () => {
    const resolved = resolveGisOverlayStyle({
      opacity: 0.9,
      strokeColor: "#ff00aa",
      strokeWidth: 1.5,
      circleBlur: 0.4,
      radiusMin: 8,
      radiusMax: 24,
    });
    const paint = buildClusterCirclePaint(resolved, ["#3b82f6", "#22d3ee", "#f59e0b", "#e11d48"]);
    expect(paint["circle-stroke-color"]).toBe("#ff00aa");
    expect(paint["circle-stroke-width"]).toBe(1.5);
    expect(paint["circle-blur"]).toBe(0.4);
    expect((paint["circle-radius"] as unknown[])[8]).toBe(24);
  });
});
