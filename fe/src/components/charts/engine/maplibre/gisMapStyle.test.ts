import { describe, expect, it } from "vitest";
import {
  DEFAULT_GIS_PROJECT,
  GIS_ATMOSPHERE_PRESETS,
  readGisProject,
} from "@/components/charts/engine/maplibre/gisProject";
import {
  appendBuildings3dLayer,
  buildPmtilesStyle,
  GIS_BUILDINGS_3D_LAYER_ID,
  normalizeProtomapsSpriteUrl,
  PMTILES_SOURCE_ID,
  resolveProtomapsSpriteUrl,
} from "@/components/charts/engine/maplibre/gisMapStyle";
import { DEFAULT_GIS_WATER_COLOR } from "@/components/charts/engine/maplibre/gisBasemapPalette";
import { gisMapTransformRequest } from "@/components/charts/engine/maplibre/gisMapTransformRequest";

const RESOLVED = {
  id: "planet-z15",
  name: "Planet Z15 Global",
  pmtilesUrl: "http://localhost:8080/planet-z15-20260817.pmtiles",
  glyphsUrl: "http://localhost:8080/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  spriteUrl: "http://localhost:8080/basemaps-assets/sprites/v4/light",
};

describe("gisProject", () => {
  it("returns defaults when nativeBody missing", () => {
    expect(readGisProject(undefined)).toEqual(DEFAULT_GIS_PROJECT);
  });

  it("normalizes unknown basemap ids to pmtiles", () => {
    expect(
      readGisProject({
        chartType: "gis-map",
        nativeBody: { gisProject: { basemap: "openfreemap", view: { center: [1, 2], zoom: 4 } } },
      }).basemap,
    ).toBe("pmtiles");
  });

  it("migrates day atmosphere preset to night", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: {
        gisProject: {
          projection: "globe",
          atmospherePreset: "day",
        },
      },
    });
    expect(project.atmospherePreset).toBe("night");
    expect(project.fog).toEqual(GIS_ATMOSPHERE_PRESETS.night);
  });

  it("derives fog from atmosphere preset only", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: {
        gisProject: {
          projection: "globe",
          atmospherePreset: "night",
          fog: GIS_ATMOSPHERE_PRESETS.day,
        },
      },
    });
    expect(project.fog).toEqual(GIS_ATMOSPHERE_PRESETS.night);
  });

  it("defaults globe atmosphere to night", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: { gisProject: { projection: "globe" } },
    });
    expect(project.fog).toEqual(GIS_ATMOSPHERE_PRESETS.night);
    expect(project.atmospherePreset).toBe("night");
  });

  it("migrates legacy deep-space preset to night", () => {
    const project = readGisProject({
      chartType: "gis-map",
      nativeBody: { gisProject: { projection: "globe", atmospherePreset: "deep-space" } },
    });
    expect(project.atmospherePreset).toBe("night");
  });
});

describe("gisMapStyle", () => {
  it("builds pmtiles style with protomaps source", () => {
    const style = buildPmtilesStyle(RESOLVED, "zh-Hans");
    expect(style.sources?.[PMTILES_SOURCE_ID]).toBeDefined();
    expect(style.layers?.length).toBeGreaterThan(0);
    expect(style.layers?.some((layer) => layer.id === GIS_BUILDINGS_3D_LAYER_ID)).toBe(true);
    expect(style.glyphs).toContain("/basemaps-assets/fonts/");
    expect(style.glyphs).not.toContain("jsdelivr");
    expect(style.sprite).toContain("/sprites/v4/light");
  });

  it("builds dark flavor with matching sprite", () => {
    const style = buildPmtilesStyle(RESOLVED, "en", { flavor: "dark" });
    expect(style.sprite).toContain("/dark");
  });

  it("appends buildings 3d layer when enabled", () => {
    const style = buildPmtilesStyle(RESOLVED, "zh-Hans", { buildings3d: true });
    expect(style.layers?.some((layer) => layer.id === GIS_BUILDINGS_3D_LAYER_ID)).toBe(true);
  });

  it("appendBuildings3dLayer adds extrusion layer", () => {
    const base = buildPmtilesStyle(RESOLVED);
    const next = appendBuildings3dLayer(base, "dark");
    expect(next.layers?.at(-1)?.type).toBe("fill-extrusion");
  });

  it("normalizes legacy protomaps sprite urls", () => {
    expect(
      normalizeProtomapsSpriteUrl(
        "https://protomaps.github.io/basemaps-assets/v4/light-sprite",
        RESOLVED.pmtilesUrl,
      ),
    ).toBe("http://localhost:8080/basemaps-assets/sprites/v4/light");
  });

  it("applies custom land and water colors", () => {
    const style = buildPmtilesStyle(RESOLVED, "zh-Hans", {
      landColor: "#1a2b3c",
      waterColor: "#004466",
    });
    const earth = style.layers?.find((layer) => layer.id === "earth");
    const water = style.layers?.find((layer) => layer.id === "water");
    expect(earth?.paint?.["fill-color"]).toBe("#1a2b3c");
    expect(water?.paint?.["fill-color"]).toBe("#004466");
  });

  it("defaults ocean color to platform blue", () => {
    const style = buildPmtilesStyle(RESOLVED, "zh-Hans");
    const water = style.layers?.find((layer) => layer.id === "water");
    expect(water?.paint?.["fill-color"]).toBe(DEFAULT_GIS_WATER_COLOR);
  });

  it("applies basemap layer visibility in style build", () => {
    const style = buildPmtilesStyle(RESOLVED, "zh-Hans", { basemapLayers: { roads: false } });
    const roads = style.layers?.find((layer) => layer.id === "roads_major");
    expect(roads?.layout?.visibility).toBe("none");
  });

  it("harmonizes land detail colors when custom land is set", () => {
    const style = buildPmtilesStyle(RESOLVED, "zh-Hans", { landColor: "#101010" });
    const landcover = style.layers?.find((layer) => layer.id === "landcover");
    expect(landcover?.paint?.["fill-color"]).toContain("#101010");
  });

  it("resolveProtomapsSpriteUrl swaps flavor suffix", () => {
    expect(
      resolveProtomapsSpriteUrl("dark", RESOLVED.spriteUrl, RESOLVED.pmtilesUrl),
    ).toBe("http://localhost:8080/basemaps-assets/sprites/v4/dark");
  });
});

describe("gisMapTransformRequest", () => {
  it("returns url only without auth headers", () => {
    expect(gisMapTransformRequest("https://example.com/tile/1/2/3", "Tile")).toEqual({
      url: "https://example.com/tile/1/2/3",
    });
  });
});
