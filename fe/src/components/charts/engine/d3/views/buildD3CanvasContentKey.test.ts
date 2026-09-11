import { describe, expect, it } from "vitest";
import { buildD3CanvasContentKey } from "@/components/charts/engine/d3/views/buildD3CanvasContentKey";
import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { patchChartLabelStyle } from "@/lib/chartDeStyle";

const piePlan: ChartRenderPlan = {
  kind: "d3",
  plotType: "Pie",
  options: {
    data: [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
    ],
    angleField: "value",
    colorField: "category",
    __pieLabelPosition: "inside",
  },
};

const baseStyle: ChartStyleContext = {
  scheme: "light",
  deStyle: { label: { position: "inside", fontSize: 12 } },
  deFeatures: {},
  chartColors: ["#465fff", "#84adff"],
  dataScreenSurface: false,
  showLabel: true,
  showTooltip: true,
  seriesGradient: false,
  depthVisual: "off",
  dataZoom: false,
  labelContent: { showIndicator: true, showPercent: true },
  labelPresentation: { fontSize: 12 },
  tooltipPresentation: { fontSize: 12 },
  shellLegend: false,
  embedEdit: true,
};

const pieConfig: ChartViewConfig = {
  chartType: "pie",
  dataSourceId: "ds",
  mode: "sql",
  sql: "select 1",
  dimensions: [{ field: "category" }],
  metrics: [{ field: "value" }],
  nativeBody: {
    deStyle: { label: { position: "inside", fontSize: 12 } },
  },
};

function buildKey(
  style: ChartStyleContext,
  chartConfig: ChartViewConfig = pieConfig,
  plan: ChartRenderPlan = piePlan,
): string {
  return buildD3CanvasContentKey({
    chartType: "pie",
    plotType: plan.plotType,
    plan,
    rowCount: 2,
    rowSample: "A,10|B,20",
    style,
    chartConfig,
  });
}

describe("buildD3CanvasContentKey", () => {
  it("changes when pie label position changes", () => {
    const inside = buildKey(baseStyle);
    const outsideConfig = patchChartLabelStyle(pieConfig, { position: "outside" });
    const outsideStyle: ChartStyleContext = {
      ...baseStyle,
      deStyle: { ...baseStyle.deStyle, label: { ...baseStyle.deStyle.label, position: "outside" } },
    };
    const outside = buildKey(outsideStyle, outsideConfig);
    expect(outside).not.toBe(inside);
  });

  it("changes when label font size changes", () => {
    const before = buildKey(baseStyle);
    const afterStyle: ChartStyleContext = {
      ...baseStyle,
      deStyle: { ...baseStyle.deStyle, label: { ...baseStyle.deStyle.label, fontSize: 16 } },
      labelPresentation: { fontSize: 16 },
    };
    const after = buildKey(afterStyle);
    expect(after).not.toBe(before);
  });

  it("stays stable when unrelated props are unchanged", () => {
    const a = buildKey(baseStyle);
    const b = buildKey({ ...baseStyle });
    expect(a).toBe(b);
  });
});
