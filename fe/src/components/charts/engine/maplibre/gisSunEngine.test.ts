import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GIS_SUN_SETTINGS } from "@/components/charts/engine/maplibre/gisSunPosition";
import { GisSunEngine } from "@/components/charts/engine/maplibre/gisSunEngine";

function createMockMap() {
  const listeners = new Map<string, Set<() => void>>();
  const layers = new Map<string, Record<string, unknown>>();
  const sources = new Map<string, Record<string, unknown>>();
  return {
    listeners,
    layers,
    sources,
    map: {
      isStyleLoaded: () => true,
      on: (event: string, handler: () => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(handler);
        listeners.set(event, set);
      },
      off: (event: string, handler: () => void) => {
        listeners.get(event)?.delete(handler);
      },
      getSource: (id: string) => sources.get(id),
      getLayer: (id: string) => layers.get(id),
      addSource: (id: string, spec: Record<string, unknown>) => {
        sources.set(id, spec);
      },
      addLayer: (spec: { id: string }) => {
        layers.set(spec.id, spec);
      },
      removeLayer: (id: string) => {
        layers.delete(id);
      },
      removeSource: (id: string) => {
        sources.delete(id);
      },
      moveLayer: vi.fn(),
      getCenter: () => ({ lat: 30, lng: 120 }),
      getLight: () => ({ anchor: "viewport" }),
      getSky: () => ({ "atmosphere-blend": 0.8 }),
      setSky: vi.fn(),
      setLight: vi.fn(),
    },
    dropStyle: () => {
      layers.clear();
      sources.clear();
      listeners.get("styledata")?.forEach((handler) => handler());
    },
  };
}

describe("GisSunEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-attaches night layers after style swap without recreating engine", () => {
    const mock = createMockMap();
    const engine = new GisSunEngine(mock.map as never, { ...DEFAULT_GIS_SUN_SETTINGS, playing: false });
    expect(mock.sources.has("vs-gis-sun-night-source")).toBe(true);

    mock.sources.delete("vs-gis-sun-night-source");
    mock.layers.delete("vs-gis-sun-night-layer");
    expect(mock.sources.has("vs-gis-sun-night-source")).toBe(false);

    engine.render();
    expect(mock.sources.has("vs-gis-sun-night-source")).toBe(true);
    engine.destroy();
  });

  it("restarts animation when playing stays true but raf loop was lost", () => {
    const mock = createMockMap();
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 7);
    const engine = new GisSunEngine(mock.map as never, { ...DEFAULT_GIS_SUN_SETTINGS, playing: false });
    engine.applySettings({ playing: true });
    engine.pause();
    rafSpy.mockClear();

    engine.applySettings({ playing: true });
    expect(rafSpy).toHaveBeenCalled();
    engine.destroy();
  });
});
