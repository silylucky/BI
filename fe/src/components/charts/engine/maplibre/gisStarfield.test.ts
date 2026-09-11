import { describe, expect, it } from "vitest";
import {
  buildProceduralStars,
  resolveStarfieldParallaxOffset,
} from "@/components/charts/engine/maplibre/gisStarfield";

describe("gisStarfield parallax", () => {
  it("builds proportional star count", () => {
    const stars = buildProceduralStars(400, 300);
    expect(stars.length).toBeGreaterThan(100);
  });

  it("offsets stars when center longitude changes", () => {
    const at0 = resolveStarfieldParallaxOffset(100, 28, 100, 28, 400, 300);
    const at1 = resolveStarfieldParallaxOffset(101, 28, 100, 28, 400, 300);
    expect(at0.dx).toBe(0);
    expect(at1.dx).toBeCloseTo(400 / 360, 4);
  });
});
