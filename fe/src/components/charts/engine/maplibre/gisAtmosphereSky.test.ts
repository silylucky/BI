import { describe, expect, it } from "vitest";
import { applyGisGlobeToStyle, gisFogToMapLibreSky, mapLibreSkyForPreset, spaceBackdropForPreset } from "@/components/charts/engine/maplibre/gisAtmosphereSky";
import { getGlobeRadiusPixels, resolveGlobeScreenBoundsFallback, shouldRenderGisStarfield } from "@/components/charts/engine/maplibre/gisGlobeLayout";
import { resolveGisMeteorIntensity, resolveGisStarIntensity } from "@/components/charts/engine/maplibre/gisStarfield";
import type { GisAtmospherePreset } from "@/components/charts/engine/maplibre/gisProject";

describe("gisAtmosphereSky", () => {
  it("maps night preset to dark sky with canvas halo complement", () => {
    const sky = mapLibreSkyForPreset("night");
    expect(sky["sky-color"]).toBe("#03040c");
    expect(sky["atmosphere-blend"]).toBe(0);
  });

  it("maps day preset to bright sky", () => {
    const sky = mapLibreSkyForPreset("day");
    expect(sky["sky-color"]).toBe("#9fd0fb");
    expect(sky["atmosphere-blend"]).toBeLessThan(0.8);
  });

  it("falls back from fog star-intensity", () => {
    expect(gisFogToMapLibreSky({ "star-intensity": 0.6 })["sky-color"]).toBe("#03040c");
    expect(gisFogToMapLibreSky({ "star-intensity": 0.1 })["sky-color"]).toBe("#03040c");
  });

  it("provides backdrop gradients per preset", () => {
    expect(spaceBackdropForPreset("night")).toContain("radial-gradient");
    expect(spaceBackdropForPreset("day")).toContain("radial-gradient");
  });

  it("embeds globe projection and sky in style spec", () => {
    const style = applyGisGlobeToStyle({ version: 8, layers: [] }, "globe", "day");
    expect(style.projection).toEqual({ type: "globe" });
    expect(style.sky?.["sky-color"]).toBe("#9fd0fb");
  });
});

describe("gisGlobeLayout", () => {
  it("computes globe radius from world size and latitude", () => {
    expect(getGlobeRadiusPixels(512, 0)).toBeCloseTo(512 / (2 * Math.PI), 4);
  });

  it("fallback bounds center the globe", () => {
    const bounds = resolveGlobeScreenBoundsFallback(400, 300);
    expect(bounds.x).toBe(200);
    expect(bounds.y).toBe(150);
  });

  it("hides starfield when zoomed in or globe disc fills the viewport", () => {
    const global = resolveGlobeScreenBoundsFallback(400, 300);
    expect(shouldRenderGisStarfield(global, 400, 300)).toBe(true);

    const zoomedMap = { getZoom: () => 5 } as import("maplibre-gl").Map;
    expect(shouldRenderGisStarfield(global, 400, 300, zoomedMap)).toBe(false);

    const filled = { ...global, radius: 320 };
    expect(shouldRenderGisStarfield(filled, 400, 300)).toBe(false);
  });
});

describe("gisStarfield", () => {
  it("enables stars and meteors for night only", () => {
    expect(resolveGisStarIntensity("night")).toBe(1);
    expect(resolveGisMeteorIntensity("night")).toBe(1);
    expect(resolveGisStarIntensity("day")).toBe(0);
    expect(resolveGisMeteorIntensity("day")).toBe(0);
  });

  it("migrates legacy dusk/deep-space to night intensity", () => {
    expect(resolveGisStarIntensity("dusk" as GisAtmospherePreset)).toBe(0);
    expect(resolveGisStarIntensity("deep-space" as GisAtmospherePreset)).toBe(0);
  });
});
