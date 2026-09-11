import { describe, expect, it } from "vitest";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  isIdentityGeoViewTransform,
  isValidGeoViewTransform,
  patchChartGeo3dOrbitView,
  patchChartGeoViewTransform,
} from "@/lib/chartGeoViewState";
import { readChartDeStyle, readChartGeo3dStyle, readChartGeoStyle } from "@/lib/chartDeStyle";

const baseConfig = {
  chartType: "map",
  dimensions: [],
  metrics: [],
} as ChartViewConfig;

describe("chartGeoViewState", () => {
  it("detects identity transform", () => {
    expect(isIdentityGeoViewTransform({ x: 0, y: 0, k: 1 })).toBe(true);
    expect(isIdentityGeoViewTransform({ x: 12, y: 0, k: 1 })).toBe(false);
  });

  it("rejects extreme pan that pushes map off canvas", () => {
    expect(isValidGeoViewTransform({ x: 20, y: 10, k: 1.5 }, 720, 333)).toBe(true);
    expect(isValidGeoViewTransform({ x: -4725.6, y: -4386.55, k: 4 }, 720, 333)).toBe(false);
    expect(isValidGeoViewTransform({ x: 0, y: 0, k: 8 }, 400, 320)).toBe(false);
  });

  it("patches 2D view transform by mapId", () => {
    const next = patchChartGeoViewTransform(baseConfig, "vs-regions", {
      x: 12.345,
      y: -4.567,
      k: 1.23456,
    });
    const geo = readChartGeoStyle(readChartDeStyle(next));
    expect(geo.viewTransforms?.["vs-regions"]).toEqual({
      x: 12.35,
      y: -4.57,
      k: 1.235,
    });
  });

  it("clears identity transform bucket", () => {
    const seeded = patchChartGeoViewTransform(baseConfig, "vs-regions", { x: 10, y: 5, k: 1.2 });
    const cleared = patchChartGeoViewTransform(seeded, "vs-regions", { x: 0, y: 0, k: 1 });
    const geo = readChartGeoStyle(readChartDeStyle(cleared));
    expect(geo.viewTransforms).toBeUndefined();
  });

  it("patches 3D orbit view by mapId", () => {
    const next = patchChartGeo3dOrbitView(
      { ...baseConfig, chartType: "map-3d" },
      "440000",
      {
        target: { x: 0.12, y: 1.23, z: 0.45 },
        position: { x: 10.12, y: 20.34, z: 30.56 },
      },
    );
    const geo3d = readChartGeo3dStyle(readChartDeStyle(next));
    expect(geo3d.orbitViews?.["440000"]).toEqual({
      target: { x: 0.12, y: 1.23, z: 0.45 },
      position: { x: 10.12, y: 20.34, z: 30.56 },
    });
  });
});
