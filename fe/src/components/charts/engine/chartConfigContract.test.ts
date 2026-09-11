import { describe, expect, it } from "vitest";
import { applyChartStyleChain } from "@/components/charts/engine/applyChartStyleChain";
import { buildChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { buildStyleContext } from "@/components/charts/engine/buildStyleContext";
import { buildChartViewModel } from "@/components/charts/engine/buildChartViewModel";
import { buildD3DispatchPayload } from "@/components/charts/engine/d3/views/buildRenderConfig";
import { resolveChartColors } from "@/lib/chartPalette";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

const barConfig: ChartViewConfig = {
  chartType: "bar",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "x" }],
  metrics: [{ field: "y" }],
};

const dualConfig: ChartViewConfig = {
  chartType: "chart-mix",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "sale_date" }],
  metrics: [{ field: "amount" }, { field: "amount2" }],
  nativeBody: {
    deFeatures: {
      dataZoom: true,
      markLines: [{ id: "m1", enabled: true, value: 50, lineStyle: "dashed", color: "#000" }],
      conditionalRules: [{ id: "c1", enabled: true, operator: "gte", value: 10, color: "#12b76a" }],
    },
    deStyle: { label: { show: true } },
  },
};

const areaConfig: ChartViewConfig = {
  chartType: "area",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "sale_date" }],
  metrics: [{ field: "amount" }],
  nativeBody: {
    deFeatures: { dataZoom: true },
    deStyle: { label: { show: true } },
  },
};

const hbarConfig: ChartViewConfig = {
  chartType: "bar-horizontal",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "region" }],
  metrics: [{ field: "amount" }],
  nativeBody: {
    deFeatures: {
      dataZoom: true,
      markLines: [{ id: "m1", enabled: true, value: 100, lineStyle: "solid", color: "#000" }],
    },
  },
};

function baseStyle(overrides: Partial<ChartStyleContext> = {}): ChartStyleContext {
  return {
    scheme: "light",
    deStyle: {},
    deFeatures: {},
    chartColors: ["#465fff"],
    dataScreenSurface: false,
    showLabel: false,
    showTooltip: true,
    seriesGradient: false,
    dataZoom: false,
    labelContent: { showIndicator: true },
    labelPresentation: { fontSize: 12 },
    tooltipPresentation: { fontSize: 12 },
    shellLegend: false,
    embedEdit: false,
    ...overrides,
  };
}

