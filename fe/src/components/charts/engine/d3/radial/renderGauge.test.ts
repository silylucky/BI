import { describe, expect, it } from "vitest";
import { renderD3GaugeChart } from "@/components/charts/engine/d3/radial/renderGauge";
import type { D3RenderConfig } from "@/components/charts/engine/d3/types";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

function baseConfig(overrides?: Partial<D3RenderConfig>): D3RenderConfig {
  return {
    width: 320,
    height: 240,
    colors: ["#465fff"],
    theme: getAntvThemeTokens("light"),
    showLabel: true,
    showTooltip: false,
    labelColor: undefined,
    labelFontSize: 12,
    tooltipPresentation: { fontSize: 12 },
    valueFormat: undefined,
    options: { rawValue: 72, percent: 0.72, __gaugeMin: 0, __gaugeMax: 100, __gaugeSplitNumber: 5 },
    data: [],
    ...overrides,
  } as D3RenderConfig;
}

describe("renderD3GaugeChart", () => {
  it("renders track, value arc, ticks, pointer hub and center readout", () => {
    const el = document.createElement("div");
    const dispose = renderD3GaugeChart(el, baseConfig());
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("data-testid")).toBe("d3-gauge-chart");
    expect(el.querySelectorAll("path").length).toBeGreaterThanOrEqual(3);
    expect(el.querySelectorAll(".gauge-ticks line").length).toBe(6);
    expect(el.querySelectorAll(".gauge-ticks text").length).toBeGreaterThan(0);
    const texts = [...el.querySelectorAll("text")].map((n) => n.textContent ?? "");
    expect(texts.some((t) => t.includes("72"))).toBe(true);
    dispose();
    expect(el.childNodes.length).toBe(0);
  });

  it("keeps center value when showLabel is false (ticks hide numbers)", () => {
    const el = document.createElement("div");
    renderD3GaugeChart(el, baseConfig({ showLabel: false }));
    expect(el.querySelectorAll(".gauge-ticks text").length).toBe(0);
    const texts = [...el.querySelectorAll("text")].map((n) => n.textContent);
    expect(texts.some((t) => t?.includes("72"))).toBe(true);
  });

  it("prefers palette colors over plan default range colors", () => {
    const el = document.createElement("div");
    renderD3GaugeChart(
      el,
      baseConfig({
        colors: ["#f97316", "#fecaca"],
        options: {
          rawValue: 72,
          percent: 0.72,
          __gaugeMin: 0,
          __gaugeMax: 100,
          range: { color: ["#465fff", "#e4e7ec"] },
        },
      }),
    );
    const fills = [...el.querySelectorAll("stop")].map((n) => n.getAttribute("stop-color"));
    expect(fills.some((c) => c?.toLowerCase().includes("f97316"))).toBe(true);
    const hub = el.querySelectorAll("circle")[1];
    expect(hub?.getAttribute("fill")).toMatch(/f97316/i);
  });

  it("applies label content and value format on center readout", () => {
    const el = document.createElement("div");
    renderD3GaugeChart(
      el,
      baseConfig({
        options: {
          rawValue: 238670,
          percent: 1,
          dimensionLabel: "综合满意度",
          __gaugeMin: 0,
          __gaugeMax: 100,
          __gaugeSplitNumber: 5,
        },
        labelContent: {
          showDimension: true,
          showIndicator: true,
          showPercent: false,
        },
        valueFormat: { type: "auto", decimals: 2, thousandSeparator: true },
      }),
    );
    const center = [...el.querySelectorAll("text")]
      .map((n) => n.textContent ?? "")
      .find((t) => t.includes("238"));
    expect(center).toContain("综合满意度");
    expect(center).toMatch(/238,670\.00/);
  });
});
