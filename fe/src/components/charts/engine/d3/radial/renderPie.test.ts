import { describe, expect, it } from "vitest";
import { runD3Renderer } from "@/components/charts/engine/d3/core/d3RendererSession";
import { renderD3PieChart } from "./renderPie";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

describe("renderD3PieChart", () => {
  it("renders distinct slice paths for each category", () => {
    const container = document.createElement("div");
    const cleanup = renderD3PieChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data: [
          { type: "A", value: 40 },
          { type: "B", value: 35 },
          { type: "C", value: 25 },
        ],
        angleField: "value",
        colorField: "type",
        radius: 0.8,
        innerRadius: 0,
      },
    });

    const paths = [...container.querySelectorAll("path")].map((node) => node.getAttribute("d"));
    expect(paths).toHaveLength(3);
    expect(new Set(paths).size).toBe(3);
    cleanup();
  });

  it("renders donut-rose slices at small dashboard size", () => {
    const container = document.createElement("div");
    const cleanup = renderD3PieChart(container, {
      width: 225,
      height: 101,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: true,
      labelFontSize: 11,
      options: {
        data: [
          { type: "A", value: 40 },
          { type: "B", value: 35 },
          { type: "C", value: 25 },
        ],
        angleField: "value",
        colorField: "type",
        radius: 0.92,
        innerRadius: 0.5,
        roseType: "radius",
      },
    });

    const paths = [...container.querySelectorAll("path")].map((node) => node.getAttribute("d"));
    expect(paths.length).toBeGreaterThanOrEqual(3);
    expect(paths.every((d) => d && d.length > 8)).toBe(true);
    cleanup();
  });

  it("honors donut inner radius", () => {
    const container = document.createElement("div");
    const cleanup = renderD3PieChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data: [
          { type: "A", value: 60 },
          { type: "B", value: 40 },
        ],
        angleField: "value",
        colorField: "type",
        radius: 0.8,
        innerRadius: 0.5,
      },
    });

    const paths = [...container.querySelectorAll("path")].map((node) => node.getAttribute("d"));
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(2);
    cleanup();
  });

  it("honors __outerRadiusPercent over plan radius", () => {
    const baseOptions = {
      data: [
        { type: "A", value: 60 },
        { type: "B", value: 40 },
      ],
      angleField: "value",
      colorField: "type",
      radius: 0.92,
    };

    const renderWithPercent = (percent: number) => {
      const container = document.createElement("div");
      const cleanup = renderD3PieChart(container, {
        width: 320,
        height: 240,
        colors: ["#465fff", "#12b76a"],
        theme: getAntvThemeTokens("light"),
        showLabel: false,
        showTooltip: false,
        showLegend: false,
        labelFontSize: 11,
        options: { ...baseOptions, __outerRadiusPercent: percent },
      });
      const maxR = [...container.querySelectorAll("path")]
        .map((node) => node.getAttribute("d") ?? "")
        .flatMap((d) => (d.match(/[\d.]+/g) ?? []).map(Number))
        .reduce((max, n) => Math.max(max, n), 0);
      cleanup();
      return maxR;
    };

    const small = renderWithPercent(45);
    const large = renderWithPercent(80);
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it("uses zero pad angle and no slice stroke when spacing is 0", () => {
    const container = document.createElement("div");
    const cleanup = renderD3PieChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a", "#f79009"],
      theme: getAntvThemeTokens("light"),
      showLabel: false,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data: [
          { type: "A", value: 40 },
          { type: "B", value: 35 },
          { type: "C", value: 25 },
        ],
        angleField: "value",
        colorField: "type",
        __padAngle: 0,
      },
    });

    const slices = container.querySelectorAll("g.slice > path");
    expect(slices.length).toBe(3);
    for (const node of slices) {
      expect(node.getAttribute("stroke")).toBe("none");
      expect(node.getAttribute("stroke-width")).toBe("0");
    }
    cleanup();
  });

  it("renders outside dimension labels with leader lines", () => {
    const container = document.createElement("div");
    const cleanup = renderD3PieChart(container, {
      width: 320,
      height: 240,
      colors: ["#465fff", "#12b76a"],
      theme: getAntvThemeTokens("light"),
      showLabel: true,
      showTooltip: false,
      showLegend: false,
      labelFontSize: 11,
      options: {
        data: [
          { type: "华东", value: 60 },
          { type: "华北", value: 40 },
        ],
        angleField: "value",
        colorField: "type",
        __pieLabelPosition: "outside",
        __pieShowPercent: true,
        __piePercentDecimals: 1,
      },
    });

    expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("华东");
    expect(container.textContent).toMatch(/60\.0%/);
    const outsideLabel = container.querySelector("g.slice text");
    expect(outsideLabel?.getAttribute("stroke")).toBeNull();
    expect((outsideLabel as SVGTextElement | null)?.style.stroke).toBe("");
    cleanup();
  });

  it("keeps viewport viewBox after finalize (outside labels do not shrink pie)", () => {
    SVGElement.prototype.getBBox = () =>
      ({
        x: -160,
        y: -40,
        width: 720,
        height: 360,
      }) as DOMRect;

    const container = document.createElement("div");
    runD3Renderer(container, () =>
      renderD3PieChart(container, {
        width: 320,
        height: 240,
        colors: ["#465fff", "#12b76a"],
        theme: getAntvThemeTokens("light"),
        showLabel: true,
        showTooltip: false,
        showLegend: false,
        labelFontSize: 11,
        options: {
          data: [
            { type: "海南省", value: 48102 },
            { type: "广东省", value: 277701 },
          ],
          angleField: "value",
          colorField: "type",
          __pieLabelPosition: "outside",
          __pieShowPercent: true,
        },
      }),
    );

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-vs-embedded-fit")).toBe("viewport");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 320 240");
    expect(svg?.style.overflow).toBe("hidden");
  });
});
