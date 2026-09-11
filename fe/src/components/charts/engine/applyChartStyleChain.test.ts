import { describe, expect, it } from "vitest";
import { applyChartStyleChain } from "@/components/charts/engine/applyChartStyleChain";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

const basePlan: ChartRenderPlan = {
  kind: "d3",
  plotType: "Column",
  options: {
    data: [
      { x: "a", y: 10 },
      { x: "b", y: 30 },
    ],
    xField: "x",
    yField: "y",
  },
};

const baseStyle: ChartStyleContext = {
  scheme: "light",
  deStyle: {},
  deFeatures: {
    conditionalRules: [
      { id: "r1", enabled: true, operator: "gte", value: 20, color: "#12b76a" },
    ],
  },
  chartColors: ["#465fff"],
  dataScreenSurface: false,
  showLabel: false,
  showTooltip: true,
  seriesGradient: false,
  depthVisual: "off",
  dataZoom: false,
  labelContent: { showIndicator: true },
  labelPresentation: { fontSize: 12 },
  tooltipPresentation: { fontSize: 12 },
  shellLegend: false,
  embedEdit: false,
};

const barConfig: ChartViewConfig = {
  chartType: "bar",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "x" }],
  metrics: [{ field: "y" }],
};

describe("applyChartStyleChain", () => {
  it("passes conditional rules into d3 plan options", () => {
    const next = applyChartStyleChain(basePlan, baseStyle, barConfig);
    expect(next.options.__conditionalRules).toHaveLength(1);
  });

  it("prefers conditional rules over seriesColor palette injection", () => {
    const styleWithSeries: ChartStyleContext = {
      ...baseStyle,
      chartColors: [],
      deStyle: {
        seriesColor: [{ name: "y", color: "#000000" }],
      },
    };
    const next = applyChartStyleChain(basePlan, styleWithSeries, barConfig);
    expect(next.options.color).toBeUndefined();
    expect(next.options.__conditionalRules).toHaveLength(1);
  });

  it("uses dashboard palette for inherited series colors", () => {
    const style: ChartStyleContext = {
      ...baseStyle,
      deFeatures: {},
      deStyle: {},
      effectivePaletteId: "pastel",
      chartColors: ["#84adff", "#b2ddff"],
    };
    const next = applyChartStyleChain(basePlan, style, barConfig);
    expect(next.options.color).toEqual(["#84adff"]);
  });

  it("uses component custom palette colors for series defaults", () => {
    const config: ChartViewConfig = {
      ...barConfig,
      nativeBody: {
        deStyle: {
          paletteId: "default",
          paletteColors: ["#111111", "#222222"],
        },
      },
    };
    const style: ChartStyleContext = {
      ...baseStyle,
      deFeatures: {},
      deStyle: config.nativeBody!.deStyle!,
      effectivePaletteId: "default",
      chartColors: ["#111111", "#222222"],
    };
    const next = applyChartStyleChain(basePlan, style, config);
    expect(next.options.color).toEqual(["#111111"]);
  });

  it("ignores disabled conditional rules for palette injection", () => {
    const style: ChartStyleContext = {
      ...baseStyle,
      deFeatures: {
        conditionalRules: [
          { id: "r1", enabled: false, operator: "gte", value: 20, color: "#12b76a" },
        ],
      },
      effectivePaletteId: "pastel",
      chartColors: ["#84adff"],
    };
    const next = applyChartStyleChain(basePlan, style, barConfig);
    expect(next.options.color).toEqual(["#84adff"]);
  });

  it("maps deStyle type blocks through the full style chain", () => {
    const style: ChartStyleContext = {
      ...baseStyle,
      deFeatures: {},
      deStyle: {
        cartesian: { barWidthRatio: 0.72, barRadius: 6, lineSmooth: true, pointSize: 6, areaOpacity: 0.4 },
        axis: { x: { name: "类目" }, y: { show: true, name: "数值" } },
        liquid: { max: 500000, outlineWidth: 2, waveColor: "#12b76a", size: 80 },
        radar: { shape: "circle", areaOpacity: 0.3, showAxisName: false, radiusPercent: 80 },
        wordCloud: { fontSizeMin: 10, fontSizeMax: 36, spacing: 4 },
        sankey: { nodeWidth: 14, nodeGap: 9, linkOpacity: 0.55 },
        graph: { layout: "dagre", edgeLength: 96, repulsion: 180 },
      },
    };

    const barNext = applyChartStyleChain(basePlan, style, barConfig);
    expect(barNext.options.__barWidthRatio).toBe(0.72);
    expect(barNext.options.__barRadius).toBe(6);
    expect(barNext.options.__pointSize).toBe(6);
    expect(barNext.options.__areaOpacity).toBe(0.4);
    expect(barNext.options.__axisStyle).toEqual(style.deStyle.axis);

    const linePlan: ChartRenderPlan = { kind: "d3", plotType: "Line", empty: false, options: {} };
    const lineNext = applyChartStyleChain(linePlan, style, barConfig);
    expect(lineNext.options.smooth).toBe(true);

    const liquidPlan: ChartRenderPlan = {
      kind: "d3",
      plotType: "Liquid",
      empty: false,
      options: { rawValue: 238676, rows: [], columns: [] },
    };
    const liquidNext = applyChartStyleChain(liquidPlan, style);
    expect(liquidNext.options.__liquidMax).toBe(500000);
    expect(liquidNext.options.__liquidOutlineWidth).toBe(2);
    expect(liquidNext.options.__liquidWaveColor).toBe("#12b76a");
    expect(liquidNext.options.__liquidSize).toBe(80);
    expect(liquidNext.options.__liquidFillPercent).toBeCloseTo(238676 / 500000);
    expect(liquidNext.options.__liquidShowMetric).toBe(true);
    expect(liquidNext.options.__liquidShowRatio).toBe(false);
    expect(liquidNext.options.__liquidMetricFormat).toMatchObject({ type: "auto" });

    const dynamicLiquidPlan: ChartRenderPlan = {
      kind: "d3",
      plotType: "Liquid",
      empty: false,
      options: {
        rawValue: 3836,
        rows: [[3836, 1_000_000]],
        columns: ["quantity", "amount"],
      },
    };
    const dynamicLiquidNext = applyChartStyleChain(dynamicLiquidPlan, {
      ...baseStyle,
      deFeatures: {},
      deStyle: {
        liquid: { maxType: "dynamic", maxField: "amount" },
      },
    });
    expect(dynamicLiquidNext.options.__liquidMax).toBe(1_000_000);
    expect(dynamicLiquidNext.options.__liquidFillPercent).toBeCloseTo(3836 / 1_000_000);

    const radarPlan: ChartRenderPlan = { kind: "d3", plotType: "Radar", empty: false, options: {} };
    const radarNext = applyChartStyleChain(radarPlan, style);
    expect(radarNext.options.__radarShape).toBe("circle");
    expect(radarNext.options.__radarAreaOpacity).toBe(0.3);
    expect(radarNext.options.__radarShowAxisName).toBe(false);
    expect(radarNext.options.__radarRadiusPercent).toBe(80);

    const wordPlan: ChartRenderPlan = { kind: "d3", plotType: "WordCloud", empty: false, options: {} };
    const wordNext = applyChartStyleChain(wordPlan, style);
    expect(wordNext.options.__wordCloudFontMin).toBe(10);
    expect(wordNext.options.__wordCloudFontMax).toBe(36);
    expect(wordNext.options.__wordCloudSpacing).toBe(4);

    const sankeyPlan: ChartRenderPlan = { kind: "d3", plotType: "Sankey", empty: false, options: {} };
    const sankeyNext = applyChartStyleChain(sankeyPlan, style);
    expect(sankeyNext.options.__sankeyNodeWidth).toBe(14);
    expect(sankeyNext.options.__sankeyNodeGap).toBe(9);
    expect(sankeyNext.options.__sankeyLinkOpacity).toBe(0.55);

    const graphPlan: ChartRenderPlan = { kind: "d3", plotType: "Graph", empty: false, options: {} };
    const graphNext = applyChartStyleChain(graphPlan, style);
    expect(graphNext.options.__graphLayout).toBe("dagre");
    expect(graphNext.options.__graphEdgeLength).toBe(96);
    expect(graphNext.options.__graphRepulsion).toBe(180);
  });

  it("lineSmooth false overrides styleVariant smooth in full style chain", () => {
    const lineConfig: ChartViewConfig = {
      chartType: "line",
      styleVariant: "smooth",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
    };
    const linePlan: ChartRenderPlan = {
      kind: "d3",
      plotType: "Line",
      options: { data: [], xField: "x", yField: "y", smooth: true },
    };
    const style: ChartStyleContext = {
      ...baseStyle,
      deStyle: { cartesian: { lineSmooth: false } },
    };
    const next = applyChartStyleChain(linePlan, style, lineConfig);
    expect(next.options.smooth).toBe(false);
  });
});
