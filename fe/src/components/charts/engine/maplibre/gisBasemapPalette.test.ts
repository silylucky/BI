import { describe, expect, it } from "vitest";
import {
  applyBasemapLayerVisibility,
  buildBasemapFlavor,
  isEarthSurfaceLayer,
  isManagedBasemapLayer,
  normalizeBasemapHexColor,
} from "@/components/charts/engine/maplibre/gisBasemapPalette";
import { layers, namedFlavor } from "@protomaps/basemaps";

describe("gisBasemapPalette", () => {
  it("overrides land and water colors in protomaps flavor", () => {
    const flavor = buildBasemapFlavor("light", {
      landColor: "#223344",
      waterColor: "#112233",
    });
    expect(flavor.earth).toBe("#223344");
    expect(flavor.water).toBe("#112233");
    const base = namedFlavor("light");
    expect(base.park_a).not.toBe(flavor.park_a);
  });

  it("harmonizes land detail palette when custom land color is set", () => {
    const flavor = buildBasemapFlavor("light", { landColor: "#111111" });
    expect(flavor.park_a).toBe("#111111");
    expect(flavor.landcover?.forest).toBe("#111111");
    expect(flavor.highway).toBe(namedFlavor("light").highway);
  });

  it("defaults water to platform blue", () => {
    const flavor = buildBasemapFlavor("light");
    expect(flavor.water).toBe("#2563eb");
  });

  it("validates hex colors", () => {
    expect(normalizeBasemapHexColor("#AABBCC")).toBe("#aabbcc");
    expect(normalizeBasemapHexColor("112233")).toBeUndefined();
  });

  it("hides selected basemap layer groups", () => {
    const baseLayers = layers("protomaps", namedFlavor("light"), { lang: "zh-Hans" });
    const next = applyBasemapLayerVisibility(baseLayers, { roads: false, labels: false });
    const roads = next.find((layer) => layer.id === "roads_major");
    const labels = next.find((layer) => layer.id === "places_country");
    expect(roads?.layout?.visibility).toBe("none");
    expect(labels?.layout?.visibility).toBe("none");
    expect(next.find((layer) => layer.id === "earth")?.layout?.visibility).toBeUndefined();
  });

  it("classifies earth surface vs managed overlay layers", () => {
    expect(isEarthSurfaceLayer("earth")).toBe(true);
    expect(isEarthSurfaceLayer("landuse_park")).toBe(true);
    expect(isEarthSurfaceLayer("roads_major")).toBe(false);
    expect(isManagedBasemapLayer("roads_major")).toBe(true);
    expect(isManagedBasemapLayer("places_city")).toBe(true);
    expect(isManagedBasemapLayer("earth")).toBe(false);
  });
});
