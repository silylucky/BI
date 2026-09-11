import { describe, expect, it, vi } from "vitest";
import {
  advanceGlobeLongitude,
  applyGisMapStylePreservingCamera,
  classifyGisMapErrorHint,
  GLOBE_IDLE_ROTATION_DEG_PER_SEC,
  markGisMapPaintReady,
  mountGisLiveCameraTracking,
  normalizeGlobeLongitude,
  REAL_EARTH_ROTATION_DEG_PER_SEC,
  whenGisMapStyleReady,
} from "@/components/charts/engine/maplibre/gisMapRuntime";

describe("gisGlobeAutoRotate", () => {
  it("uses realistic earth rotation speed", () => {
    expect(REAL_EARTH_ROTATION_DEG_PER_SEC).toBeCloseTo(360 / 86400, 8);
    expect(GLOBE_IDLE_ROTATION_DEG_PER_SEC).toBeCloseTo(360 / (8 * 60), 8);
  });

  it("wraps longitude", () => {
    expect(normalizeGlobeLongitude(190)).toBe(-170);
    expect(normalizeGlobeLongitude(-190)).toBe(170);
  });

  it("advances longitude west for eastward spin", () => {
    expect(advanceGlobeLongitude(100, 1, 10)).toBe(90);
    expect(advanceGlobeLongitude(-179, 1, 2)).toBe(179);
  });
});

describe("whenGisMapStyleReady", () => {
  it("runs immediately when style is loaded", () => {
    const run = vi.fn();
    whenGisMapStyleReady(
      {
        isStyleLoaded: () => true,
        loaded: () => true,
        once: vi.fn(),
        off: vi.fn(),
      } as never,
      run,
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps listening when load fires before style is ready", () => {
    const run = vi.fn();
    const once = vi.fn();
    const off = vi.fn();
    const handlers = new Map<string, () => void>();
    once.mockImplementation((event: string, cb: () => void) => {
      handlers.set(event, cb);
    });
    off.mockImplementation((event: string) => {
      handlers.delete(event);
    });
    let styleLoaded = false;
    const map = {
      isStyleLoaded: () => styleLoaded,
      loaded: () => false,
      once,
      off,
    };

    whenGisMapStyleReady(map as never, run);
    handlers.get("load")?.();
    expect(run).not.toHaveBeenCalled();
    expect(handlers.has("style.load")).toBe(true);

    styleLoaded = true;
    handlers.get("style.load")?.();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("applyGisMapStylePreservingCamera", () => {
  it("restores override camera after style.load", () => {
    const jumpTo = vi.fn();
    const resize = vi.fn();
    const handlers = new Map<string, () => void>();
    const map = {
      getCenter: () => ({ lng: 1, lat: 2 }),
      getZoom: () => 3,
      getBearing: () => 4,
      getPitch: () => 5,
      setStyle: vi.fn(),
      once: vi.fn((event: string, cb: () => void) => {
        handlers.set(event, cb);
      }),
      resize,
      jumpTo,
    };
    const override = {
      center: [116.4, 39.9] as [number, number],
      zoom: 8,
      bearing: 10,
      pitch: 30,
    };

    applyGisMapStylePreservingCamera(map as never, {} as never, undefined, override);
    handlers.get("style.load")?.();

    expect(jumpTo).toHaveBeenCalledWith({
      center: override.center,
      zoom: override.zoom,
      bearing: override.bearing,
      pitch: override.pitch,
    });
  });
});

describe("mountGisLiveCameraTracking", () => {
  it("syncs camera on moveend", () => {
    const handlers = new Map<string, () => void>();
    const map = {
      on: vi.fn((event: string, cb: () => void) => {
        handlers.set(event, cb);
      }),
      off: vi.fn(),
      getCenter: () => ({ lng: 120, lat: 30 }),
      getZoom: () => 6,
      getBearing: () => 0,
      getPitch: () => 0,
    };
    const onCameraChange = vi.fn();
    mountGisLiveCameraTracking(map as never, onCameraChange);
    handlers.get("moveend")?.();
    expect(onCameraChange).toHaveBeenCalledWith({
      center: [120, 30],
      zoom: 6,
      bearing: 0,
      pitch: 0,
    });
  });
});

describe("markGisMapPaintReady", () => {
  it("finishes on first idle for globe without waiting for areTilesLoaded", () => {
    const onReady = vi.fn();
    const map = {
      isStyleLoaded: () => true,
      areTilesLoaded: () => false,
      triggerRepaint: vi.fn(),
      once: vi.fn((event: string, cb: () => void) => {
        if (event === "idle" || event === "render") cb();
      }),
    };
    markGisMapPaintReady(map as never, onReady, () => false, "globe");
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe("classifyGisMapErrorHint", () => {
  it("ignores non-blocking sprite warnings", () => {
    expect(classifyGisMapErrorHint('Image "townspot" could not be loaded')).toBeNull();
  });

  it("maps glyph fetch failures to font hint", () => {
    expect(
      classifyGisMapErrorHint(
        "AJAXError: Failed to fetch (0): https://protomaps.github.io/basemaps-assets/fonts/Noto Sans Regular/0-255.pbf",
      ),
    ).toContain("同一瓦片服务");
  });

  it("maps generic fonts fetch failures to the same colocated-assets hint", () => {
    const hint = classifyGisMapErrorHint(
      "Failed to fetch http://127.0.0.1:8080/basemaps-assets/fonts/Noto%20Sans%20Regular/0-255.pbf",
    );
    expect(hint).toContain("同一瓦片服务");
    expect(hint).not.toMatch(/网络|内网镜像/);
  });

  it("maps sprite fetch failures to the same colocated-assets hint", () => {
    const hint = classifyGisMapErrorHint(
      "Failed to fetch http://127.0.0.1:8080/basemaps-assets/sprites/v4/light.json",
    );
    expect(hint).toContain("同一瓦片服务");
    expect(hint).not.toMatch(/网络|内网镜像/);
  });

  it("maps pmtiles cors failures to tile hint", () => {
    expect(classifyGisMapErrorHint("Failed to fetch pmtiles://http://127.0.0.1:8080/a.pmtiles")).toContain(
      "PMTiles",
    );
  });
});
