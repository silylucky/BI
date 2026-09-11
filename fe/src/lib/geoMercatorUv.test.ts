import { describe, expect, it } from "vitest";
import {
  lngLatToLinearLatCapUv,
  lngLatToMercatorCapUv,
  mercatorNormalizedY,
} from "@/lib/geoMercatorUv";
import { CHINA_TERRAIN_BOUNDS } from "@/assets/geo/terrain/manifest";

/** 与 satelliteTileStitch.mjs lngLatToTileFloat 的 y/n 一致 */
function stitchMercatorY(lat: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
}

describe("mercatorNormalizedY", () => {
  it("matches satelliteTileStitch lngLatToTileFloat y/n at zoom=1", () => {
    for (const lat of [2.39, 23, 39.9, 45, 54.57]) {
      expect(mercatorNormalizedY(lat)).toBeCloseTo(stitchMercatorY(lat), 10);
    }
  });

  it("decreases as latitude increases (tile row convention)", () => {
    expect(mercatorNormalizedY(54)).toBeLessThan(mercatorNormalizedY(23));
  });
});

describe("lngLatToMercatorCapUv", () => {
  it("maps southwest corner to u=0 v=1", () => {
    const [u, v] = lngLatToMercatorCapUv(
      CHINA_TERRAIN_BOUNDS.west,
      CHINA_TERRAIN_BOUNDS.south,
      CHINA_TERRAIN_BOUNDS,
    );
    expect(u).toBeCloseTo(0, 5);
    expect(v).toBeCloseTo(1, 5);
  });

  it("maps northeast corner to u=1 v=0", () => {
    const [u, v] = lngLatToMercatorCapUv(
      CHINA_TERRAIN_BOUNDS.east,
      CHINA_TERRAIN_BOUNDS.north,
      CHINA_TERRAIN_BOUNDS,
    );
    expect(u).toBeCloseTo(1, 5);
    expect(v).toBeCloseTo(0, 5);
  });

  it("differs from linear latitude UV at Beijing (~39.9N)", () => {
    const lng = 116.4;
    const lat = 39.9;
    const [uMerc, vMerc] = lngLatToMercatorCapUv(lng, lat, CHINA_TERRAIN_BOUNDS);
    const [uLin, vLin] = lngLatToLinearLatCapUv(lng, lat, CHINA_TERRAIN_BOUNDS);
    expect(uMerc).toBeCloseTo(uLin, 5);
    expect(vMerc).not.toBeCloseTo(vLin, 2);
    expect(Math.abs(vMerc - vLin)).toBeGreaterThan(0.04);
  });

  it("differs from linear latitude UV at Urumqi (~43.8N)", () => {
    const lng = 87.6;
    const lat = 43.8;
    const [, vMerc] = lngLatToMercatorCapUv(lng, lat, CHINA_TERRAIN_BOUNDS);
    const [, vLin] = lngLatToLinearLatCapUv(lng, lat, CHINA_TERRAIN_BOUNDS);
    expect(vMerc).not.toBeCloseTo(vLin, 2);
  });

  it("clamps out-of-bounds coordinates into 0–1", () => {
    const [u, v] = lngLatToMercatorCapUv(0, 0, CHINA_TERRAIN_BOUNDS);
    expect(u).toBe(0);
    expect(v).toBe(1);
  });
});
