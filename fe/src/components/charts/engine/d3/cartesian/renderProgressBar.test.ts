import { describe, expect, it } from "vitest";
import { renderD3ProgressBarChart } from "./renderProgressBar";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const data = [{ type: "完成率", value: 65, max: 100 }];

describe("renderD3ProgressBarChart", () => {
  it("applies deStyle track opacity from compare style", () => {
    const faint = document.createElement("div");
    const cleanupFaint = renderD3ProgressBarChart(faint, {
      width: 400,
      height: 120,
      data,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      trackOpacity: 0.2,
    });

    const faintOpacity = Number(faint.querySelector("rect.track")?.getAttribute("opacity") ?? 0);
    cleanupFaint();

    const solid = document.createElement("div");
    const cleanupSolid = renderD3ProgressBarChart(solid, {
      width: 400,
      height: 120,
      data,
      colors: ["#465fff"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      trackOpacity: 0.75,
    });

    const solidOpacity = Number(solid.querySelector("rect.track")?.getAttribute("opacity") ?? 0);
    cleanupSolid();

    expect(faintOpacity).toBe(0.2);
    expect(solidOpacity).toBe(0.75);
  });
});
