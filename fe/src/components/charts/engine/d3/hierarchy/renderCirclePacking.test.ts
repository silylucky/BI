import { beforeEach, describe, expect, it } from "vitest";
import { renderD3CirclePackingChart } from "./renderCirclePacking";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

describe("renderD3CirclePackingChart", () => {
  beforeEach(() => {
    SVGElement.prototype.getBBox = () =>
      ({
        x: 0,
        y: 0,
        width: 40,
        height: 14,
      }) as DOMRect;
  });

  it("respects labelMinRadius when deciding visible labels", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 60 },
      { name: "C", value: 30 },
    ];
    const base = {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: { data },
    };

    const lowThreshold = document.createElement("div");
    const cleanupLow = renderD3CirclePackingChart(lowThreshold, {
      ...base,
      options: { ...base.options, __circlePackingLabelMinRadius: 8 },
    });
    const lowLabels = [...lowThreshold.querySelectorAll("g.pack-node text")].filter(
      (node) => (node.textContent ?? "").length > 0,
    ).length;
    cleanupLow();

    const highThreshold = document.createElement("div");
    const cleanupHigh = renderD3CirclePackingChart(highThreshold, {
      ...base,
      options: { ...base.options, __circlePackingLabelMinRadius: 999 },
    });
    const highLabels = [...highThreshold.querySelectorAll("g.pack-node text")].filter(
      (node) => (node.textContent ?? "").length > 0,
    ).length;
    cleanupHigh();

    expect(lowLabels).toBeGreaterThan(highLabels);
  });

  it("shows dimension metric and percent lines when label content is enabled", () => {
    const data = Array.from({ length: 24 }, (_, i) => ({
      name: `区域${i + 1}`,
      value: 100 - i * 3,
    }));
    const container = document.createElement("div");
    const cleanup = renderD3CirclePackingChart(container, {
      width: 360,
      height: 280,
      colors: ["#465fff", "#12b76a", "#f79009", "#ee46bc", "#7a5af8"],
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
      options: { data },
    });

    const labeled = [...container.querySelectorAll("g.pack-node text")].filter(
      (node) => (node.textContent ?? "").includes("%"),
    );
    cleanup();

    expect(labeled.length).toBeGreaterThan(0);
  });

  it("hides outer ring and paints background fill from style options", () => {
    const container = document.createElement("div");
    const cleanup = renderD3CirclePackingChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      options: {
        data: [
          { name: "A", value: 80 },
          { name: "B", value: 40 },
        ],
        __circlePackingBackgroundColor: "#e2e8f0",
        __circlePackingShowOuterRing: false,
      },
    });

    expect(container.querySelector(".pack-plot-bg")).not.toBeNull();
    expect(container.querySelector(".pack-plot-frame")).toBeNull();
    cleanup();
  });

  it("scales outer ring with overall size percent", () => {
    const full = document.createElement("div");
    const cleanupFull = renderD3CirclePackingChart(full, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      options: {
        data: [
          { name: "A", value: 80 },
          { name: "B", value: 40 },
        ],
        __circlePackingSizePercent: 100,
      },
    });
    const fullR = Number(full.querySelector(".pack-plot-frame")?.getAttribute("r"));
    cleanupFull();

    const small = document.createElement("div");
    const cleanupSmall = renderD3CirclePackingChart(small, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      options: {
        data: [
          { name: "A", value: 80 },
          { name: "B", value: 40 },
        ],
        __circlePackingSizePercent: 60,
      },
    });
    const smallR = Number(small.querySelector(".pack-plot-frame")?.getAttribute("r"));
    cleanupSmall();

    expect(fullR).toBeGreaterThan(0);
    expect(smallR).toBeLessThan(fullR);
  });

  it("scales label font size with presentation labelFontSize in thumbnail containers", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 60 },
      { name: "C", value: 30 },
    ];
    const base = {
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelContent: { showDimension: true },
      options: { data, __circlePackingLabelMinRadius: 6 },
    };

    const full = document.createElement("div");
    const cleanupFull = renderD3CirclePackingChart(full, {
      ...base,
      width: 320,
      height: 240,
      labelFontSize: 12,
    });
    const fullFs = Number.parseFloat(
      full.querySelector("g.pack-node text")?.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "0",
    );
    cleanupFull();

    const thumb = document.createElement("div");
    const cleanupThumb = renderD3CirclePackingChart(thumb, {
      ...base,
      width: 120,
      height: 96,
      labelFontSize: 6,
      renderTier: "thumbnail",
    });
    const thumbFs = Number.parseFloat(
      thumb.querySelector("g.pack-node text")?.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "0",
    );
    cleanupThumb();

    expect(fullFs).toBeGreaterThan(thumbFs);
    expect(thumbFs).toBeLessThanOrEqual(9);
  });

  it("renders labels above bubble fill so text is not washed by circle opacity", () => {
    const container = document.createElement("div");
    const cleanup = renderD3CirclePackingChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelColor: "#000000",
      labelContent: { showDimension: true, showIndicator: true },
      options: {
        data: [
          { name: "A", value: 80 },
          { name: "B", value: 40 },
        ],
        __circlePackingLabelMinRadius: 8,
      },
    });

    const node = container.querySelector("g.pack-node");
    const children = node ? Array.from(node.children).map((el) => el.tagName.toLowerCase()) : [];
    expect(children.indexOf("text")).toBeGreaterThan(children.indexOf("circle"));
    const textFill = container.querySelector("g.pack-node text")?.getAttribute("fill");
    expect(textFill).toBe("#000000");
    cleanup();
  });
});
