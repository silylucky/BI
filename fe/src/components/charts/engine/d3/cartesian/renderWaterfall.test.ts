import { describe, expect, it } from "vitest";
import { renderD3WaterfallChart } from "./renderWaterfall";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const data = [
  { type: "期初", value: 100 },
  { type: "收入", value: 80 },
  { type: "成本", value: -40 },
  { type: "期末", value: 160 },
];

describe("renderD3WaterfallChart", () => {
  it("renders without initialization errors and draws bars", () => {
    const host = document.createElement("div");
    const cleanup = renderD3WaterfallChart(host, {
      width: 480,
      height: 280,
      data,
      colors: ["#465fff", "#f04438"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: true,
    });

    expect(host.querySelector(".vs-axis-x")).toBeTruthy();
    expect(host.querySelectorAll("g.waterfall").length).toBe(data.length);
    cleanup();
  });
});
