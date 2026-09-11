import { describe, expect, it } from "vitest";
import {
  isGlobeTransformProbeReady,
  isInsideGlobeDisc,
  offsetMapPixelToOverlay,
  resolveGlobeLimbBoundsForHaloPaint,
  resolveGlobeLimbBoundsForOverlay,
  resolveGlobeLimbBoundsFromMap,
  resolveGlobeLimbBoundsFromProject,
  resolveGlobeStarViewRotation,
} from "@/components/charts/engine/maplibre/gisGlobeLayout";

describe("gisGlobeLayout stars", () => {
  const globe = {
    x: 200,
    y: 150,
    radius: 120,
    bearing: 0,
    pitch: 0,
    centerLng: 100,
    centerLat: 28,
  };

  it("combines bearing and center longitude for star rotation", () => {
    expect(resolveGlobeStarViewRotation({ ...globe, bearing: 15, centerLng: 100 })).toBe(115);
  });

  it("detects points inside globe disc", () => {
    expect(isInsideGlobeDisc(globe.x, globe.y, globe)).toBe(true);
    expect(isInsideGlobeDisc(globe.x + globe.radius + 10, globe.y, globe)).toBe(false);
  });
});

describe("resolveGlobeLimbBoundsFromMap", () => {
  it("raycasts the rendered globe disc from transform surface probe", () => {
    const map = {
      getCenter: () => ({ lng: 100, lat: 28 }),
      project: () => ({ x: 200, y: 150 }),
      transform: {
        centerPoint: { x: 200, y: 150 },
        width: 400,
        height: 300,
        isPointOnMapSurface: (point: { x: number; y: number }) =>
          Math.hypot(point.x - 200, point.y - 150) <= 80,
      },
    };

    const limb = resolveGlobeLimbBoundsFromMap(map as never);
    expect(limb).not.toBeNull();
    expect(limb?.x).toBeCloseTo(200, 0);
    expect(limb?.y).toBeCloseTo(150, 0);
    expect(limb?.radius).toBeGreaterThan(75);
    expect(limb?.radius).toBeLessThan(85);
  });
});

describe("resolveGlobeLimbBoundsFromProject", () => {
  it("builds a bbox from projected horizon samples", () => {
    const map = {
      getCenter: () => ({ lng: 0, lat: 0 }),
      project: ([lng, lat]: [number, number]) => ({
        x: 200 + lng,
        y: 150 + lat,
      }),
    };
    const limb = resolveGlobeLimbBoundsFromProject(map as never);
    expect(limb).not.toBeNull();
    expect(limb?.radius).toBeGreaterThan(0);
  });
});

describe("offsetMapPixelToOverlay", () => {
  it("uses layout offset chain when map host is nested in overlay", () => {
    const overlay = document.createElement("div");
    const mapHost = document.createElement("div");
    Object.defineProperty(mapHost, "offsetLeft", { value: 12, configurable: true });
    Object.defineProperty(mapHost, "offsetTop", { value: 8, configurable: true });
    Object.defineProperty(mapHost, "offsetParent", { value: overlay, configurable: true });
    overlay.appendChild(mapHost);

    const map = { getContainer: () => mapHost };
    const mapped = offsetMapPixelToOverlay(map as never, overlay, { x: 200, y: 150, radius: 80 });
    expect(mapped).toEqual({ x: 212, y: 158, radius: 80 });
  });

  it("returns map-local coords when overlay is the map container", () => {
    const mapHost = document.createElement("div");
    const map = { getContainer: () => mapHost };
    const mapped = offsetMapPixelToOverlay(map as never, mapHost, { x: 200, y: 150, radius: 80 });
    expect(mapped).toEqual({ x: 200, y: 150, radius: 80 });
  });
});

