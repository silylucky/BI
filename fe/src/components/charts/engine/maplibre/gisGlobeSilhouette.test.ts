import { describe, expect, it } from "vitest";
import {
  fitEllipseFromLimbPoints,
  rayToLimbPoint,
  resolveGlobeSilhouetteFromMap,
} from "@/components/charts/engine/maplibre/gisGlobeSilhouette";

describe("gisGlobeSilhouette", () => {
  const transform = {
    centerPoint: { x: 200, y: 150 },
    width: 400,
    height: 300,
    isPointOnMapSurface: (point: { x: number; y: number }) =>
      Math.hypot(point.x - 200, point.y - 150) <= 80,
  };

  it("rayToLimbPoint finds edge on circular probe", () => {
    const hit = rayToLimbPoint(transform, 200, 150, 0, 0);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(280, 0);
    expect(hit!.y).toBeCloseTo(150, 0);
  });

  it("fitEllipseFromLimbPoints recovers circle", () => {
    const points = Array.from({ length: 32 }, (_, i) => {
      const angle = (i / 32) * Math.PI * 2;
      return { x: 200 + Math.cos(angle) * 80, y: 150 + Math.sin(angle) * 80 };
    });
    const ellipse = fitEllipseFromLimbPoints(points);
    expect(ellipse).not.toBeNull();
    expect(ellipse?.cx).toBeCloseTo(200, 0);
    expect(ellipse?.cy).toBeCloseTo(150, 0);
    expect(ellipse?.rx).toBeCloseTo(80, 0);
    expect(ellipse?.ry).toBeCloseTo(80, 0);
  });

  it("resolveGlobeSilhouetteFromMap uses transform probe", () => {
    const map = { transform } as never;
    const silhouette = resolveGlobeSilhouetteFromMap(map);
    expect(silhouette?.rx).toBeGreaterThan(75);
    expect(silhouette?.rx).toBeLessThan(85);
  });
});
