import { describe, expect, it } from "vitest";
import { CARTESIAN_CATEGORY_KEY_SEP } from "@/components/charts/engine/buildDatasetEncoding";
import { renderD3AreaChart } from "@/components/charts/engine/d3/cartesian/renderArea";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const theme = getAntvThemeTokens("dark");
const SEP = CARTESIAN_CATEGORY_KEY_SEP;

describe("renderD3AreaChart tiered axis", () => {
  it("renders hierarchical x-axis for multi-dimension categories", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "480px";
    host.style.height = "240px";
    document.body.appendChild(host);

    const keys = [
      `云南省${SEP}2025-01${SEP}销量`,
      `云南省${SEP}2025-02${SEP}销量`,
      `江苏省${SEP}2025-01${SEP}销量`,
    ];
    const data = keys.map((cat) => ({ __category__: cat, __value__: 10 }));

    renderD3AreaChart(host, {
      width: 480,
      height: 240,
      data,
      xField: "__category__",
      yField: "__value__",
      colors: ["#465fff"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      categoryLevelCount: 3,
    });

    expect(host.querySelector(".vs-axis-x-tiered")).toBeTruthy();
    const labels = [...host.querySelectorAll(".vs-axis-x-tiered text")].map((n) => n.textContent);
    expect(labels).toContain("云南省");

    host.remove();
    setChartAnimationSuppressed(false);
  });
});
