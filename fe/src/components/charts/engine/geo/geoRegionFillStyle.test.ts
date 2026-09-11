import { describe, expect, it } from "vitest";
import { buildGeoMapStyleContentSig } from "./geoRegionFillStyle";

describe("buildGeoMapStyleContentSig", () => {
  it("includes bubble effect fields so style edits trigger map rebuild", () => {
    const off = buildGeoMapStyleContentSig({});
    const on = buildGeoMapStyleContentSig({
      bubbleEffect: true,
      bubbleEffectSpeed: 2.4,
      bubbleEffectRingCount: 7,
    });
    expect(off).not.toBe(on);
  });

  it("changes when zoom control toggles", () => {
    const off = buildGeoMapStyleContentSig({});
    const on = buildGeoMapStyleContentSig({ showZoomControl: true });
    expect(off).not.toBe(on);
  });

  it("changes when custom palette colors change", () => {
    const base = buildGeoMapStyleContentSig({}, { paletteId: "default", chartColors: ["#465fff"] });
    const custom = buildGeoMapStyleContentSig(
      {},
      { paletteId: "default", paletteColors: ["#ff0000"], chartColors: ["#ff0000"] },
    );
    expect(base).not.toBe(custom);
  });
});
