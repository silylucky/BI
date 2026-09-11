import { describe, expect, it } from "vitest";
import {
  resolveGeoRegionLabelColorHex,
  resolveGeoRegionLabelFontSize,
  resolveGeoRegionLabelPanelColorHex,
} from "@/components/charts/engine/geo/geoRegionLabelStyle";
import { resolveD3Theme } from "@/components/charts/engine/d3/core/themeEngine";

describe("geoRegionLabelStyle", () => {
  it("defaults font size to chart standard minimum", () => {
    expect(resolveGeoRegionLabelFontSize({})).toBe(10);
    expect(resolveGeoRegionLabelFontSize({}, { chartWidth: 400, chartHeight: 320 })).toBe(10);
    expect(
      resolveGeoRegionLabelFontSize({ regionLabelFontSize: 14 }, { chartWidth: 400, chartHeight: 320 }),
    ).toBe(14);
  });

  it("scales font size down for small visual footprint", () => {
    expect(resolveGeoRegionLabelFontSize({}, { chartWidth: 340, chartHeight: 160 })).toBe(6);
    expect(
      resolveGeoRegionLabelFontSize({ regionLabelFontSize: 14 }, { chartWidth: 340, chartHeight: 160 }),
    ).toBe(7);
  });

  it("uses thumbnail tier for hub card previews", () => {
    expect(
      resolveGeoRegionLabelFontSize({}, {
        chartWidth: 340,
        chartHeight: 190,
        renderTier: "thumbnail",
      }),
    ).toBe(6);
  });

  it("compensates pixel-canvas visualScale when painting at design resolution", () => {
    expect(
      resolveGeoRegionLabelFontSize({}, {
        chartWidth: 400,
        chartHeight: 320,
        visualScale: 0.5,
      }),
    ).toBe(12);
    expect(
      resolveGeoRegionLabelFontSize({ regionLabelFontSize: 14 }, {
        chartWidth: 400,
        chartHeight: 320,
        visualScale: 0.5,
      }),
    ).toBe(14);
  });

  it("uses custom color or theme axis label", () => {
    const theme = resolveD3Theme("light");
    expect(resolveGeoRegionLabelColorHex({ regionLabelColor: "#112233" }, theme)).toBe("#112233");
    expect(resolveGeoRegionLabelPanelColorHex({}, false)).toBe("#475569");
    expect(resolveGeoRegionLabelPanelColorHex({}, true)).toBe("#cbd5e1");
  });
});
