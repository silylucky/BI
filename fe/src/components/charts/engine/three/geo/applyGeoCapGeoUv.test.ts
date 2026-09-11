import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  applyGeoCapGeoUv,
  lngLatToTerrainCapUv,
} from "@/components/charts/engine/three/geo/applyGeoCapGeoUv";
import { CHINA_TERRAIN_BOUNDS } from "@/assets/geo/terrain/manifest";
import { lngLatToLinearLatCapUv } from "@/lib/geoMercatorUv";
import {
  THREE_GEO_MAP_MARGIN,
  buildThreeGeoProject,
} from "@/components/charts/engine/three/geo/threeGeoProject";

describe("lngLatToTerrainCapUv", () => {
  it("maps southwest to u=0 v=1", () => {
    const [u, v] = lngLatToTerrainCapUv(
      CHINA_TERRAIN_BOUNDS.west,
      CHINA_TERRAIN_BOUNDS.south,
      CHINA_TERRAIN_BOUNDS,
    );
    expect(u).toBeCloseTo(0, 5);
    expect(v).toBeCloseTo(1, 5);
  });

  it("maps northeast to u=1 v=0", () => {
    const [u, v] = lngLatToTerrainCapUv(
      CHINA_TERRAIN_BOUNDS.east,
      CHINA_TERRAIN_BOUNDS.north,
      CHINA_TERRAIN_BOUNDS,
    );
    expect(u).toBeCloseTo(1, 5);
    expect(v).toBeCloseTo(0, 5);
  });

  it("uses Web Mercator v at Beijing, not linear latitude", () => {
    const [, vMerc] = lngLatToTerrainCapUv(116.4, 39.9, CHINA_TERRAIN_BOUNDS);
    const [, vLin] = lngLatToLinearLatCapUv(116.4, 39.9, CHINA_TERRAIN_BOUNDS);
    expect(vMerc).not.toBeCloseTo(vLin, 2);
  });
});

describe("applyGeoCapGeoUv", () => {
  it("writes UVs in 0-1 for a projected rectangle", () => {
    const featureCollection = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [105, 30],
                [106, 30],
                [106, 31],
                [105, 31],
                [105, 30],
              ],
            ],
          },
        },
      ],
    };
    const geoProject = buildThreeGeoProject(800, 600, [], featureCollection);
    const shape = new THREE.Shape();
    shape.moveTo(-10, -10);
    shape.lineTo(10, -10);
    shape.lineTo(10, 10);
    shape.lineTo(-10, 10);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    applyGeoCapGeoUv(geometry, {
      geoBounds: CHINA_TERRAIN_BOUNDS,
      projBounds: geoProject.projBounds,
      projection: geoProject.projection,
      viewport: geoProject.viewport,
      margin: THREE_GEO_MAP_MARGIN,
      centerX: geoProject.centerX,
      centerY: geoProject.centerY,
    });
    const uvs = geometry.attributes.uv as THREE.BufferAttribute;
    let maxU = 0;
    let maxV = 0;
    for (let i = 0; i < uvs.count; i += 1) {
      maxU = Math.max(maxU, uvs.getX(i));
      maxV = Math.max(maxV, uvs.getY(i));
    }
    expect(maxU).toBeGreaterThan(0);
    expect(maxV).toBeGreaterThan(0);
    expect(maxU).toBeLessThanOrEqual(1);
    expect(maxV).toBeLessThanOrEqual(1);
  });
});
