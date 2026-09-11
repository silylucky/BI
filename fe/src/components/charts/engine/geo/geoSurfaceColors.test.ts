import { describe, expect, it } from "vitest";
import { buildGeoSurfacePalette, resolveGeoMapOpacity } from "./geoSurfaceColors";

describe("buildGeoSurfacePalette", () => {
  it("uses custom region fill and chart palette colors", () => {
    const surface = buildGeoSurfacePalette(false, {
      colors: ["#111111", "#222222", "#333333", "#444444"],
      regionFillColor: "#abcdef",
    });
    expect(surface.emptyFill).toBe("#abcdef");
    expect(surface.rangeLow).toBe("#111111");
    expect(surface.rangePeak).toBe("#444444");
  });
});

describe("resolveGeoMapOpacity", () => {
  it("clamps opacity to 0–1", () => {
    expect(resolveGeoMapOpacity(0.5)).toBe(0.5);
    expect(resolveGeoMapOpacity(undefined)).toBe(1);
    expect(resolveGeoMapOpacity(1.2)).toBe(1);
  });
});
