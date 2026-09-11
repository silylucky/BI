import { describe, expect, it } from "vitest";
import {
  applyChartDeStyleBlocksToPlan,
  readCartesianStyleFromPlanOptions,
  resolveBarBandPadding,
  resolveCartesianLineSmooth,
  resolveGaugeValuePercent,
  resolveLiquidPercent,
} from "@/lib/applyChartDeStyleBlocks";
import type { ChartDeStyle } from "@/lib/chartDeStyle";

describe("applyChartDeStyleBlocksToPlan", () => {
  it("maps cartesian and axis blocks to plan options", () => {
    const deStyle: ChartDeStyle = {
      cartesian: { barWidthRatio: 0.7, barRadius: 4, lineSmooth: true },
      axis: { x: { name: "月份" }, y: { name: "销售额" } },
    };
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Line", empty: false, options: {} },
      deStyle,
    );
    expect(plan.options.__barWidthRatio).toBe(0.7);
    expect(plan.options.__barRadius).toBe(4);
    expect(plan.options.smooth).toBe(true);
    expect(plan.options.__axisStyle).toEqual(deStyle.axis);
  });

  it("lineSmooth false overrides styleVariant smooth on line plans", () => {
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Line", empty: false, options: { smooth: true } },
      { cartesian: { lineSmooth: false } },
      { styleVariant: "smooth" },
    );
    expect(plan.options.smooth).toBe(false);
  });

  it("falls back to styleVariant smooth when lineSmooth is unset", () => {
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Line", empty: false, options: {} },
      {},
      { styleVariant: "smooth" },
    );
    expect(plan.options.smooth).toBe(true);
  });

  it("maps sankey treemap and circlePacking blocks to plan options", () => {
    const deStyle: ChartDeStyle = {
      sankey: { nodeWidth: 16, nodeGap: 12, linkOpacity: 0.6 },
      treemap: { paddingInner: 5, paddingOuter: 7, cellRadius: 4 },
      circlePacking: {
        layoutPadding: 3,
        labelMinRadius: 22,
        backgroundColor: "#f1f5f9",
        sizePercent: 80,
        showOuterRing: false,
      },
    };
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Sankey", empty: false, options: {} },
      deStyle,
    );
    expect(plan.options.__sankeyNodeWidth).toBe(16);
    expect(plan.options.__sankeyNodeGap).toBe(12);
    expect(plan.options.__sankeyLinkOpacity).toBe(0.6);
    expect(plan.options.__treemapPaddingInner).toBe(5);
    expect(plan.options.__treemapPaddingOuter).toBe(7);
    expect(plan.options.__treemapCellRadius).toBe(4);
    expect(plan.options.__circlePackingPadding).toBe(3);
    expect(plan.options.__circlePackingLabelMinRadius).toBe(22);
    expect(plan.options.__circlePackingBackgroundColor).toBe("#f1f5f9");
    expect(plan.options.__circlePackingSizePercent).toBe(80);
    expect(plan.options.__circlePackingShowOuterRing).toBe(false);
  });

  it("maps quadrant and compare shape blocks to plan options", () => {
    const deStyle: ChartDeStyle = {
      quadrant: { lineColor: "#ff0000", lineWidth: 2, showRegionBg: true, regionOpacity: 0.2 },
      progressBar: { trackOpacity: 0.5 },
      bullet: { targetLineWidth: 3, rangeOpacity: 0.7 },
      stockLine: { bodyWidthRatio: 0.75 },
    };
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Quadrant", empty: false, options: {} },
      deStyle,
    );
    expect(plan.options.__quadrantLineColor).toBe("#ff0000");
    expect(plan.options.__quadrantLineWidth).toBe(2);
    expect(plan.options.__progressBarTrackOpacity).toBe(0.5);
    expect(plan.options.__bulletTargetLineWidth).toBe(3);
    expect(plan.options.__stockBodyWidthRatio).toBe(0.75);
  });

  it("does not apply pie inner radius to rose charts", () => {
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Pie", empty: false, options: { innerRadius: 0 } },
      { pie: { innerRadiusPercent: 40 } },
      { chartType: "pie-rose" },
    );
    expect(plan.options.innerRadius).toBe(0);
  });

  it("applies pie inner radius to donut-rose charts", () => {
    const plan = applyChartDeStyleBlocksToPlan(
      { kind: "d3", plotType: "Pie", empty: false, options: { innerRadius: 0.5 } },
      { pie: { innerRadiusPercent: 40 } },
      { chartType: "pie-donut-rose" },
    );
    expect(plan.options.innerRadius).toBe(0.4);
  });
});