describe("chart config contract L2", () => {
  it("applyChartStyleChain injects dataZoom for DualAxes plan", () => {
    const plan: ChartRenderPlan = {
      kind: "d3",
      plotType: "DualAxes",
      options: { data: [[], []], xField: "__category__", yField: ["__value__", "__value__"] },
    };
    const next = applyChartStyleChain(plan, baseStyle({ dataZoom: true }), dualConfig);
    expect(next.options.__dataZoom).toBe(true);
  });

  it("applyChartStyleChain injects markLines and conditional rules", () => {
    const plan: ChartRenderPlan = {
      kind: "d3",
      plotType: "Column",
      options: { data: [], xField: "x", yField: "y" },
    };
    const style = baseStyle({
      deFeatures: {
        markLines: [{ id: "m1", enabled: true, value: 10, lineStyle: "solid", color: "#000" }],
        conditionalRules: [{ id: "c1", enabled: true, operator: "gte", value: 5, color: "#f00" }],
      },
    });
    const next = applyChartStyleChain(plan, style, barConfig);
    expect(next.options.__markLines).toHaveLength(1);
    expect(next.options.__conditionalRules).toHaveLength(1);
  });

  it("dual axes dispatch payload carries dataZoom and showLabel", () => {
    const vm = buildChartViewModel(dualConfig, {
      columns: ["sale_date", "amount", "amount2"],
      rows: [
        ["2025-07-01", 100, 80],
        ["2025-07-02", 200, 120],
      ],
    });
    const style = buildStyleContext({ config: dualConfig, chartColors: ["#465fff", "#12b76a"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, dualConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: dualConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("dualAxes");
    if (payload?.kind === "dualAxes") {
      expect(payload.config.dataZoom).toBe(true);
      expect(payload.config.showLabel).toBe(true);
      expect(payload.config.markLines).toHaveLength(1);
    }
  });

  it("dual axes dispatch carries cartesian style from deStyle", () => {
    const mixConfig: ChartViewConfig = {
      ...dualConfig,
      nativeBody: {
        deStyle: {
          cartesian: { barWidthRatio: 0.72, lineSmooth: true },
          axis: { x: { name: "月份" }, y: { show: true } },
        },
      },
    };
    const vm = buildChartViewModel(mixConfig, {
      columns: ["sale_date", "amount", "amount2"],
      rows: [
        ["2025-07-01", 100, 80],
        ["2025-07-02", 200, 120],
      ],
    });
    const style = buildStyleContext({ config: mixConfig, chartColors: ["#465fff", "#12b76a"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, mixConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: mixConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("dualAxes");
    if (payload?.kind === "dualAxes") {
      expect(payload.config.barWidthRatio).toBe(0.72);
      expect(payload.config.smooth).toBe(true);
      expect(payload.config.axisStyle?.x?.name).toBe("月份");
    }
  });

  it("waterfall dispatch carries axis and bar radius style", () => {
    const waterfallConfig: ChartViewConfig = {
      chartType: "waterfall",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "step" }],
      metrics: [{ field: "delta" }],
      nativeBody: {
        deStyle: {
          cartesian: { barRadius: 8 },
          axis: { y: { name: "累计" } },
        },
      },
    };
    const vm = buildChartViewModel(waterfallConfig, {
      columns: ["step", "delta"],
      rows: [
        ["A", 10],
        ["B", -5],
      ],
    });
    const style = buildStyleContext({ config: waterfallConfig, chartColors: ["#465fff", "#f04438"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, waterfallConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: waterfallConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("waterfall");
    if (payload?.kind === "waterfall") {
      expect(payload.config.barRadius).toBe(8);
      expect(payload.config.axisStyle?.y?.name).toBe("累计");
    }
  });

  it("scatter dispatch carries axis and point size style", () => {
    const scatterConfig: ChartViewConfig = {
      chartType: "scatter",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
      nativeBody: {
        deStyle: {
          cartesian: { pointSize: 8 },
          axis: { x: { name: "X" }, y: { name: "Y" } },
        },
      },
    };
    const vm = buildChartViewModel(scatterConfig, {
      columns: ["x", "y"],
      rows: [
        [1, 2],
        [3, 4],
      ],
    });
    const style = buildStyleContext({ config: scatterConfig, chartColors: ["#465fff"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, scatterConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: scatterConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("generic");
    if (payload?.kind === "generic") {
      expect(payload.config.pointSize).toBe(8);
      expect(payload.config.axisStyle?.x?.name).toBe("X");
      expect(payload.config.axisStyle?.y?.name).toBe("Y");
    }
  });

  it("area cartesian config passes dataZoom and showLabel", () => {
    const vm = buildChartViewModel(areaConfig, {
      columns: ["sale_date", "amount"],
      rows: [
        ["2025-07-01", 100],
        ["2025-07-02", 200],
      ],
    });
    const style = buildStyleContext({ config: areaConfig, chartColors: ["#465fff"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, areaConfig);
    expect(plan.options.__dataZoom).toBe(true);
    expect(style.showLabel).toBe(true);
  });

  it("horizontal bar plan receives dataZoom flag", () => {
    const vm = buildChartViewModel(hbarConfig, {
      columns: ["region", "amount"],
      rows: [
        ["华东", 100],
        ["华北", 200],
      ],
    });
    const style = buildStyleContext({ config: hbarConfig, chartColors: ["#465fff"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), { ...style, dataZoom: true }, hbarConfig);
    expect(plan.options.__dataZoom).toBe(true);
    expect(plan.options.__markLines).toHaveLength(1);
  });

  it("buildStyleContext merges dashboard defaults into presentation props", () => {
    const config: ChartViewConfig = {
      chartType: "bar",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "x" }],
      metrics: [{ field: "y" }],
    };
    const style = buildStyleContext({
      config,
      chartColors: ["#465fff"],
      dashboardDefaults: {
        chartLabelShow: true,
        seriesGradient: true,
        tooltipShow: true,
        chartLabelStyle: { fontSize: 15, color: "#112233" },
        chartTooltipStyle: { fontSize: 14, color: "#aabbcc", background: "#222222" },
      },
    });
    expect(style.seriesGradient).toBe(true);
    expect(style.labelPresentation).toEqual({ fontSize: 15, color: "#112233" });
    expect(style.tooltipPresentation).toEqual({
      fontSize: 14,
      color: "#aabbcc",
      background: "#222222",
    });

    const vm = buildChartViewModel(config, {
      columns: ["x", "y"],
      rows: [
        ["a", 1],
        ["b", 2],
      ],
    });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, config);
    expect(plan.options.__seriesGradient).toBe(true);
    expect(plan.options.__labelColor).toBe("#112233");
    expect(plan.options.__tooltipPresentation).toMatchObject({ background: "#222222" });

    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: config, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("cartesian");
    if (payload?.kind === "cartesian") {
      expect(payload.config.labelColor).toBe("#112233");
      expect(payload.config.seriesGradient).toBe(true);
      expect(payload.config.tooltipPresentation?.background).toBe("#222222");
    }
  });

  it("bar-range dispatch carries axis and bar shape style", () => {
    const barRangeConfig: ChartViewConfig = {
      chartType: "bar-range",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "cat" }],
      metrics: [{ field: "low" }, { field: "high" }],
      nativeBody: {
        deStyle: {
          cartesian: { barWidthRatio: 0.65, barRadius: 8 },
          axis: { x: { name: "区间" }, y: { name: "类别" } },
        },
      },
    };
    const vm = buildChartViewModel(barRangeConfig, {
      columns: ["cat", "low", "high"],
      rows: [
        ["A", 10, 30],
        ["B", 5, 20],
      ],
    });
    const style = buildStyleContext({ config: barRangeConfig, chartColors: ["#465fff"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, barRangeConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: barRangeConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("barRange");
    if (payload?.kind === "barRange") {
      expect(payload.config.barWidthRatio).toBe(0.65);
      expect(payload.config.barRadius).toBe(8);
      expect(payload.config.axisStyle?.x?.name).toBe("区间");
      expect(payload.config.axisStyle?.y?.name).toBe("类别");
    }
  });

  it("progress-bar dispatch carries axis and bar shape style", () => {
    const progressConfig: ChartViewConfig = {
      chartType: "progress-bar",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "cat" }],
      metrics: [{ field: "target" }, { field: "value" }],
      nativeBody: {
        deStyle: {
          cartesian: { barRadius: 10 },
          axis: { x: { name: "完成度" } },
        },
      },
    };
    const vm = buildChartViewModel(progressConfig, {
      columns: ["cat", "target", "value"],
      rows: [["A", 100, 50]],
    });
    const style = buildStyleContext({ config: progressConfig, chartColors: ["#465fff"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, progressConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: progressConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("progressBar");
    if (payload?.kind === "progressBar") {
      expect(payload.config.barRadius).toBe(10);
      expect(payload.config.axisStyle?.x?.name).toBe("完成度");
    }
  });

  it("pie chart uses pastel palette from style chain", () => {
    const pieConfig: ChartViewConfig = {
      chartType: "pie",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "category" }],
      metrics: [{ field: "value" }],
      nativeBody: { deStyle: { paletteId: "pastel" } },
    };
    const pastelColors = resolveChartColors("pastel");
    const vm = buildChartViewModel(pieConfig, {
      columns: ["category", "value"],
      rows: [
        ["A", 30],
        ["B", 70],
      ],
    });
    const style = buildStyleContext({
      config: pieConfig,
      chartColors: [...pastelColors],
      dashboardPaletteId: "default",
    });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, pieConfig);
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: pieConfig, isDark: false },
      plan,
      400,
      300,
    );
    expect(payload?.kind).toBe("generic");
    if (payload?.kind === "generic") {
      expect(payload.config.colors[0]).toBe(pastelColors[0]);
    }
  });

  it("map choropleth dispatch carries areaMapping lookup", () => {
    const mapConfig: ChartViewConfig = {
      chartType: "map",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "province" }],
      metrics: [{ field: "value" }],
      nativeBody: {
        deStyle: {
          geo: {
            areaMapping: [{ id: "m1", from: "EAST_01", to: "江苏省" }],
          },
        },
      },
    };
    const vm = buildChartViewModel(mapConfig, {
      columns: ["province", "value"],
      rows: [["EAST_01", 100]],
    });
    const style = buildStyleContext({ config: mapConfig, chartColors: ["#1653a9"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, mapConfig);
    const planWithGeo = {
      ...plan,
      options: {
        ...plan.options,
        mapId: "vs-regions",
        knownRegionNames: undefined,
        drillDepth: 0,
      },
    };
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: mapConfig, isDark: false },
      planWithGeo,
      400,
      300,
    );
    expect(payload?.kind).toBe("geo");
    if (payload?.kind === "geo") {
      expect(payload.config.areaMapping?.get("EAST_01")).toBe("江苏省");
    }
  });

  it("map-3d choropleth dispatch carries same areaMapping lookup as map", () => {
    const mapConfig: ChartViewConfig = {
      chartType: "map-3d",
      dataSourceId: "ds",
      mode: "sql",
      sql: "select 1",
      dimensions: [{ field: "province" }],
      metrics: [{ field: "value" }],
      nativeBody: {
        deStyle: {
          geo: {
            areaMapping: [{ id: "m1", from: "EAST_01", to: "江苏省" }],
          },
        },
      },
    };
    const vm = buildChartViewModel(mapConfig, {
      columns: ["province", "value"],
      rows: [["EAST_01", 100]],
    });
    const style = buildStyleContext({ config: mapConfig, chartColors: ["#1653a9"] });
    const plan = applyChartStyleChain(buildChartRenderPlan(vm), style, mapConfig);
    const planWithGeo = {
      ...plan,
      options: {
        ...plan.options,
        mapId: "vs-regions",
        knownRegionNames: undefined,
        drillDepth: 0,
      },
    };
    const payload = buildD3DispatchPayload(
      { viewModel: vm, style, chartConfig: mapConfig, isDark: false },
      planWithGeo,
      400,
      300,
    );
    expect(payload?.kind).toBe("geo");
    if (payload?.kind === "geo") {
      expect(payload.config.areaMapping?.get("EAST_01")).toBe("江苏省");
    }
  });
});
