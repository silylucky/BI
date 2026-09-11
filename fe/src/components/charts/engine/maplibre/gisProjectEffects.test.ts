import { describe, expect, it } from "vitest";
import { normalizeGisProjectEffects } from "@/components/charts/engine/maplibre/gisProjectEffects";

describe("normalizeGisProjectEffects", () => {
  it("persists enabled true for save/reload roundtrip", () => {
    expect(
      normalizeGisProjectEffects({
        enabled: true,
        haloColor: "#4d9fe6",
        haloExtent: 2.75,
        haloOpacity: 1,
        spaceColor: "#000000",
      }),
    ).toEqual({
      enabled: true,
      haloColor: "#4d9fe6",
      haloExtent: 2.75,
      haloOpacity: 1,
      spaceColor: "#000000",
    });
  });

  it("persists enabled false when user turns atmosphere off", () => {
    expect(normalizeGisProjectEffects({ enabled: false, haloColor: "#fff" })).toEqual({
      enabled: false,
      haloColor: "#fff",
    });
  });
});
