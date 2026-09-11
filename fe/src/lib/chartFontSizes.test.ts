import { describe, expect, it } from "vitest";
import { CHART_FONT_SIZE_OPTIONS, resolveChartFontSizeOptions } from "./chartFontSizes";

describe("chartFontSizes", () => {
  it("covers 6–24 step 1 and 26–48 even steps", () => {
    expect(CHART_FONT_SIZE_OPTIONS[0]).toBe(6);
    expect(CHART_FONT_SIZE_OPTIONS[18]).toBe(24);
    expect(CHART_FONT_SIZE_OPTIONS[19]).toBe(26);
    expect(CHART_FONT_SIZE_OPTIONS.at(-1)).toBe(48);
    expect(CHART_FONT_SIZE_OPTIONS).toHaveLength(31);
  });

  it("keeps in-range values without appending", () => {
    expect(resolveChartFontSizeOptions(22, 12)).toEqual([...CHART_FONT_SIZE_OPTIONS]);
  });

  it("appends legacy values outside the preset list", () => {
    expect(resolveChartFontSizeOptions(52, 12)).toEqual([...CHART_FONT_SIZE_OPTIONS, 52]);
  });
});
