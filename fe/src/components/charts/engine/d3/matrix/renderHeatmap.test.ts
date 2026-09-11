import { describe, expect, it } from "vitest";
import { renderD3HeatmapChart } from "./renderHeatmap";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

function heatmapData(rows: number, cols: number) {
  const data: Array<{ x: string; y: string; value: number }> = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      data.push({
        x: `省${x + 1}`,
        y: `2025-${String(y + 1).padStart(2, "0")}-01`,
        value: 1000 + x * 100 + y,
      });
    }
  }
  return data;
}

describe("renderD3HeatmapChart", () => {
  it("omits cell labels and visual map in thumbnail hub previews", () => {
    const container = document.createElement("div");
    const cleanup = renderD3HeatmapChart(container, {
      width: 120,
      height: 96,
      data: heatmapData(8, 6),
      colors: ["#465fff", "#7a5af8"],
      theme: getAntvThemeTokens("light"),
      showTooltip: false,
      showCellLabel: true,
      showVisualMap: true,
      labelFontSize: 6,
      renderTier: "thumbnail",
    });

    expect(container.querySelectorAll("text.cell-label").length).toBe(0);
    expect(container.querySelectorAll("linearGradient[id^='d3-heatmap-legend-']").length).toBe(0);
    cleanup();
  });

  it("caps cell label font size to cell dimensions", () => {
    const container = document.createElement("div");
    const data = [
      { x: "A", y: "Y1", value: 100 },
      { x: "B", y: "Y1", value: 200 },
      { x: "A", y: "Y2", value: 300 },
      { x: "B", y: "Y2", value: 400 },
    ];
    const cleanup = renderD3HeatmapChart(container, {
      width: 160,
      height: 120,
      data,
      colors: ["#465fff", "#7a5af8"],
      theme: getAntvThemeTokens("light"),
      showTooltip: false,
      showCellLabel: true,
      showVisualMap: false,
      labelFontSize: 20,
    });

    const label = container.querySelector("text.cell-label");
    const fontSize = Number.parseFloat(
      label?.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "99",
    );
    cleanup();

    expect(fontSize).toBeLessThan(20);
    expect(fontSize).toBeGreaterThanOrEqual(6);
  });
});
