import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { buildChartRenderModel } from "@/lib/buildChartRenderModel";
import { buildGisOverlayGeoJson } from "@/components/charts/engine/maplibre/gisMapOverlay";

describe("buildChartRenderModel gis-map", () => {
  it("is ready without dataset rows for basemap-only mode", () => {
    const config = defaultChartConfig("gis-map");
    expect(buildChartRenderModel(config, [], [])).toEqual({ kind: "ready" });
  });
});

describe("buildGisOverlayGeoJson", () => {
  it("builds point features from lng/lat dimensions", () => {
    const config = {
      ...defaultChartConfig("gis-map"),
      dimensions: [{ field: "lng" }, { field: "lat" }],
      metrics: [{ field: "value" }],
    };
    const geojson = buildGisOverlayGeoJson(
      config,
      ["lng", "lat", "value"],
      [
        [116.4, 39.9, 10],
        [121.5, 31.2, 20],
      ],
    );
    expect(geojson?.features).toHaveLength(2);
    expect(geojson?.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [116.4, 39.9],
    });
    expect(geojson?.features[0]?.properties).toMatchObject({ value: 10, sizeNorm: 0, color: expect.any(String) });
    expect(geojson?.features[1]?.properties).toMatchObject({ value: 20, sizeNorm: 1 });
  });

  it("normalizes sizeNorm across metric range", () => {
    const config = {
      ...defaultChartConfig("gis-map"),
      dimensions: [{ field: "lng" }, { field: "lat" }],
      metrics: [{ field: "value" }],
    };
    const geojson = buildGisOverlayGeoJson(
      config,
      ["lng", "lat", "value"],
      [
        [116.4, 39.9, 0],
        [121.5, 31.2, 100],
      ],
    );
    expect(geojson?.features[0]?.properties?.sizeNorm).toBe(0);
    expect(geojson?.features[1]?.properties?.sizeNorm).toBe(1);
  });

  it("uses layer binding field overrides when provided", () => {
    const config = {
      ...defaultChartConfig("gis-map"),
      dimensions: [{ field: "lng" }, { field: "lat" }],
      metrics: [{ field: "amount" }],
    };
    const geojson = buildGisOverlayGeoJson(
      config,
      ["longitude", "latitude", "amount"],
      [[116.4, 39.9, 5]],
      undefined,
      { binding: { lngField: "longitude", latField: "latitude", metricField: "amount" } },
    );
    expect(geojson?.features).toHaveLength(1);
    expect(geojson?.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [116.4, 39.9],
    });
  });
});
