import { describe, expect, it } from "vitest";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import {
  buildRegionPointSamples,
  resolveRegionAnchorProjected,
  resolveRegionCentroidLngLat,
} from "@/components/charts/engine/three/geo3dRegionCentroid";
import { joinOfflineMapFeatures } from "@/components/charts/engine/geo/OfflineGeoPort";
import {
  buildMapFitCollection,
  buildThreeGeoProject,
} from "@/components/charts/engine/three/geo/threeGeoProject";
describe("geo3dRegionCentroid", () => {
  it("computes centroid from point geometry", () => {
    const geometry: GeoJSON.Point = {
      type: "Point",
      coordinates: [100.5, 30.5],
    };
    const centroid = resolveRegionCentroidLngLat(geometry);
    expect(centroid?.[0]).toBeCloseTo(100.5, 5);
    expect(centroid?.[1]).toBeCloseTo(30.5, 5);
  });

  it("builds projected samples with normalized valueT", () => {
    const samples = buildRegionPointSamples(
      [
        {
          name: "A",
          value: 10,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [100, 30],
                [101, 30],
                [101, 31],
                [100, 31],
                [100, 30],
              ],
            ],
          },
        },
        {
          name: "B",
          value: 30,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [102, 30],
                [103, 30],
                [103, 31],
                [102, 31],
                [102, 30],
              ],
            ],
          },
        },
      ],
      (coord) => [coord[0] * 10, coord[1] * 10],
      10,
      30,
    );
    expect(samples).toHaveLength(2);
    expect(samples[0]?.valueT).toBe(0);
    expect(samples[1]?.valueT).toBe(1);
  });

  it("uses projected polygon centroid instead of lng/lat centroid", () => {
    const geometry: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [100, 30],
          [102, 30],
          [102, 32],
          [100, 32],
          [100, 30],
        ],
      ],
    };
    const project = (coord: [number, number]) => [coord[0] * 10, coord[1] * 10] as [number, number];
    const fromProjected = buildRegionPointSamples(
      [{ name: "box", value: 1, geometry }],
      project,
      0,
      1,
    )[0];
    expect(fromProjected?.x).toBeCloseTo(1010, 3);
    expect(fromProjected?.y).toBeCloseTo(310, 3);
  });

  it("anchors provinces using official centroid from joined features", () => {
    const joined = joinOfflineMapFeatures([], ["p", "v"], "p", "v", "vs-regions");
    const fitCollection = buildMapFitCollection(chinaProvincesGeo);
    const ctx = buildThreeGeoProject(800, 600, fitCollection.features, fitCollection);
    const shandong = joined.find((f) => f.name === "山东省");
    const hebei = joined.find((f) => f.name === "河北省");
    expect(shandong?.labelLngLat).toBeTruthy();
    expect(hebei?.labelLngLat).toBeTruthy();

    const shandongAnchor = resolveRegionAnchorProjected(shandong!, ctx.project);
    const hebeiAnchor = resolveRegionAnchorProjected(hebei!, ctx.project);

    expect(shandongAnchor![0]).toBeCloseTo(ctx.project(shandong!.labelLngLat!)![0], 3);
    expect(shandongAnchor![1]).toBeCloseTo(ctx.project(shandong!.labelLngLat!)![1], 3);
    expect(hebeiAnchor![0]).toBeCloseTo(ctx.project(hebei!.labelLngLat!)![0], 3);
    expect(hebeiAnchor![1]).toBeCloseTo(ctx.project(hebei!.labelLngLat!)![1], 3);
  });
});
