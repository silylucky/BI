import { describe, expect, it } from "vitest";
import { CARTESIAN_CATEGORY_KEY_SEP } from "@/components/charts/engine/buildDatasetEncoding";
import { renderD3BarChart } from "@/components/charts/engine/d3/cartesian/renderBar";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { visibleDataZoomCategories } from "@/components/charts/engine/d3/core/dataZoom";
import { writeStoredDataZoomWindow } from "@/components/charts/engine/d3/core/dataZoomWindow";

const theme = getAntvThemeTokens("dark");
const SEP = CARTESIAN_CATEGORY_KEY_SEP;

function compositeKey(date: string, province: string, product: string, category: string): string {
  return [date, province, product, category].join(SEP);
}

function tieredAxisLabels(host: ParentNode): string[] {
  return [...host.querySelectorAll(".vs-axis-x-tiered text")].map((node) => node.textContent ?? "");
}

function tieredAxisRowYs(host: ParentNode): number[] {
  return [...new Set(
    [...host.querySelectorAll(".vs-axis-x-tiered text")].map((node) =>
      Number(node.getAttribute("y") ?? 0),
    ),
  )].sort((a, b) => a - b);
}

describe("renderD3BarChart multi-dimension axis", () => {
  it("renders four tiered rows with merged parents and thinned leaf labels", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    host.style.width = "640px";
    host.style.height = "320px";
    document.body.appendChild(host);

    const provinces = ["上海市", "广东省", "四川省"];
    const products = ["27寸显示器", "无线鼠标", "机械键盘"];
    const categories = ["显示设备", "外设配件"];
    const dates = ["2025-06-08", "2025-07-01"];

    const keys: string[] = [];
    for (let i = 0; i < 24; i += 1) {
      keys.push(
        compositeKey(
          dates[i % dates.length],
          provinces[i % provinces.length],
          products[i % products.length],
          categories[i % categories.length],
        ),
      );
    }

    const data = keys.map((cat, i) => ({ __category__: cat, __value__: 1000 + i }));

    renderD3BarChart(host, {
      width: 640,
      height: 320,
      data,
      xField: "__category__",
      yField: "__value__",
      colors: ["#465fff"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      categoryLevelCount: 4,
    });

    expect(host.querySelector(".vs-axis-x-tiered")).toBeTruthy();

    const labels = tieredAxisLabels(host);
    const rowYs = tieredAxisRowYs(host);

    expect(labels.some((label) => label.includes("2025"))).toBe(true);
    expect(labels.some((label) => label.includes("显示设备") || label.includes("外设配件"))).toBe(true);
    expect(rowYs.length).toBeGreaterThanOrEqual(3);
    expect(labels.filter((label) => label.includes("广东省")).length).toBeLessThan(keys.length);

    host.remove();
    setChartAnimationSuppressed(false);
  });
});

describe("renderD3BarChart dataZoom", () => {
  it("keeps a bottom overview slider and draws only the selected category window", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    writeStoredDataZoomWindow(host, { start: 0, end: 0.5 });
    expect(visibleDataZoomCategories(host, true, ["一月", "二月", "三月", "四月"])).toEqual(["一月", "二月"]);

    renderD3BarChart(host, {
      width: 640,
      height: 320,
      data: [
        { __category__: "一月", __value__: 10 },
        { __category__: "二月", __value__: 20 },
        { __category__: "三月", __value__: 30 },
        { __category__: "四月", __value__: 40 },
      ],
      xField: "__category__",
      yField: "__value__",
      colors: ["#465fff"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      dataZoom: true,
    });

    expect(host.querySelector(".data-zoom-slider")).toBeTruthy();
    expect(host.querySelectorAll("g.bar-s0").length).toBe(2);
    expect(host.dataset.vsDataZoom).toBe("0,0.5");

    host.remove();
    setChartAnimationSuppressed(false);
  });

  it("updates the main chart in place during a live window change without recreating the slider", () => {
    setChartAnimationSuppressed(true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    writeStoredDataZoomWindow(host, { start: 0, end: 1 });
    const config = {
      width: 640,
      height: 320,
      data: [
        { __category__: "一月", __value__: 10 },
        { __category__: "二月", __value__: 20 },
        { __category__: "三月", __value__: 30 },
        { __category__: "四月", __value__: 40 },
      ],
      xField: "__category__",
      yField: "__value__",
      colors: ["#465fff"],
      theme,
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      dataZoom: true,
    } as const;

    renderD3BarChart(host, { ...config });
    const slider = host.querySelector(".data-zoom-slider");
    expect(slider).toBeTruthy();
    expect(host.querySelectorAll("g.bar-s0").length).toBe(4);

    writeStoredDataZoomWindow(host, { start: 0, end: 0.5 });
    host.dataset.vsIncremental = "true";
    host.dataset.vsDataZoomLive = "1";
    renderD3BarChart(host, { ...config });

    expect(host.querySelector(".data-zoom-slider")).toBe(slider);
    expect(host.querySelectorAll(".data-zoom-slider").length).toBe(1);
    expect(host.querySelectorAll("g.bar-s0").length).toBe(2);

    host.remove();
    setChartAnimationSuppressed(false);
  });
});