describe("resolveGlobeLimbBoundsForOverlay", () => {
  it("prefers live raycast radius over viewport fallback when zoomed out", () => {
    const mapHost = document.createElement("div");
    const map = {
      isStyleLoaded: () => true,
      getContainer: () => mapHost,
      getCenter: () => ({ lng: 100, lat: 28 }),
      getPitch: () => 0,
      getBearing: () => 0,
      transform: {
        centerPoint: { x: 200, y: 150 },
        worldSize: 512,
        center: { lat: 28 },
        width: 400,
        height: 300,
        isPointOnMapSurface: (point: { x: number; y: number }) =>
          Math.hypot(point.x - 200, point.y - 150) <= 30,
      },
    };

    const limb = resolveGlobeLimbBoundsForOverlay(map as never, mapHost, 400, 300);
    expect(limb).not.toBeNull();
    expect(limb!.radius).toBeLessThan(80);
    expect(limb!.x).toBeCloseTo(200, 0);
    expect(limb!.y).toBeCloseTo(150, 0);
  });

  it("clamps overshoot raycast to analytical globe radius", () => {
    const mapHost = document.createElement("div");
    const map = {
      isStyleLoaded: () => true,
      getContainer: () => mapHost,
      getCenter: () => ({ lng: 100, lat: 28 }),
      getPitch: () => 0,
      getBearing: () => 0,
      transform: {
        centerPoint: { x: 200, y: 150 },
        worldSize: 512,
        center: { lat: 28 },
        width: 400,
        height: 300,
        isPointOnMapSurface: () => true,
      },
    };

    const limb = resolveGlobeLimbBoundsForOverlay(map as never, mapHost, 400, 300);
    expect(limb).not.toBeNull();
    expect(limb!.radius).toBeLessThan(120);
    expect(limb!.x).toBeCloseTo(200, 0);
    expect(limb!.y).toBeCloseTo(150, 0);
  });

  it("shrinks limb radius under pitch perspective", () => {
    const mapHost = document.createElement("div");
    const makeMap = (pitch: number) => ({
      isStyleLoaded: () => true,
      getContainer: () => mapHost,
      getCenter: () => ({ lng: 100, lat: 28 }),
      getPitch: () => pitch,
      getBearing: () => 0,
      transform: {
        centerPoint: { x: 200, y: 150 },
        worldSize: 512,
        center: { lat: 28 },
        width: 400,
        height: 300,
        isPointOnMapSurface: (point: { x: number; y: number }) =>
          Math.hypot(point.x - 200, point.y - 150) <= 80,
      },
    });
    const flat = resolveGlobeLimbBoundsForOverlay(makeMap(0) as never, mapHost, 400, 300);
    const tilted = resolveGlobeLimbBoundsForOverlay(makeMap(60) as never, mapHost, 400, 300);
    expect(flat).not.toBeNull();
    expect(tilted).not.toBeNull();
    expect(tilted!.radius).toBeLessThan(flat!.radius);
  });

  it("returns null when transform probe is unavailable instead of viewport fallback", () => {
    const mapHost = document.createElement("div");
    const map = {
      isStyleLoaded: () => true,
      getContainer: () => mapHost,
      getCanvasContainer: () => mapHost,
      getProjection: () => ({ type: "globe" }),
      getCenter: () => ({ lng: 100, lat: 28 }),
      getPitch: () => 0,
      getBearing: () => 0,
      project: () => ({ x: 200, y: 150 }),
      transform: {
        centerPoint: { x: 200, y: 150 },
        worldSize: 512,
        center: { lat: 28 },
        width: 400,
        height: 300,
      },
    };

    expect(isGlobeTransformProbeReady(map as never)).toBe(false);
    expect(resolveGlobeLimbBoundsForOverlay(map as never, mapHost, 400, 300)).toBeNull();
  });

  it("resolves halo limb via project sampling when surface probe is unavailable", () => {
    const mapHost = document.createElement("div");
    const map = {
      isStyleLoaded: () => true,
      getContainer: () => mapHost,
      getCanvasContainer: () => mapHost,
      getProjection: () => ({ type: "globe" }),
      getCenter: () => ({ lng: 0, lat: 0 }),
      getPitch: () => 0,
      getBearing: () => 0,
      project: ([lng, lat]: [number, number]) => ({
        x: 200 + lng,
        y: 150 + lat,
      }),
      transform: {
        centerPoint: { x: 200, y: 150 },
        worldSize: 512,
        center: { lat: 0 },
        width: 400,
        height: 300,
      },
    };

    const limb = resolveGlobeLimbBoundsForHaloPaint(map as never, mapHost, 400, 300);
    expect(limb).not.toBeNull();
    expect(limb!.radius).toBeGreaterThan(0);
  });
});
