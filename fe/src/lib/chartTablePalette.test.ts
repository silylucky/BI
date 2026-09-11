import { describe, expect, it } from "vitest";
import { mergeChartTableStyle, patchChartDeTablePalette } from "@/lib/chartDeTableStyle";
import { resolveTablePaletteStyle } from "@/lib/chartTablePalette";

describe("chartTablePalette", () => {
  it("resolveTablePaletteStyle returns scheme-aware colors", () => {
    const light = resolveTablePaletteStyle("default", "light");
    const dark = resolveTablePaletteStyle("default", "dark");
    expect(light.headerBg).toBeTruthy();
    expect(dark.headerBg).toBeTruthy();
    expect(light.headerBg).not.toBe(dark.headerBg);
  });

  it("mergeChartTableStyle applies preset before component overrides", () => {
    const merged = mergeChartTableStyle(
      { tablePaletteId: "night", headerFg: "#ff0000" },
      {},
      "dark",
    );
    expect(merged.tablePaletteId).toBe("night");
    expect(merged.headerFg).toBe("#ff0000");
    expect(merged.headerBg).toBe(resolveTablePaletteStyle("night", "dark").headerBg);
  });

  it("patchChartDeTablePalette clears overrides on inherit", () => {
    const cfg = {
      chartType: "table-info",
      nativeBody: {
        deTableStyle: {
          tablePaletteId: "amber",
          headerBg: "#111111",
          headerFontSize: 9,
        },
      },
    };
    const next = patchChartDeTablePalette(cfg, undefined, "light");
    expect(next.nativeBody?.deTableStyle?.tablePaletteId).toBeUndefined();
    expect(next.nativeBody?.deTableStyle?.headerBg).toBeUndefined();
    expect(next.nativeBody?.deTableStyle?.headerFontSize).toBe(9);
  });
});
