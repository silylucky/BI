import { describe, expect, it, vi } from "vitest";
import {
  applyGisMapViewCamera,
  applyGisMapControls,
  captureGisMapViewCamera,
  registerGisMapViewLiveControl,
} from "@/components/charts/engine/maplibre/gisMapViewBridge";
import { resolveGisMapControls } from "@/components/charts/engine/maplibre/gisProject";

describe("gisMapViewBridge", () => {
  it("captures and applies registered camera by widget id", () => {
    const applyView = vi.fn(() => true);
    const dispose = registerGisMapViewLiveControl("w-gis", {
      capture: () => ({
        center: [120, 30],
        zoom: 4,
        bearing: 15,
        pitch: 45,
      }),
      applyView,
    });

    expect(captureGisMapViewCamera("w-gis")).toEqual({
      center: [120, 30],
      zoom: 4,
      bearing: 15,
      pitch: 45,
    });

    const next = { center: [116.4, 39.9] as [number, number], zoom: 8, bearing: 0, pitch: 0 };
    expect(applyGisMapViewCamera("w-gis", next)).toBe(true);
    expect(applyView).toHaveBeenCalledWith(next);

    dispose();
    expect(captureGisMapViewCamera("w-gis")).toBeNull();
    expect(applyGisMapViewCamera("w-gis", next)).toBe(false);
  });

  it("applies map controls through live bridge", () => {
    const applyMapControls = vi.fn(() => true);
    const dispose = registerGisMapViewLiveControl("w-gis", { applyMapControls });
    const controls = resolveGisMapControls({
      mapControls: { navigation: true, scale: true },
    });

    expect(applyGisMapControls("w-gis", controls)).toBe(true);
    expect(applyMapControls).toHaveBeenCalledWith(controls);

    dispose();
    expect(applyGisMapControls("w-gis", controls)).toBe(false);
  });
});
