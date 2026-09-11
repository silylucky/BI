import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountGisGlobeHaloOverlay } from "@/components/charts/engine/maplibre/gisGlobeHalo";

describe("mountGisGlobeHaloOverlay", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns dispose and requestPaint handles", () => {
    const wrapper = document.createElement("div");
    Object.defineProperty(wrapper, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrapper, "clientHeight", { value: 300, configurable: true });

    const handle = mountGisGlobeHaloOverlay(
      wrapper,
      () => null,
      () => ({ preset: "night", projection: "globe", effects: { enabled: true } }),
    );

    expect(typeof handle.requestPaint).toBe("function");
    expect(typeof handle.dispose).toBe("function");
    handle.dispose();
  });
});
