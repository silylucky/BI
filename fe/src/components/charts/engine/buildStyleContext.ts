import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { DashboardStyleConfig, NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  readChartDeStyle,
  readChartDataZoom,
  readChartDepthVisual,
  readChartPaletteOpacity,
  readChartSeriesGradient,
  readChartShowLabel,
  readChartTooltipShow,
  resolveChartLabelPresentation,
  resolveChartTooltipPresentation,
  resolveEffectivePaletteId,
} from "@/lib/chartDeStyle";
import { readChartDeFeatures } from "@/lib/chartDeFeatures";
import { resolveChartValueFormat } from "@/lib/chartValueFormat";
import { resolveDataLabelContentFromDeStyle } from "@/lib/chartDataLabelFormat";
import type { ChartStyleContext } from "@/components/charts/engine/types";
import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";

type BuildStyleContextInput = {
  config: ChartViewConfig;
  scheme: ColorScheme;
  chartColors: string[];
  dashboardDefaults?: Pick<
    DashboardStyleConfig,
    | "chartLabelShow"
    | "seriesGradient"
    | "depthVisual"
    | "tooltipShow"
    | "chartLabelStyle"
    | "chartTooltipStyle"
    | "surfaceKind"
    | "tableColorStyle"
  >;
  shellLegend?: boolean;
  embedEdit?: boolean;
  numberFormat?: NumberFormatConfig;
  widgetShellBg?: string;
  /** 组件壳层不透明度 0–1，表格 chrome 与透明底对齐 */
  widgetShellOpacity?: number;
  dashboardPaletteId?: string;
};

export function buildStyleContext(input: BuildStyleContextInput): ChartStyleContext {
  const { config, scheme, chartColors, dashboardDefaults, shellLegend = false, embedEdit = false } =
    input;
  const deStyle = readChartDeStyle(config);
  const showLabel = readChartShowLabel(config, dashboardDefaults);
  const showTooltip = readChartTooltipShow(config, dashboardDefaults);
  const seriesGradient = readChartSeriesGradient(config, dashboardDefaults);
  const depthVisual = readChartDepthVisual(config, dashboardDefaults);
  const dataZoom = readChartDataZoom(config);
  const valueFormat = resolveChartValueFormat(deStyle.label, input.numberFormat, config.chartType);
  const paletteOpacity = readChartPaletteOpacity(config, dashboardDefaults);

  return {
    scheme,
    deStyle,
    deFeatures: readChartDeFeatures(config),
    effectivePaletteId: resolveEffectivePaletteId(config, input.dashboardPaletteId),
    paletteOpacity,
    chartColors,
    dataScreenSurface: dashboardDefaults?.surfaceKind === "data-screen",
    showLabel,
    showTooltip,
    seriesGradient,
    depthVisual,
    dataZoom,
    valueFormat,
    labelContent: resolveDataLabelContentFromDeStyle(deStyle.label),
    labelPresentation: resolveChartLabelPresentation(config, dashboardDefaults),
    tooltipPresentation: resolveChartTooltipPresentation(config, dashboardDefaults),
    shellLegend,
    embedEdit,
    widgetShellBg: input.widgetShellBg,
    widgetShellOpacity: input.widgetShellOpacity,
    tableColorStyle: dashboardDefaults?.tableColorStyle,
  };
}
