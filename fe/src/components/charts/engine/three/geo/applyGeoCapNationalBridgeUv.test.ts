import { describe, expect, it } from "vitest";
import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import guizhouCitiesGeo from "@/assets/geo/cities/520000.json";
import {
  capUvViaNationalBridge,
  nationalUvForLngLat,
} from "@/components/charts/engine/three/geo/applyGeoCapNationalBridgeUv";
import {
  buildMapFitCollection,
  buildNationalTerrainProject,
  buildTerrainAlignedGeoProject,
} from "@/components/charts/engine/three/geo/threeGeoProject";

describe("applyGeoCapNationalBridgeUv", () => {
  const national = buildNationalTerrainProject(chinaProvincesGeo);
  const local = buildTerrainAlignedGeoProject(800, 600, "vs-geo-540000", 1, guizhouCitiesGeo);
  const bridge = { local, national };

  it("maps Ngari mesh to national interior UV", () => {
    const mesh = local.project([82.564653, 33.063726]);
    expect(mesh).not.toBeNull();
    const [u, v] = capUvViaNationalBridge(mesh![0], mesh![1], bridge);
    const [nu, nv] = nationalUvForLngLat(82.564653, 33.063726, national);
    expect(u).toBeCloseTo(nu, 3);
    expect(v).toBeCloseTo(nv, 3);
    expect(u).toBeGreaterThan(0.05);
    expect(u).toBeLessThan(0.95);
    expect(v).toBeGreaterThan(0.05);
    expect(v).toBeLessThan(0.95);
  });

  it("maps Beijing mesh via bridge consistently with direct national UV", () => {
    const localBj = buildTerrainAlignedGeoProject(800, 600, "vs-geo-110000", 1, {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "东城区" },
          geometry: {
            type: "Point",
            coordinates: [116.4, 39.9],
          } as unknown as GeoJSON.Point,
        },
      ],
    });
    const mesh = localBj.project([116.4, 39.9]);
    expect(mesh).not.toBeNull();
    const [u, v] = capUvViaNationalBridge(mesh![0], mesh![1], {
      local: localBj,
      national,
    });
    const [nu, nv] = nationalUvForLngLat(116.4, 39.9, national);
    expect(u).toBeCloseTo(nu, 3);
    expect(v).toBeCloseTo(nv, 3);
  });
});
