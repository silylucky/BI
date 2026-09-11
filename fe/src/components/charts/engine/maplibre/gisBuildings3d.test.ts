import { describe, expect, it } from "vitest";
import {
  appendBuildings3dLayerToStyle,
  BUILDINGS_3D_FALLBACK_HEIGHT_M,
  BUILDINGS_3D_MIN_ZOOM,
  BUILDINGS_FLAT_MAX_ZOOM_WHEN_3D,
  createBuildings3dLayerSpec,
  FLAT_BUILDINGS_LAYER_ID,
  GIS_BUILDINGS_3D_LAYER_ID,
  resolveBuildings3dFilter,
  resolveBuildings3dHeightExpr,
} from "@/components/charts/engine/maplibre/gisBuildings3d";
import { layers, namedFlavor } from "@protomaps/basemaps";

describe("gisBuildings3d", () => {
  it("creates extrusion layer aligned with planet-z15 individual buildings", () => {
    const layer = createBuildings3dLayerSpec("light", true);
    expect(layer.type).toBe("fill-extrusion");
    expect(layer.minzoom).toBe(BUILDINGS_3D_MIN_ZOOM);
    expect(layer.paint?.["fill-extrusion-vertical-gradient"]).toBe(true);
  });

  it("does not require height tag to render (coalesce + 10m fallback)", () => {
    const heightExpr = resolveBuildings3dHeightExpr();
    expect(heightExpr).toEqual(["coalesce", ["get", "height"], BUILDINGS_3D_FALLBACK_HEIGHT_M]);
    const filter = resolveBuildings3dFilter();
    expect(JSON.stringify(filter)).not.toContain("render_height");
    expect(JSON.stringify(filter)).not.toMatch(/>\s*,\s*0\s*\]/);
  });

  it("keeps flat buildings below z15 when 3d enabled", () => {
    const base = {
      version: 8 as const,
      layers: layers("protomaps", namedFlavor("light"), { lang: "zh-Hans" }),
    };
    const next = appendBuildings3dLayerToStyle(base, "light", true);
    const flat = next.layers?.find((layer) => layer.id === FLAT_BUILDINGS_LAYER_ID);
    expect(flat?.layout?.visibility).toBe("visible");
    expect(flat?.maxzoom).toBe(BUILDINGS_FLAT_MAX_ZOOM_WHEN_3D);
    expect(next.layers?.some((layer) => layer.id === GIS_BUILDINGS_3D_LAYER_ID)).toBe(true);
  });

  it("restores flat buildings full zoom range when 3d disabled", () => {
    const base = {
      version: 8 as const,
      layers: layers("protomaps", namedFlavor("light"), { lang: "zh-Hans" }),
    };
    const next = appendBuildings3dLayerToStyle(base, "light", false);
    const flat = next.layers?.find((layer) => layer.id === FLAT_BUILDINGS_LAYER_ID);
    expect(flat?.maxzoom).toBeUndefined();
  });
});
