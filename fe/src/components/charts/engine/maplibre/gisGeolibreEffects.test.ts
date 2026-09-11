import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { drawGeolibreComets } from "@/components/charts/engine/maplibre/gisGeolibreEffectsComets";
import { resolveGeolibreStarfieldParallaxOffset } from "@/components/charts/engine/maplibre/gisGeolibreEffectsStarfield";
import { nextGisEffectsFrameTime } from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";

describe("gisGeolibreEffects", () => {
  it("throttles animation frames to ~60fps", () => {
    expect(nextGisEffectsFrameTime(100, -Infinity)).toBe(100);
    expect(nextGisEffectsFrameTime(110, 100)).toBeNull();
    expect(nextGisEffectsFrameTime(117, 100)).toBe(117);
  });

  it("wraps starfield parallax when longitude shifts one degree", () => {
    const at0 = resolveGeolibreStarfieldParallaxOffset(0, 0, 0, 0, 360, 180);
    const at1 = resolveGeolibreStarfieldParallaxOffset(1, 0, 0, 0, 360, 180);
    expect(at0.x).toBe(0);
    expect(at1.x).toBeCloseTo(1, 4);
  });

  it("ages comets and drops expired ones", () => {
    const seed = [
      {
        x: 100,
        y: 100,
        len: 120,
        speed: 1,
        angle: 0,
        alpha: 1,
        life: 99,
        maxLife: 100,
      },
    ];
    const survivors = drawGeolibreComets(null as unknown as CanvasRenderingContext2D, 200, 200, seed, 2);
    expect(survivors).toHaveLength(0);
  });

  it("delegates atmosphere halo to mountGisGlobeHaloOverlay, not effects engine", () => {
    const effectsSource = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/gisGeolibreEffectsEngine.ts"),
      "utf8",
    );
    const viewSource = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/GisMapView.tsx"),
      "utf8",
    );

    expect(effectsSource).not.toContain("drawHaloLayer");
    expect(effectsSource).not.toContain("gis-effects-halo");
    expect(effectsSource).toContain("bindMapRenderSync");
    expect(effectsSource).toContain("GIS_MAP_STARS_Z");
    expect(viewSource).toContain("mountGisGlobeHaloOverlay");
  });
});
