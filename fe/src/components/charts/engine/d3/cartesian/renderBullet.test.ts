import { describe, expect, it } from "vitest";
import { renderD3BulletChart } from "./renderBullet";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const data = [{ type: "指标A", actual: 72, target: 80, rangeMax: 100 }];

describe("renderD3BulletChart", () => {
  it("applies deStyle target line width from compare style", () => {
    const thin = document.createElement("div");
    const cleanupThin = renderD3BulletChart(thin, {
      width: 400,
      height: 120,
      data,
      colors: ["#465fff", "#12b76a", "#e4e7ec", "#d0d5dd", "#98a2b3"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      targetLineWidth: 2,
    });

    const thinWidth = Number(thin.querySelector("line")?.getAttribute("stroke-width") ?? 0);
    cleanupThin();

    const thick = document.createElement("div");
    const cleanupThick = renderD3BulletChart(thick, {
      width: 400,
      height: 120,
      data,
      colors: ["#465fff", "#12b76a", "#e4e7ec", "#d0d5dd", "#98a2b3"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      targetLineWidth: 5,
    });

    const thickWidth = Number(thick.querySelector("line")?.getAttribute("stroke-width") ?? 0);
    cleanupThick();

    expect(thinWidth).toBe(2);
    expect(thickWidth).toBe(5);
  });
});
