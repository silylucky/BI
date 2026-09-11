import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderD3LiquidChart } from "@/components/charts/engine/d3/radial/renderLiquid";
import type { D3RenderConfig } from "@/components/charts/engine/d3/types";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { resolveLiquidMetricFormat } from "@/lib/liquidLabelFormat";

function baseConfig(overrides?: Partial<D3RenderConfig>): D3RenderConfig {
  const metricFormat = resolveLiquidMetricFormat({
    metricFormatType: "auto",
    metricThousandSeparator: true,
  });
  return {
    width: 400,
    height: 320,
    colors: ["#465fff"],
    theme: getAntvThemeTokens("light"),
    showLabel: true,
    showTooltip: true,
    labelColor: undefined,
    labelFontSize: 12,
    tooltipPresentation: { fontSize: 14, color: "#ff00aa", background: "#111122" },
    valueFormat: undefined,
    options: {
      rawValue: 61930,
      __liquidMax: 61930,
      __liquidFillPercent: 1,
      __liquidLabelPercent: 1,
      __liquidSize: 80,
      __liquidShowMetric: true,
      __liquidShowRatio: false,
      __liquidMetricFormat: metricFormat,
    },
    data: [],
    ...overrides,
  } as D3RenderConfig;
}

describe("renderD3LiquidChart", () => {
  beforeEach(() => setChartAnimationSuppressed(true));
  afterEach(() => setChartAnimationSuppressed(false));

  it("renders metric value without percent scaling (DE 指标)", () => {
    const el = document.createElement("div");
    const dispose = renderD3LiquidChart(el, baseConfig());
    expect(el.querySelector("text")?.textContent).toBe("61,930");
    dispose();
  });

  it("applies metric format decimals and unit suffix", () => {
    const el = document.createElement("div");
    renderD3LiquidChart(
      el,
      baseConfig({
        options: {
          ...baseConfig().options,
          __liquidMetricFormat: {
            type: "number",
            decimals: 2,
            unit: "万",
            thousandSeparator: true,
          },
        },
      }),
    );
    expect(el.querySelector("text")?.textContent).toBe("61,930.00万");
  });

  it("renders ratio line only as percent", () => {
    const el = document.createElement("div");
    renderD3LiquidChart(
      el,
      baseConfig({
        options: {
          ...baseConfig().options,
          __liquidShowMetric: false,
          __liquidShowRatio: true,
          __liquidRatioDecimals: 1,
        },
      }),
    );
    expect(el.querySelector("text")?.textContent).toBe("100.0%");
  });

  it("renders metric and ratio on separate lines", () => {
    const el = document.createElement("div");
    renderD3LiquidChart(
      el,
      baseConfig({
        options: {
          rawValue: 238676,
          __liquidMax: 500000,
          __liquidFillPercent: 238676 / 500000,
          __liquidLabelPercent: 238676 / 500000,
          __liquidSize: 80,
          __liquidShowMetric: true,
          __liquidShowRatio: true,
          __liquidRatioDecimals: 0,
          __liquidMetricFormat: resolveLiquidMetricFormat({ metricFormatType: "auto" }),
        },
      }),
    );
    const tspans = el.querySelectorAll("tspan");
    expect(tspans.length).toBe(2);
    expect(tspans[0]?.textContent).toBe("238,676");
    expect(tspans[1]?.textContent).toBe("48%");
  });

  it("applies label color to center text", () => {
    const el = document.createElement("div");
    renderD3LiquidChart(el, baseConfig({ labelColor: "#ff0000" }));
    expect(el.querySelector("text")?.getAttribute("fill")).toBe("#ff0000");
  });

  it("applies tooltipPresentation styles to hover tooltip", () => {
    const el = document.createElement("div");
    renderD3LiquidChart(el, baseConfig());
    const tip = el.querySelector("div");
    expect(tip?.style.fontSize).toBe("14px");
    expect(tip?.style.color).toBe("rgb(255, 0, 170)");
    expect(tip?.style.background).toBe("rgb(17, 17, 34)");
  });

  it("does not render tooltip layer when showTooltip is false", () => {
    const el = document.createElement("div");
    renderD3LiquidChart(el, baseConfig({ showTooltip: false }));
    expect(el.querySelector("div")).toBeNull();
  });
});
