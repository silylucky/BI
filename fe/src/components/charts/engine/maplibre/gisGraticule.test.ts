import { describe, expect, it, vi } from "vitest";
import {
  applyGisGraticule,
  applyGisGraticuleImmediate,
  buildGraticuleGeoJson,
  GIS_GRATICULE_LAYER_ID,
  GIS_GRATICULE_SOURCE_ID,
  GIS_SUN_NIGHT_LAYER_ID,
  maintainGisGraticuleStack,
  placeGisGraticuleLayer,
  resolveGisGraticuleInsertBeforeId,
} from "@/components/charts/engine/maplibre/gisGraticule";

describe("buildGraticuleGeoJson", () => {
  it("includes meridians and parallels at step interval", () => {
    const geojson = buildGraticuleGeoJson(15);
    const meridians = geojson.features.filter(
      (feature) => feature.properties?.kind === "meridian",
    );
    const parallels = geojson.features.filter(
      (feature) => feature.properties?.kind === "parallel",
    );
    expect(meridians.length).toBeGreaterThan(20);
    expect(parallels.length).toBeGreaterThan(8);
  });
});

describe("resolveGisGraticuleInsertBeforeId", () => {
  it("prefers solid scatter circles over halo layers", () => {
    const beforeId = resolveGisGraticuleInsertBeforeId([
      { id: "vs-gis-layer-sales-scatter-halo" },
      { id: "vs-gis-layer-sales-circles" },
      { id: GIS_GRATICULE_LAYER_ID },
    ]);
    expect(beforeId).toBe("vs-gis-layer-sales-circles");
  });
});

describe("placeGisGraticuleLayer", () => {
  it("moves graticule below solid data layers and keeps night below graticule", () => {
    const moveLayer = vi.fn();
    const map = {
      getLayer: (id: string) =>
        id === GIS_GRATICULE_LAYER_ID || id === GIS_SUN_NIGHT_LAYER_ID ? { id } : undefined,
      getStyle: () => ({
        layers: [
          { id: "vs-gis-layer-sales-scatter-halo" },
          { id: "vs-gis-layer-sales-circles" },
          { id: GIS_GRATICULE_LAYER_ID },
        ],
      }),
      moveLayer,
    };
    placeGisGraticuleLayer(map as never);
    expect(moveLayer).toHaveBeenCalledWith(
      GIS_GRATICULE_LAYER_ID,
      "vs-gis-layer-sales-circles",
    );
    expect(moveLayer).toHaveBeenCalledWith(GIS_SUN_NIGHT_LAYER_ID, GIS_GRATICULE_LAYER_ID);
  });
});

describe("maintainGisGraticuleStack", () => {
  it("re-adds graticule after style reload removed the runtime layer", () => {
    const layers = new Map<string, unknown>();
    const addLayer = vi.fn((spec: { id: string }) => {
      layers.set(spec.id, spec);
    });
    const addSource = vi.fn();
    const moveLayer = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      getSource: () => undefined,
      getLayer: (id: string) => layers.get(id),
      getStyle: () => ({ layers: [] }),
      addSource,
      addLayer,
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      moveLayer,
      triggerRepaint: vi.fn(),
    };

    maintainGisGraticuleStack(map as never, true);

    expect(addSource).toHaveBeenCalled();
    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: GIS_GRATICULE_LAYER_ID, type: "line" }),
    );
    expect(moveLayer).toHaveBeenCalledWith(GIS_GRATICULE_LAYER_ID);
    expect(map.triggerRepaint).toHaveBeenCalled();
  });
});

describe("applyGisGraticuleImmediate", () => {
  it("removes graticule layer and source when disabled", () => {
    const removeLayer = vi.fn();
    const removeSource = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      getSource: () => ({}),
      getLayer: () => ({}),
      removeLayer,
      removeSource,
    };

    applyGisGraticuleImmediate(map as never, false);

    expect(removeLayer).toHaveBeenCalledWith(GIS_GRATICULE_LAYER_ID);
    expect(removeSource).toHaveBeenCalledWith(GIS_GRATICULE_SOURCE_ID);
  });
});

describe("applyGisGraticule", () => {
  it("re-adds line layer when source exists but layer was removed", () => {
    const setData = vi.fn();
    const layers = new Map<string, unknown>();
    const addLayer = vi.fn((spec: { id: string }) => {
      layers.set(spec.id, spec);
    });
    const moveLayer = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      getSource: (id: string) =>
        id === GIS_GRATICULE_SOURCE_ID ? { setData } : undefined,
      getLayer: (id: string) => layers.get(id),
      getStyle: () => ({ layers: [] }),
      addSource: vi.fn(),
      addLayer,
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      moveLayer,
      triggerRepaint: vi.fn(),
    };

    applyGisGraticule(map as never, true);

    expect(setData).toHaveBeenCalled();
    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: GIS_GRATICULE_LAYER_ID, type: "line" }),
    );
    expect(moveLayer).toHaveBeenCalledWith(GIS_GRATICULE_LAYER_ID);
  });
});
