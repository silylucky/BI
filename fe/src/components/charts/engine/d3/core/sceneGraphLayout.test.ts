import { describe, expect, it } from "vitest";
import {
  appendChartSvg,
  finalizeEmbeddedChartSvgs,
  normalizeEmbeddedChartSvgs,
  resolveCategoryCartesianLayout,
  resolveHorizontalCategoryCartesianLayout,
} from "@/components/charts/engine/d3/core/sceneGraph";

describe("sceneGraph layout helpers", () => {
  it("resolveCategoryCartesianLayout keeps dense ticks horizontal by default", () => {
    const categories = Array.from({ length: 16 }, (_, i) => `类目${i + 1}`);
    const layout = resolveCategoryCartesianLayout(200, 180, categories);
    expect(layout.xLayout.ticks.length).toBeLessThan(categories.length);
    expect(layout.xLayout.rotateDeg).toBe(0);
    expect(layout.innerW).toBeGreaterThan(0);
    expect(layout.innerH).toBeGreaterThan(0);
  });

  it("resolveCategoryCartesianLayout reserves bottom margin when labelRotate is auto", () => {
    const categories = Array.from({ length: 16 }, (_, i) => `类目${i + 1}`);
    const layout = resolveCategoryCartesianLayout(200, 180, categories, {
      axisStyle: { x: { labelRotate: "auto" } },
    });
    expect(layout.xLayout.ticks.length).toBeLessThan(categories.length);
    expect(layout.margin.bottom).toBeGreaterThan(44);
  });

  it("resolveHorizontalCategoryCartesianLayout expands left margin for long labels", () => {
    const categories = Array.from({ length: 12 }, (_, i) => `2024年第${i + 1}季度`);
    const layout = resolveHorizontalCategoryCartesianLayout(320, 200, categories);
    expect(layout.yLayout.ticks.length).toBeLessThan(categories.length);
    expect(layout.margin.left).toBeGreaterThanOrEqual(52);
    expect(layout.innerW).toBeGreaterThan(0);
    expect(layout.innerH).toBeGreaterThan(0);
  });

  it("appendChartSvg creates scalable vs-chart-svg", () => {
    const container = document.createElement("div");
    const svg = appendChartSvg(container, 400, 300);
    expect(svg.attr("class")).toBe("vs-chart-svg");
    expect(svg.style("overflow")).toBe("visible");
    expect(svg.attr("width")).toBe("100%");
    expect(svg.attr("height")).toBe("100%");
    expect(svg.attr("viewBox")).toBe("0 0 400 300");
    expect(svg.attr("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  it("normalizeEmbeddedChartSvgs upgrades legacy fixed-size svg roots", () => {
    const container = document.createElement("div");
    const legacy = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    legacy.setAttribute("width", "640");
    legacy.setAttribute("height", "360");
    container.appendChild(legacy);

    normalizeEmbeddedChartSvgs(container);

    expect(legacy.getAttribute("viewBox")).toBe("0 0 640 360");
    expect(legacy.getAttribute("width")).toBe("100%");
    expect(legacy.getAttribute("height")).toBe("100%");
  });

  it("finalizeEmbeddedChartSvgs fits svg content bbox with meet scaling", () => {
    SVGElement.prototype.getBBox = () =>
      ({
        x: -40,
        y: 8,
        width: 520,
        height: 360,
      }) as DOMRect;

    const container = document.createElement("div");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-vs-embedded-fit", "content");
    svg.setAttribute("width", "320");
    svg.setAttribute("height", "200");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "rect"));
    svg.appendChild(g);
    container.appendChild(svg);

    finalizeEmbeddedChartSvgs(container);

    expect(svg.getAttribute("width")).toBe("100%");
    expect(svg.getAttribute("height")).toBe("100%");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    expect(svg.getAttribute("viewBox")).toBe("-46 2 532 372");
  });

  it("finalizeEmbeddedChartSvgs keeps viewport viewBox for pie-like svg", () => {
    SVGElement.prototype.getBBox = () =>
      ({
        x: -180,
        y: -60,
        width: 880,
        height: 420,
      }) as DOMRect;

    const container = document.createElement("div");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "vs-chart-svg");
    svg.setAttribute("data-vs-embedded-fit", "viewport");
    svg.setAttribute("width", "320");
    svg.setAttribute("height", "200");
    svg.setAttribute("viewBox", "0 0 320 200");
    container.appendChild(svg);

    finalizeEmbeddedChartSvgs(container);

    expect(svg.getAttribute("viewBox")).toBe("0 0 320 200");
    expect(svg.getAttribute("width")).toBe("100%");
  });
});
