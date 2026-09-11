import { describe, expect, it } from "vitest";
import { renderD3QuadrantChart } from "./renderQuadrant";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const scatterData = [
  { x: 2, y: 3 },
  { x: 8, y: 7 },
  { x: 5, y: 1 },
  { x: 9, y: 9 },
];

describe("renderD3QuadrantChart", () => {
  it("applies deStyle quadrant line width from plan options", () => {
    const thin = document.createElement("div");
    const cleanupThin = renderD3QuadrantChart(thin, {
      width: 400,
      height: 300,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data: scatterData,
        xField: "x",
        yField: "y",
        __quadrantLineWidth: 2,
        __quadrantLineColor: "#ff0000",
      },
    });

    const thinWidth = Number(
      thin.querySelector(".quadrant-median-x")?.getAttribute("stroke-width") ?? 0,
    );
    cleanupThin();

    const thick = document.createElement("div");
    const cleanupThick = renderD3QuadrantChart(thick, {
      width: 400,
      height: 300,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data: scatterData,
        xField: "x",
        yField: "y",
        __quadrantLineWidth: 6,
        __quadrantLineColor: "#ff0000",
      },
    });

    const thickWidth = Number(
      thick.querySelector(".quadrant-median-x")?.getAttribute("stroke-width") ?? 0,
    );
    cleanupThick();

    expect(thinWidth).toBe(2);
    expect(thickWidth).toBe(6);
  });
});
