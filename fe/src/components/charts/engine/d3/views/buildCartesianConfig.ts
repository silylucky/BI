import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";
import type { D3CartesianRenderConfig, D3CartesianDatum } from "@/components/charts/engine/d3/types";
import { buildD3PresentationProps } from "@/components/charts/engine/d3/core/presentation";
import { scaleD3PresentationProps, type ChartPresentationPaintContext } from "@/components/charts/engine/d3/core/chartPresentationScale";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import { readChartConditionalRules, readChartMarkLines } from "@/lib/chartDeFeatures";
import { resolveD3ChartColors } from "@/components/charts/engine/d3/views/resolveD3ChartColors";

export function extractDrillValue(datum: D3CartesianDatum, xField: string): string {
  const value = datum[xField] ?? datum.__category__;
  return value != null && String(value) !== "" ? String(value) : "";
}

export function buildCartesianRenderConfig(
  props: ChartEngineViewProps,
  plan: ChartRenderPlan,
  chartWidth: number,
  chartHeight: number,
  paintContext?: { visualScale?: number; renderTier?: Geo3dRenderTier },
): D3CartesianRenderConfig | null {
  if (plan.kind !== "d3" || plan.empty) return null;
  const { style, chartConfig, onInteraction, isDark } = props;
  const options = plan.options;

  const xField = String(options.xField ?? "__category__");
  const yField = String(options.yField ?? "__value__");
  const seriesField = options.seriesField ? String(options.seriesField) : undefined;
  const data = (options.data as D3CartesianDatum[]) ?? [];
  const colors = resolveD3ChartColors(style, plan, chartConfig);

  const conditionalFromPlan = options.__conditionalRules as D3CartesianRenderConfig["conditionalRules"];
  const markLinesFromPlan = options.__markLines as D3CartesianRenderConfig["markLines"];

  return {
    width: Math.max(0, chartWidth),
    height: Math.max(0, chartHeight),
    data,
    xField,
    yField,
    seriesField,
    smooth: Boolean(options.smooth),
    isHorizontal: Boolean(options.isHorizontal),
    isStack: Boolean(options.isStack),
    isGroup: Boolean(options.isGroup),
    isPercent: Boolean(options.isPercent),
    area: options.area as boolean | Record<string, unknown> | undefined,
    colors,
    theme: getAntvThemeTokens(isDark ? "dark" : style.scheme),
    showLabel: style.showLabel,
    showTooltip: style.showTooltip,
    showLegend: !style.shellLegend && style.deStyle.legend?.show !== false && Boolean(seriesField),
    valueFormat: style.valueFormat,
    labelContent: style.labelContent,
    ...scaleD3PresentationProps(buildD3PresentationProps(style), {
      chartWidth,
      chartHeight,
      visualScale: paintContext?.visualScale,
      renderTier: paintContext?.renderTier,
    }),
    barWidthRatio: options.__barWidthRatio as number | undefined,
    barRadius: options.__barRadius as number | undefined,
    lineWidth: options.__lineWidth as number | undefined,
    pointSize: options.__pointSize as number | undefined,
    areaOpacity: options.__areaOpacity as number | undefined,
    axisStyle: options.__axisStyle as D3CartesianRenderConfig["axisStyle"],
    categoryLevelCount: options.categoryLevelCount as number | undefined,
    defaultSeriesName: options.defaultSeriesName ? String(options.defaultSeriesName) : undefined,
    markLines: chartConfig ? readChartMarkLines(chartConfig) : markLinesFromPlan ?? style.deFeatures?.markLines,
    conditionalRules:
      chartConfig ? readChartConditionalRules(chartConfig) : conditionalFromPlan ?? style.deFeatures?.conditionalRules,
    dataZoom: Boolean(options.__dataZoom),
    onPointClick: onInteraction
      ? (datum) => {
          const value = extractDrillValue(datum, xField);
          if (value) onInteraction({ kind: "drill", value, label: value });
        }
      : undefined,
  };
}

export function d3CartesianTestId(chartType: string, plotType: string): string {
  if (chartType === "line" || plotType === "Line") return "d3-line-chart";
  if (chartType.startsWith("area")) return "d3-area-chart";
  return "d3-bar-chart";
}
