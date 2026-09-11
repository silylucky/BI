import { describe, expect, it } from "vitest";
import chinaProvinces from "@/assets/geo/china-provinces.json";
import { uvFromBboxPosition } from "@/components/charts/engine/three/geo/applyGeoCapBboxUv";
import {
  buildMapFitCollection,
  buildThreeGeoProject,
} from "@/components/charts/engine/three/geo/threeGeoProject";

const PROVINCE_CENTROIDS: Array<{ name: string; lng: number; lat: number }> = [
  { name: "黑龙江", lng: 126.6, lat: 48.5 },
  { name: "新疆", lng: 87.6, lat: 43.8 },
  { name: "广东", lng: 113.3, lat: 23.1 },
  { name: "西藏", lng: 91.1, lat: 29.6 },
];

describe("terrain UV alignment (projBounds + bbox UV)", () => {
  const fitCollection = buildMapFitCollection(chinaProvinces);
  const geoProject = buildThreeGeoProject(800, 600, fitCollection.features, fitCollection);
  const { projBounds } = geoProject;

  it("north province has larger mesh Y and larger bbox V", () => {
    const north = geoProject.project([126.6, 48.5]);
    const south = geoProject.project([113.3, 23.1]);
    expect(north).not.toBeNull();
    expect(south).not.toBeNull();
    expect(north![1]).toBeGreaterThan(south![1]);
    const [, vNorth] = uvFromBboxPosition(north![0], north![1], projBounds);
    const [, vSouth] = uvFromBboxPosition(south![0], south![1], projBounds);
    expect(vNorth).toBeGreaterThan(vSouth);
  });

  it("bbox UV spans east-west across China", () => {
    const west = uvFromBboxPosition(
      geoProject.project([87.6, 43.8])![0],
      geoProject.project([87.6, 43.8])![1],
      projBounds,
    );
    const east = uvFromBboxPosition(
      geoProject.project([121.5, 31.2])![0],
      geoProject.project([121.5, 31.2])![1],
      projBounds,
    );
    expect(east[0] - west[0]).toBeGreaterThan(0.35);
  });

  it("province centroids map to interior bbox UV", () => {
    for (const p of PROVINCE_CENTROIDS) {
      const mesh = geoProject.project([p.lng, p.lat]);
      expect(mesh).not.toBeNull();
      const [u, v] = uvFromBboxPosition(mesh![0], mesh![1], projBounds);
      expect(u).toBeGreaterThan(0.05);
      expect(u).toBeLessThan(0.95);
      expect(v).toBeGreaterThan(0.05);
      expect(v).toBeLessThan(0.95);
    }
  });

  it("projBounds corners map to UV extremes", () => {
    const sw = uvFromBboxPosition(projBounds.minX, projBounds.minY, projBounds);
    const ne = uvFromBboxPosition(projBounds.maxX, projBounds.maxY, projBounds);
    expect(sw[0]).toBeCloseTo(0, 5);
    expect(sw[1]).toBeCloseTo(0, 5);
    expect(ne[0]).toBeCloseTo(1, 5);
    expect(ne[1]).toBeCloseTo(1, 5);
  });
});
