import { beforeEach, describe, expect, it } from "vitest";
import { renderD3WordCloudChart } from "./renderWordCloud";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

describe("renderD3WordCloudChart", () => {
  beforeEach(() => {
    SVGElement.prototype.getBBox = () =>
      ({
        x: 0,
        y: 0,
        width: 48,
        height: 14,
      }) as DOMRect;
  });

  it("applies deStyle wordCloud font range from plan options", () => {
    const container = document.createElement("div");
    const data = [
      { word: "alpha", weight: 100 },
      { word: "beta", weight: 50 },
      { word: "gamma", weight: 25 },
    ];

    const cleanupSmall = renderD3WordCloudChart(container, {
      width: 400,
      height: 300,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data,
        __wordCloudFontMin: 10,
        __wordCloudFontMax: 20,
        __wordCloudSpacing: 4,
      },
    });

    const smallFonts = [...container.querySelectorAll("text.word")].map((node) =>
      Number.parseFloat(node.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "0"),
    );
    cleanupSmall();

    const containerLarge = document.createElement("div");
    const cleanupLarge = renderD3WordCloudChart(containerLarge, {
      width: 400,
      height: 300,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data,
        __wordCloudFontMin: 24,
        __wordCloudFontMax: 48,
        __wordCloudSpacing: 4,
      },
    });

    const largeFonts = [...containerLarge.querySelectorAll("text.word")].map((node) =>
      Number.parseFloat(node.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "0"),
    );
    cleanupLarge();

    expect(smallFonts.length).toBeGreaterThan(0);
    expect(largeFonts.length).toBeGreaterThan(0);
    expect(Math.max(...largeFonts)).toBeGreaterThan(Math.max(...smallFonts));
  });

  it("scales word sizes down for thumbnail hub previews", () => {
    const data = [
      { word: "alpha", weight: 100 },
      { word: "beta", weight: 50 },
      { word: "gamma", weight: 25 },
    ];
    const base = {
      height: 96,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data,
        __wordCloudFontMin: 12,
        __wordCloudFontMax: 36,
      },
    };

    const full = document.createElement("div");
    const cleanupFull = renderD3WordCloudChart(full, { ...base, width: 320 });
    const fullMax = Math.max(
      ...[...full.querySelectorAll("text.word")].map((node) =>
        Number.parseFloat(node.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "0"),
      ),
    );
    cleanupFull();

    const thumb = document.createElement("div");
    const cleanupThumb = renderD3WordCloudChart(thumb, {
      ...base,
      width: 120,
      renderTier: "thumbnail",
    });
    const thumbMax = Math.max(
      ...[...thumb.querySelectorAll("text.word")].map((node) =>
        Number.parseFloat(node.getAttribute("style")?.match(/font-size:\s*([\d.]+)px/)?.[1] ?? "0"),
      ),
    );
    cleanupThumb();

    expect(fullMax).toBeGreaterThan(thumbMax);
  });
});
