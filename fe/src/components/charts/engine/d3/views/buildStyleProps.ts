import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { buildD3PresentationProps } from "@/components/charts/engine/d3/core/presentation";
import { resolveD3ChartColors } from "@/components/charts/engine/d3/views/resolveD3ChartColors";
import { readChartConditionalRules, readChartMarkLines } from "@/lib/chartDeFeatures";
import { resolveDataLabelContentFromDeStyle } from "@/lib/chartDataLabelFormat";

export function buildD3StyleProps(props: ChartEngineViewProps, plan: ChartRenderPlan) {
  const { style, chartConfig, isDark } = props;
  const options = plan.options;
  const colors = resolveD3ChartColors(style, plan, chartConfig);

  const conditionalFromPlan = options.__conditionalRules as ReturnType<typeof readChartConditionalRules>;
  const conditionalRules = chartConfig
    ? readChartConditionalRules(chartConfig)
    : conditionalFromPlan ?? style.deFeatures?.conditionalRules;
  const markLinesFromPlan = options.__markLines as ReturnType<typeof readChartMarkLines>;
  const markLines = chartConfig
    ? readChartMarkLines(chartConfig)
    : markLinesFromPlan ?? style.deFeatures?.markLines;

  return {
    colors,
    theme: getAntvThemeTokens(isDark ? "dark" : style.scheme),
    showLabel: style.showLabel,
    showTooltip: style.showTooltip,
    showLegend: !style.shellLegend && style.deStyle.legend?.show !== false,
    valueFormat: style.valueFormat,
    labelContent: style.labelContent ?? resolveDataLabelContentFromDeStyle(style.deStyle.label),
    conditionalRules,
    markLines,
    ...buildD3PresentationProps(style),
  };
}
