import { describe, expect, it } from "vitest";
import {
  applyChartColorsOpacity,
  paletteColorsMatchPreset,
  resolveChartColors,
  resolvePaletteId,
  withChartColorOpacity,
} from "./chartPalette";

describe("chartPalette", () => {
  it("resolveChartColors returns brand preset", () => {
    expect(resolveChartColors("default")[0]).toBe("#465fff");
  });

  it("resolveChartColors prefers custom colors", () => {
    expect(resolveChartColors("clarity", ["#000000"])).toEqual(["#000000"]);
  });

  it("maps legacy tech palette to clarity", () => {
    expect(resolvePaletteId("tech")).toBe("clarity");
    expect(resolveChartColors("tech")[0]).toBe("#0ba5ec");
  });

  it("withChartColorOpacity converts hex to rgba", () => {
    expect(withChartColorOpacity("#465fff", 0.62)).toBe("rgba(70, 95, 255, 0.62)");
  });

  it("applyChartColorsOpacity skips full opacity", () => {
    const colors = resolveChartColors("default");
    expect(applyChartColorsOpacity(colors, 1)).toEqual(colors);
    expect(applyChartColorsOpacity(colors, undefined)).toEqual(colors);
  });

  it("detects customized palette colors", () => {
    const preset = resolveChartColors("default");
    expect(paletteColorsMatchPreset("default", preset)).toBe(true);
    expect(paletteColorsMatchPreset("default", ["#465fff", "#ff0000"])).toBe(false);
  });
});
