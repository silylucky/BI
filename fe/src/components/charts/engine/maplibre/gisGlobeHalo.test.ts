import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GIS_EFFECTS_SETTINGS,
  normalizeGisEffectsSettings,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";
import { drawGlobeAtmosphereHalo } from "@/components/charts/engine/maplibre/gisGlobeHaloDraw";

describe("gisGlobeHalo GeoLibre draw", () => {
  it("draws screen-blended halo arc with HALO_STOP_SHAPE", () => {
    const gradient = { addColorStop: vi.fn() };
    const ctx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
      globalCompositeOperation: "",
    } as unknown as CanvasRenderingContext2D;

    drawGlobeAtmosphereHalo(
      ctx,
      400,
      300,
      { x: 200, y: 150, radius: 120 },
      DEFAULT_GIS_EFFECTS_SETTINGS,
    );

    expect(ctx.createRadialGradient).toHaveBeenCalledWith(
      200,
      150,
      120,
      200,
      150,
      120 * DEFAULT_GIS_EFFECTS_SETTINGS.haloExtent,
    );
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(
      200,
      150,
      120 * DEFAULT_GIS_EFFECTS_SETTINGS.haloExtent,
      0,
      Math.PI * 2,
    );
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.globalCompositeOperation).toBe("screen");
    expect(gradient.addColorStop).toHaveBeenCalled();
    expect(normalizeGisEffectsSettings({ haloExtent: 99 }).haloExtent).toBe(4);
  });
});
