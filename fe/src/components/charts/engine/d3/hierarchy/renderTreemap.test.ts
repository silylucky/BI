import { describe, expect, it } from "vitest";
import { renderD3TreemapChart } from "./renderTreemap";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { assertTreemapVisibleLabelsNoOverlap } from "@/components/charts/engine/d3/core/labelSpacingTestHelpers";

describe("renderD3TreemapChart", () => {
  it("applies treemap shape options and label font size", () => {
    const container = document.createElement("div");
    const cleanup = renderD3TreemapChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 16,
      options: {
        data: [
          { name: "A", value: 40 },
          { name: "B", value: 35 },
          { name: "C", value: 25 },
        ],
        __treemapPaddingInner: 6,
        __treemapPaddingOuter: 8,
        __treemapCellRadius: 5,
      },
    });

    const cell = container.querySelector("rect");
    expect(cell?.getAttribute("rx")).toBe("5");
    const label = container.querySelector("text");
    expect(label?.getAttribute("style")).toContain("font-size: 16px");
    cleanup();
  });

  it("renders multidimensional labels on separate tspans", () => {
    const container = document.createElement("div");
    const cleanup = renderD3TreemapChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 12,
      labelContent: {
        showDimension: true,
        showIndicator: true,
        showPercent: true,
        percentDecimals: 2,
      },
      valueFormat: { type: "auto", thousandSeparator: true },
      options: {
        data: [{ name: "2025-01-20", value: 22497 }],
        __treemapPaddingInner: 0,
        __treemapPaddingOuter: 4,
        __treemapCellRadius: 0,
      },
    });

    const tspans = container.querySelectorAll("tspan");
    expect(tspans.length).toBe(3);
    expect(tspans[0]?.textContent).toBe("2025-01-20");
    expect(tspans[1]?.textContent).toContain("22,497");
    expect(tspans[2]?.textContent).toMatch(/%$/);
    cleanup();
  });

  it("thins crowded treemap labels by cell area priority", () => {
    const data = [
      { name: "big", value: 120 },
      ...Array.from({ length: 16 }, (_, index) => ({
        name: `2025-06-${String(index + 1).padStart(2, "0")}`,
        value: 5,
      })),
    ];
    const container = document.createElement("div");
    const cleanup = renderD3TreemapChart(container, {
      width: 320,
      height: 200,
      colors: ["#465fff", "#12b76a", "#f79009", "#f04438"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 12,
      labelContent: {
        showDimension: true,
        showIndicator: true,
        showPercent: true,
      },
      options: {
        data,
        __treemapPaddingInner: 0,
        __treemapPaddingOuter: 4,
        __treemapCellRadius: 0,
      },
    });

    const labels = container.querySelectorAll("text");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(data.length);
    assertTreemapVisibleLabelsNoOverlap(container, 12);
    cleanup();
  });

  it("removes cell stroke when inner padding is zero", () => {
    const container = document.createElement("div");
    const cleanup = renderD3TreemapChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 12,
      depthVisual: "enhanced",
      options: {
        data: [
          { name: "A", value: 50 },
          { name: "B", value: 50 },
        ],
        __treemapPaddingInner: 0,
        __treemapPaddingOuter: 4,
        __treemapCellRadius: 0,
      },
    });

    const rects = container.querySelectorAll("rect");
    for (const rect of rects) {
      expect(rect.getAttribute("stroke-width")).toBe("0");
    }
    cleanup();
  });
});