describe("resolveCartesianLineSmooth", () => {
  it("prefers explicit lineSmooth over plan and variant", () => {
    expect(
      resolveCartesianLineSmooth({ lineSmooth: false, planSmooth: true, styleVariant: "smooth" }),
    ).toBe(false);
    expect(
      resolveCartesianLineSmooth({ lineSmooth: true, planSmooth: false, styleVariant: "default" }),
    ).toBe(true);
  });
});

describe("resolveBarBandPadding", () => {
  it("converts bar width ratio to band padding", () => {
    expect(resolveBarBandPadding(0.55)).toBeCloseTo(0.45, 2);
  });
});

describe("readCartesianStyleFromPlanOptions", () => {
  it("reads cartesian style fields from plan options", () => {
    expect(
      readCartesianStyleFromPlanOptions({
        __barWidthRatio: 0.7,
        __barRadius: 5,
        __pointSize: 6,
        smooth: true,
        __axisStyle: { x: { name: "类目" } },
      }),
    ).toEqual({
      barWidthRatio: 0.7,
      barRadius: 5,
      pointSize: 6,
      areaOpacity: undefined,
      smooth: true,
      axisStyle: { x: { name: "类目" } },
    });
  });
});

describe("resolveGaugeValuePercent", () => {
  it("maps raw value into min/max range", () => {
    expect(resolveGaugeValuePercent({ __gaugeMin: 0, __gaugeMax: 200 }, 100, 0)).toBe(0.5);
    expect(resolveGaugeValuePercent({ __gaugeMin: 20, __gaugeMax: 120 }, 70, 0)).toBe(0.5);
  });
});

describe("resolveLiquidPercent", () => {
  it("uses fix max for fill and label percent", () => {
    const result = resolveLiquidPercent({ rows: [], columns: [] }, 238676, { maxType: "fix", max: 500000 });
    expect(result.max).toBe(500000);
    expect(result.labelPercent).toBeCloseTo(238676 / 500000);
    expect(result.fillPercent).toBeCloseTo(238676 / 500000);
  });

  it("defaults max to 1.5x raw value when fix max unset", () => {
    const result = resolveLiquidPercent({ rows: [], columns: [] }, 72, { maxType: "fix" });
    expect(result.max).toBe(108);
    expect(result.fillPercent).toBeCloseTo(72 / 108);
    expect(result.labelPercent).toBeCloseTo(2 / 3);
  });

  it("aggregates dynamic max field from rows", () => {
    const result = resolveLiquidPercent(
      {
        rows: [[100], [50]],
        columns: ["target"],
      },
      75,
      { maxType: "dynamic", maxField: "target" },
    );
    expect(result.max).toBe(150);
    expect(result.fillPercent).toBeCloseTo(0.5);
  });

  it("falls back to 1.5x metric when dynamic max column is missing", () => {
    const result = resolveLiquidPercent(
      {
        rows: [[3836]],
        columns: ["quantity"],
      },
      3836,
      { maxType: "dynamic", maxField: "amount" },
    );
    expect(result.max).toBeCloseTo(3836 * 1.5);
    expect(result.fillPercent).toBeCloseTo(2 / 3);
  });

  it("caps fill at 100% but label percent can exceed 1", () => {
    const result = resolveLiquidPercent({ rows: [], columns: [] }, 200, { maxType: "fix", max: 100 });
    expect(result.fillPercent).toBe(1);
    expect(result.labelPercent).toBe(2);
  });
});
