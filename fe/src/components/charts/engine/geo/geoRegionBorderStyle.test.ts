import { describe, expect, it } from "vitest";
import {
  buildGeoRegionBorderContentSig,
  hasCustomGeoRegionBorderColor,
  resolveGeoRegionBorder,
  resolveGeoRegionBorderColorHex,
  resolveGeoRegionBorderShow,
  resolveGeoRegionBorderWidthScale,
  resolveGeoRegionStrokeWidth,
} from "./geoRegionBorderStyle";

describe("geoRegionBorderStyle", () => {
  it("defaults border to visible", () => {
    expect(resolveGeoRegionBorderShow({})).toBe(true);
    expect(resolveGeoRegionBorderShow({ showRegionBorder: false })).toBe(false);
  });

  it("uses custom border color when set", () => {
    const border = resolveGeoRegionBorder({ regionBorderColor: "#ff5500" }, true);
    expect(border.colorCss).toBe("#ff5500");
    expect(hasCustomGeoRegionBorderColor({ regionBorderColor: "#ff5500" })).toBe(true);
  });

  it("uses 3d preset default for panel color when on 3d map", () => {
    const hex = resolveGeoRegionBorderColorHex({}, true, "tech");
    expect(hex).toBe("#b8e0ff");
  });

  it("content sig tracks border toggle and color", () => {
    const on = buildGeoRegionBorderContentSig({ showRegionBorder: true });
    const off = buildGeoRegionBorderContentSig({ showRegionBorder: false });
    const colored = buildGeoRegionBorderContentSig({ regionBorderColor: "#112233" });
    expect(on).not.toBe(off);
    expect(on).not.toBe(colored);
  });

  it("scales stroke width by regionBorderWidth", () => {
    expect(resolveGeoRegionBorderWidthScale({ regionBorderWidth: 5 })).toBe(3);
    const base = resolveGeoRegionStrokeWidth({}, 400);
    const wide = resolveGeoRegionStrokeWidth({ regionBorderWidth: 2 }, 400);
    expect(wide).toBeGreaterThan(base);
  });
});
