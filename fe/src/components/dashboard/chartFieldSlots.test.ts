import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { getDeAxisBlueprint } from "@/lib/chartDeAxis";
import { chartDataSlotBlueprint, chartFieldSlotHints, chartRenderRequiredCounts } from "@/components/dashboard/chartFieldSlots";

const ACTIVE_TYPES = BUILTIN_PLUGIN_DEFS.filter((d) => !d.deprecated).map((d) => d.type);

describe("chartFieldSlots", () => {
  it("T-INSP-DE-01: bar chart uses category/value axis labels", () => {
    expect(chartFieldSlotHints("bar")).toEqual({
      dimensionLabel: "类别轴 / 维度",
      metricLabel: "值轴 / 指标",
    });
  });

  it("T-INSP-DE-02: pie chart uses sector labels", () => {
    expect(chartFieldSlotHints("pie").dimensionLabel).toBe("扇区 / 维度");
  });

  it("T-INSP-DE-03b: line chart value axis supports multi metrics container", () => {
    const ySlot = chartDataSlotBlueprint("line").find((s) => s.axisId === "yAxis");
    expect(ySlot?.uiMode).toBe("multi");
    expect(ySlot?.label).toBe("值轴 / 指标");
  });

  it("T-INSP-DE-03: line chart exposes DE slot blueprint", () => {
    expect(chartDataSlotBlueprint("line").map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "子类别 / 维度",
      "值轴 / 指标",
      "钻取 / 维度",
    ]);
  });

  it("T-INSP-DE-04: sankey requires source and target dimension slots", () => {
    expect(chartDataSlotBlueprint("sankey").map((s) => s.label)).toEqual([
      "起始 / 维度",
      "终点 / 维度",
      "边权 / 指标",
    ]);
  });

  it("T-INSP-DE-05: t-heatmap requires x and y dimensions", () => {
    expect(chartDataSlotBlueprint("t-heatmap").map((s) => s.label)).toEqual([
      "横轴 / 维度",
      "纵轴 / 维度",
      "数值 / 指标",
    ]);
  });

  it("T-INSP-DE-06: deprecated timeline uses trend slots until migrate", () => {
    expect(chartDataSlotBlueprint("timeline").map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "子类别 / 维度",
      "值轴 / 指标",
      "钻取 / 维度",
    ]);
  });

  it("T-INSP-DE-08: map chart matches DE slot order", () => {
    expect(chartDataSlotBlueprint("map").map((s) => s.label)).toEqual([
      "地区 / 维度",
      "数据 / 指标",
      "钻取 / 维度 · 市级",
      "钻取 / 维度 · 区县",
    ]);
  });

  it("T-INSP-DE-07: line chart render requires only category + metric", () => {
    expect(chartRenderRequiredCounts("line")).toEqual({
      minDimensions: 1,
      minMetrics: 1,
    });
  });

  it("T-INSP-DE-09: dual-axis chart requires column + line metrics", () => {
    expect(chartDataSlotBlueprint("chart-mix").map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "左值轴 / 柱指标",
      "右子类别 / 维度",
      "右值轴 / 线指标",
      "钻取 / 维度",
    ]);
    expect(chartRenderRequiredCounts("chart-mix")).toEqual({
      minDimensions: 1,
      minMetrics: 1,
    });
  });

  it("T-INSP-DE-10: gauge and liquid expose metric-only slots", () => {
    expect(chartDataSlotBlueprint("gauge").map((s) => s.label)).toEqual(["指针角度 / 指标"]);
    expect(chartDataSlotBlueprint("liquid").map((s) => s.label)).toEqual(["进度指示 / 指标"]);
    expect(chartRenderRequiredCounts("gauge")).toEqual({ minDimensions: 0, minMetrics: 1 });
  });

  it("T-INSP-DE-11: scatter uses category dim + value metric (+ optional bubble)", () => {
    expect(chartDataSlotBlueprint("scatter").map((s) => s.label)).toEqual([
      "类别轴 / 维度",
      "值轴 / 指标",
      "气泡大小 / 指标",
    ]);
  });

  it("T-INSP-DE-11b: quadrant uses category dim + X/Y metrics (+ optional bubble)", () => {
    expect(chartDataSlotBlueprint("quadrant").map((s) => s.label)).toEqual([
      "类别 / 维度",
      "X 轴 / 指标",
      "Y 轴 / 指标",
      "气泡大小 / 指标",
    ]);
    expect(chartRenderRequiredCounts("quadrant")).toEqual({ minDimensions: 1, minMetrics: 2 });
  });

  it("T-INSP-DE-11d: bidirectional-bar requires two metrics", () => {
    expect(chartRenderRequiredCounts("bidirectional-bar")).toEqual({
      minDimensions: 1,
      minMetrics: 2,
    });
  });

  it("T-INSP-DE-11c: multi-scatter uses DE axis order", () => {
    expect(chartDataSlotBlueprint("multi-scatter").map((s) => s.label)).toEqual([
      "颜色 / 维度",
      "X 轴 / 时间维度或指标",
      "Y 轴 / 指标",
      "明暗 / 指标",
      "气泡大小 / 指标",
    ]);
    expect(chartRenderRequiredCounts("multi-scatter")).toEqual({ minDimensions: 1, minMetrics: 2 });
  });

  it("T-INSP-DE-11e: kpi uses single 指标 slot", () => {
    expect(chartDataSlotBlueprint("kpi").map((s) => s.label)).toEqual(["指标"]);
    expect(chartRenderRequiredCounts("kpi")).toEqual({ minDimensions: 0, minMetrics: 1 });
  });

  it("T-INSP-DE-11f: stock-line uses single yAxis with four OHLC slots", () => {
    const ySlots = chartDataSlotBlueprint("stock-line").filter((s) => s.axisId === "yAxis");
    expect(ySlots).toHaveLength(4);
  });

  it("T-INSP-DE-12: table-pivot requires row dimension; column dimension is optional", () => {
    const slots = chartDataSlotBlueprint("table-pivot");
    expect(slots.filter((s) => s.kind === "dimension" && s.required !== false).length).toBe(1);
    expect(chartRenderRequiredCounts("table-pivot")).toEqual({ minDimensions: 1, minMetrics: 1 });
  });

  it("T-INSP-DE-13a: table-normal uses multi dimension and metric slots", () => {
    const slots = chartDataSlotBlueprint("table-normal");
    expect(slots.map((s) => s.label)).toEqual([
      "数据列 / 维度",
      "数据列 / 指标",
      "钻取 / 维度",
    ]);
    expect(slots[0]?.uiMode).toBe("multi");
    expect(slots[1]?.uiMode).toBe("multi");
  });

  it("T-INSP-DE-13: table-info uses single multi data column + drill slots", () => {
    expect(chartDataSlotBlueprint("table-info").map((s) => s.label)).toEqual([
      "数据列 / 维度或指标",
      "钻取 / 维度",
    ]);
    expect(chartDataSlotBlueprint("table-info")[0]?.uiMode).toBe("multi");
  });

  it.each(ACTIVE_TYPES.map((t) => [t] as const))(
    "T-INSP-DE-golden %s: slot label array matches catalog",
    (chartType) => {
      const expected = getDeAxisBlueprint(chartType).map((s) => s.label);
      expect(chartDataSlotBlueprint(chartType).map((s) => s.label)).toEqual(expected);
    },
  );
});
