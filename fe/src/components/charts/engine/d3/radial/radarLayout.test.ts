import { describe, expect, it } from "vitest";
import { DEFAULT_RADAR_RADIUS_PERCENT } from "@/lib/chartDeStyleBlocks";
import {
  computeRadarLayout,
  estimateRadarAxisLabelPad,
  resolveRadarLayoutFontSize,
} from "./radarLayout";

describe("computeRadarLayout", () => {
  it("scales radius with radiusPercent", () => {
    const small = computeRadarLayout(200, 200, false, 40);
    const large = computeRadarLayout(200, 200, false, 100);
    expect(large.radius).toBeGreaterThan(small.radius);
  });

  it("uses most of half span at radius 100%", () => {
    const layout = computeRadarLayout(200, 200, false, 100);
    const halfSpan = (200 - 16) / 2;
    expect(layout.radius).toBeCloseTo(halfSpan * 0.97, 0);
  });

  it("keeps large radius for long axis names", () => {
    const dates = Array.from({ length: 6 }, (_, i) => `2025-05-${String(i + 1).padStart(2, "0")}`);
    const pad = estimateRadarAxisLabelPad(dates, 11, true, true);
    const layout = computeRadarLayout(360, 240, false, DEFAULT_RADAR_RADIUS_PERCENT);
    const halfSpan = Math.min(360 - 16, 240 - 16) / 2;
    expect(pad).toBeGreaterThan(20);
    expect(layout.radius).toBeGreaterThan(halfSpan * 0.75);
  });

  it("reserves more pad for long axis names", () => {
    const dates = Array.from({ length: 35 }, (_, i) => `2025-01-${String(i + 1).padStart(2, "0")}`);
    const shortPad = estimateRadarAxisLabelPad(["a"], 11, true, false);
    const longPad = estimateRadarAxisLabelPad(dates, 11, true, false);
    expect(longPad).toBeGreaterThan(shortPad);
  });
});

describe("resolveRadarLayoutFontSize", () => {
  it("converts paint-space font size back to visual size", () => {
    expect(resolveRadarLayoutFontSize(22, 0.5)).toBe(11);
  });
});
