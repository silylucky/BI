import { describe, expect, it } from "vitest";
import * as d3 from "d3";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import {
  fitChinaGeoProjection,
  isDecorativeGeoFeature,
  prepareOfflineGeoGeometry,
} from "@/components/charts/engine/geo/geoProjection";
import { joinOfflineMapFeatures } from "@/components/charts/engine/geo/OfflineGeoPort";

describe("geoProjection", () => {
  it("filters nine-dash-line decorative feature from choropleth join", () => {
    const jd = chinaProvincesGeo.features.find((f) => f.properties?.adchar === "JD");
    expect(jd).toBeTruthy();
    expect(isDecorativeGeoFeature(jd?.properties)).toBe(true);

    const joined = joinOfflineMapFeatures([], ["province", "value"], "province", "value", "vs-regions");
    expect(joined).toHaveLength(34);
    expect(joined.every((f) => f.name.length > 0)).toBe(true);
  });

  it("joins business region codes via areaMapping", () => {
    const lookup = new Map([["EAST_01", "江苏省"]]);
    const joined = joinOfflineMapFeatures(
      [["EAST_01", 120]],
      ["province", "value"],
      "province",
      "value",
      "vs-regions",
      undefined,
      0,
      lookup,
    );
    const jiangsu = joined.find((f) => f.name === "江苏省");
    expect(jiangsu?.value).toBe(120);
  });

  it("normalizes malformed province rings for d3 geoPath", () => {
    const named = chinaProvincesGeo.features.filter((f) => !isDecorativeGeoFeature(f.properties));
    const collection = {
      type: "FeatureCollection" as const,
      features: named.map((feature) => ({
        type: "Feature" as const,
        properties: { name: feature.properties?.name ?? "" },
        geometry: prepareOfflineGeoGeometry(feature.geometry as GeoJSON.Geometry),
      })),
    };
    const projection = fitChinaGeoProjection(d3.geoMercator(), 400, 320, collection);
    const path = d3.geoPath().projection(projection);
    const beijing = collection.features.find((f) => f.properties.name === "北京市");
    expect(beijing).toBeTruthy();

    const bounds = path.bounds(beijing!);
    const width = bounds[1][0] - bounds[0][0];
    const height = bounds[1][1] - bounds[0][1];
    expect(width).toBeLessThan(40);
    expect(height).toBeLessThan(40);

    const d = path(beijing!) ?? "";
    expect((d.match(/Z/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});
