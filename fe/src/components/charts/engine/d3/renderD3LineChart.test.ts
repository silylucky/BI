import { describe, expect, it } from "vitest";
import { inferCompositeCategoryLevels } from "@/components/charts/engine/buildDatasetEncoding";
import { renderD3LineChart } from "@/components/charts/engine/d3/renderD3LineChart";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

const theme = getAntvThemeTokens("dark");

const baseData = [
  { __category__: "A", __value__: 10, __series__: "S1" },
  { __category__: "B", __value__: 20, __series__: "S1" },
  { __category__: "A", __value__: 15, __series__: "S2" },
  { __category__: "B", __value__: 25, __series__: "S2" },
];

describe("renderD3LineChart", () => {
  it("draws stroke paths but skips area fill for basic line", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "320px";
    host.style.height = "200px";
    document.body.appendChild(host);

    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data: baseData,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6", "#ef4444"],
      theme,
    });

    expect(host.querySelectorAll("path[stroke]").length).toBeGreaterThan(0);
    expect(host.querySelectorAll(".line-area-fill").length).toBe(0);

    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("draws area fill when area mode or areaOpacity is configured", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    document.body.appendChild(host);

    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data: baseData,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6", "#ef4444"],
      theme,
      area: true,
    });

    expect(host.querySelectorAll(".line-area-fill").length).toBe(2);

    host.replaceChildren();
    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data: baseData,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6", "#ef4444"],
      theme,
      areaOpacity: 0.3,
    });

    expect(host.querySelectorAll(".line-area-fill").length).toBe(2);
    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("applies custom lineWidth to stroke paths", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    document.body.appendChild(host);

    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data: baseData,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6"],
      theme,
      lineWidth: 4,
    });

    const stroke = host.querySelector("path[stroke]");
    expect(stroke?.getAttribute("stroke-width")).toBe("4");

    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("keeps x-axis labels horizontal by default for dense date categories", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "320px";
    host.style.height = "200px";
    document.body.appendChild(host);

    const categories = Array.from({ length: 12 }, (_, i) => `2025-01-${String(i + 1).padStart(2, "0")}`);
    const data = categories.map((cat, i) => ({
      __category__: cat,
      __value__: 10 + i,
      __series__: "S1",
    }));

    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6"],
      theme,
    });

    const axisTexts = [...host.querySelectorAll(".vs-axis-x text")];
    expect(axisTexts.length).toBeGreaterThan(0);
    expect(
      axisTexts.some((node) => node.getAttribute("transform")?.includes("rotate")),
    ).toBe(false);

    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("rotates x-axis labels when axisStyle labelRotate is auto", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "320px";
    host.style.height = "200px";
    document.body.appendChild(host);

    const categories = Array.from({ length: 12 }, (_, i) => `2025-01-${String(i + 1).padStart(2, "0")}`);
    const data = categories.map((cat, i) => ({
      __category__: cat,
      __value__: 10 + i,
      __series__: "S1",
    }));

    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6"],
      theme,
      axisStyle: { x: { labelRotate: "auto" } },
    });

    const rotated = [...host.querySelectorAll(".vs-axis-x text")].some((node) =>
      node.getAttribute("transform")?.includes("rotate"),
    );
    expect(rotated).toBe(true);

    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("renders tiered x-axis groups for multi-dimension categories", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "480px";
    host.style.height = "240px";
    document.body.appendChild(host);

    const categories = [
      "云南省\u00012025-01\u0001销量",
      "云南省\u00012025-02\u0001销量",
      "江苏省\u00012025-01\u0001销量",
    ];
    const data = categories.flatMap((cat) => [
      { __category__: cat, __value__: 10, __series__: "amount" },
      { __category__: cat, __value__: 8, __series__: "total_amount" },
    ]);

    expect(inferCompositeCategoryLevels(categories)).toBe(3);

    renderD3LineChart(host, {
      width: 480,
      height: 240,
      data,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6", "#22c55e"],
      theme,
    });

    expect(host.querySelector(".vs-axis-x-tiered")).toBeTruthy();
    const labels = [...host.querySelectorAll(".vs-axis-x-tiered text")].map((node) => node.textContent);
    expect(labels).toContain("云南省");
    expect(labels.some((label) => label === "销量" || label?.includes("销量"))).toBe(true);
    expect(labels.length).toBeGreaterThan(2);

    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("tilts bottom tier labels when axisStyle labelRotate is auto", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "320px";
    host.style.height = "200px";
    document.body.appendChild(host);

    const categories = Array.from({ length: 12 }, (_, i) => `2025-01-${String(i + 1).padStart(2, "0")}\u0001销量`);
    const data = categories.flatMap((cat) => [
      { __category__: cat, __value__: 10, __series__: "amount" },
    ]);

    renderD3LineChart(host, {
      width: 320,
      height: 200,
      data,
      xField: "__category__",
      yField: "__value__",
      seriesField: "__series__",
      colors: ["#3b82f6"],
      theme,
      axisStyle: { x: { labelRotate: "auto" } },
    });

    expect(host.querySelector(".vs-axis-x-tiered")).toBeTruthy();
    const rotated = [...host.querySelectorAll(".vs-axis-x-tiered text")].some((node) =>
      node.getAttribute("transform")?.includes("rotate"),
    );
    expect(rotated).toBe(true);

    host.remove();
    setChartAnimationSuppressed(false);
  });
});
