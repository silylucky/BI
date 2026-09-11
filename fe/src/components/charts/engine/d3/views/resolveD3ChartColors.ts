import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { resolveCartesianAxisFields } from "@/components/charts/engine/buildDatasetEncoding";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import { readChartDeStyle } from "@/lib/chartDeStyle";
import { resolveChartSeriesColorItems, resolveSeriesPaletteColors } from "@/lib/chartSeriesColor";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

/** 第二维度拆系列时，系列色应按维度取值而非单指标色 */
function usesDimensionDrivenSeries(chartConfig: ChartViewConfig): boolean {
  const { subDim } = resolveCartesianAxisFields({
    dimensions: chartConfig.dimensions ?? [],
    metrics: chartConfig.metrics ?? [],
    axes: chartConfig.axes,
  });
  return Boolean(subDim);
}

function hasActiveConditionalRules(style: ChartStyleContext): boolean {
  return (style.deFeatures?.conditionalRules ?? []).some((rule) => rule.enabled !== false);
}

/** D3 渲染取色：系列色 > 样式链 chartColors > plan 遗留 color */
export function resolveD3ChartColors(
  style: ChartStyleContext,
  plan: ChartRenderPlan,
  chartConfig?: ChartViewConfig,
): string[] {
  const optionColors = Array.isArray(plan.options.color) ? (plan.options.color as string[]) : [];
  const paletteId = style.effectivePaletteId ?? style.deStyle.paletteId;
  const seriesPaletteColors = chartConfig
    ? resolveSeriesPaletteColors(chartConfig, style.chartColors)
    : undefined;
  const paletteItems =
    chartConfig && !hasActiveConditionalRules(style)
      ? resolveChartSeriesColorItems(
          chartConfig,
          paletteId,
          readChartDeStyle(chartConfig).seriesColor ?? style.deStyle.seriesColor,
          seriesPaletteColors,
        )
      : [];

  if (paletteItems.length > 0) {
    if (chartConfig && usesDimensionDrivenSeries(chartConfig) && style.chartColors.length > 0) {
      return style.chartColors;
    }
    return paletteItems.map((item) => item.color);
  }
  if (style.chartColors.length > 0) {
    return style.chartColors;
  }
  if (optionColors.length > 0) {
    return optionColors;
  }
  return ["#465fff"];
}

export { hasActiveConditionalRules };
