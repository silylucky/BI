import { describe, expect, it } from "vitest";
import {
  clampGisViewScalar,
  DEFAULT_GIS_PROJECT,
  DEFAULT_PMTILES_TILE_SERVICE_ID,
  finalizeGisViewDraftField,
  formatGisViewDraftFromView,
  formatGisViewScalar,
  parseGisViewDraft,
  readGisProject,
  resolveGisMapControls,
  resolveGisRenderableBasemap,
} from "@/components/charts/engine/maplibre/gisProject";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("gisProject", () => {
  it("returns default pmtiles project when nativeBody is empty", () => {
    expect(readGisProject(undefined)).toEqual(DEFAULT_GIS_PROJECT);
  });

  it("normalizes legacy offline basemap to pmtiles", () => {
    const source = { basemap: "blank" as const, view: { center: [116.4, 39.9] as [number, number], zoom: 5 } };
    const config: ChartViewConfig = {
      chartType: "gis-map",
      nativeBody: { gisProject: source },
    };
    expect(readGisProject(config)).toEqual({
      ...DEFAULT_GIS_PROJECT,
      autoRotate: false,
      buildings3d: true,
      showControls: false,
      view: { center: [116.4, 39.9], zoom: 5, bearing: undefined, pitch: undefined },
    });
  });

  it("migrates geolibreProject to pmtiles with default tile service", () => {
    const config: ChartViewConfig = {
      chartType: "gis-map",
      nativeBody: {
        geolibreProject: {
          version: "1",
          layers: [{ id: "vitalspan-china-provinces", metadata: { vitalspanTemplate: "china-provinces" } }],
          mapView: { center: [104, 35], zoom: 4 },
        },
      },
    };
    expect(readGisProject(config)).toEqual({
      ...DEFAULT_GIS_PROJECT,
      view: { center: [104, 35], zoom: 4 },
    });
  });

  it("migrates blank geolibreProject to pmtiles", () => {
    const config: ChartViewConfig = {
      chartType: "gis-map",
      nativeBody: {
        geolibreProject: {
          version: "1",
          layers: [],
          mapView: { center: [120, 30], zoom: 6 },
        },
      },
    };
    expect(readGisProject(config)).toEqual({
      ...DEFAULT_GIS_PROJECT,
      view: { center: [120, 30], zoom: 6 },
    });
  });

  it("does not render until pmtiles style is ready", () => {
    expect(
      resolveGisRenderableBasemap(
        { ...DEFAULT_GIS_PROJECT, tileServiceId: DEFAULT_PMTILES_TILE_SERVICE_ID },
        false,
      ),
    ).toBeNull();
    expect(
      resolveGisRenderableBasemap(
        { ...DEFAULT_GIS_PROJECT, tileServiceId: DEFAULT_PMTILES_TILE_SERVICE_ID },
        true,
      ),
    ).toBe("pmtiles");
  });

  it("leaves tileServiceId unset when missing", () => {
    const config: ChartViewConfig = {
      chartType: "gis-map",
      nativeBody: { gisProject: { basemap: "pmtiles" } },
    };
    expect(readGisProject(config).basemap).toBe("pmtiles");
    expect(readGisProject(config).tileServiceId).toBeUndefined();
    expect(readGisProject(config).basemapFlavor).toBe("light");
  });

  it("resolveGisMapControls merges legacy showControls and granular mapControls", () => {
    expect(resolveGisMapControls({ showControls: true })).toMatchObject({
      navigation: true,
      scale: true,
    });
    expect(
      resolveGisMapControls({
        mapControls: { navigation: true, graticule: true },
      }),
    ).toMatchObject({
      navigation: true,
      graticule: true,
      attribution: true,
    });
  });

  it("normalizes basemap flavor and optional flags", () => {
    const config: ChartViewConfig = {
      chartType: "gis-map",
      nativeBody: {
        gisProject: {
          basemapFlavor: "dark",
          showControls: true,
          buildings3d: true,
          autoRotate: true,
        },
      },
    };
    const project = readGisProject(config);
    expect(project.basemapFlavor).toBe("dark");
    expect(project.showControls).toBe(true);
    expect(project.buildings3d).toBe(true);
    expect(project.autoRotate).toBe(true);
  });

  it("normalizes earth opacity and migrates legacy mapOpacity", () => {
    expect(
      readGisProject({
        chartType: "gis-map",
        nativeBody: { gisProject: { earthOpacity: 0.65 } },
      }).earthOpacity,
    ).toBe(0.65);
    expect(
      readGisProject({
        chartType: "gis-map",
        nativeBody: { gisProject: { mapOpacity: 0.4 } },
      }).earthOpacity,
    ).toBe(0.4);
    expect(
      readGisProject({
        chartType: "gis-map",
        nativeBody: { gisProject: { earthOpacity: 2 } },
      }).earthOpacity,
    ).toBeUndefined();
  });

  it("formats and clamps gis view draft fields", () => {
    expect(formatGisViewScalar(-92.5036543)).toBe("-92.50");
    expect(clampGisViewScalar("lng", -200)).toBe(-180);
    expect(clampGisViewScalar("lat", 90)).toBe(85);
    expect(clampGisViewScalar("zoom", 25)).toBe(22);
    expect(clampGisViewScalar("bearing", 270)).toBe(180);
    expect(clampGisViewScalar("pitch", -5)).toBe(0);

    const draft = formatGisViewDraftFromView({
      center: [-92.5036543, 52.36808583],
      zoom: 3.7449,
      bearing: 0,
      pitch: 0,
    });
    expect(draft).toEqual({
      centerLng: "-92.50",
      centerLat: "52.37",
      zoom: "3.74",
      bearing: "0.00",
      pitch: "0.00",
    });

    expect(finalizeGisViewDraftField("centerLng", "-92.5036543")).toBe("-92.50");
    expect(parseGisViewDraft(draft)).toEqual({
      center: [-92.5, 52.37],
      zoom: 3.74,
      bearing: 0,
      pitch: 0,
    });
    expect(parseGisViewDraft({ ...draft, centerLng: "200" })).toBeNull();
  });
});
