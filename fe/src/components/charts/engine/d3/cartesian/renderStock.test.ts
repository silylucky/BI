import { describe, expect, it } from "vitest";
import { renderD3StockChart } from "./renderStock";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const data = [{ type: "DAY1", open: 10, close: 14, high: 16, low: 8 }];

describe("renderD3StockChart", () => {
  it("applies deStyle body width ratio from compare style", () => {
    const narrow = document.createElement("div");
    const cleanupNarrow = renderD3StockChart(narrow, {
      width: 400,
      height: 240,
      data,
      colors: ["#12b76a", "#f04438"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      bodyWidthRatio: 0.3,
    });

    const narrowWidth = Number(narrow.querySelector("rect.candle")?.getAttribute("width") ?? 0);
    cleanupNarrow();

    const wide = document.createElement("div");
    const cleanupWide = renderD3StockChart(wide, {
      width: 400,
      height: 240,
      data,
      colors: ["#12b76a", "#f04438"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      bodyWidthRatio: 0.85,
    });

    const wideWidth = Number(wide.querySelector("rect.candle")?.getAttribute("width") ?? 0);
    cleanupWide();

    expect(wideWidth).toBeGreaterThan(narrowWidth);
    expect(narrowWidth).toBeGreaterThan(0);
  });
});
