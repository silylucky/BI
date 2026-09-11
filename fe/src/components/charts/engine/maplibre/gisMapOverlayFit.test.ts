import { describe, expect, it } from "vitest";
import {
  buildGeoJsonBoundsKey,
  computeGeoJsonBounds,
} from "@/components/charts/engine/maplibre/gisMapOverlayFit";

describe("gisMapOverlayFit", () => {
  it("computes bounds from point features", () => {
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [116.4, 39.9] }, properties: {} },
        { type: "Feature", geometry: { type: "Point", coordinates: [121.5, 31.2] }, properties: {} },
      ],
    };
    expect(computeGeoJsonBounds(geojson)).toEqual([116.4, 31.2, 121.5, 39.9]);
    expect(buildGeoJsonBoundsKey(geojson)).toBe("116.4,31.2,121.5,39.9");
  });

  it("computes bounds from linestring features", () => {
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[0, 10], [20, -5]] },
          properties: {},
        },
      ],
    };
    expect(computeGeoJsonBounds(geojson)).toEqual([0, -5, 20, 10]);
  });
});
