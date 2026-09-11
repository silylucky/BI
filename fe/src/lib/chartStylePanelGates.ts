import type { ChartType } from "@/lib/chartViewConfig";
import {
  chartInspectorCapabilities,
  supportsEmbeddedShellLegend,
} from "@/lib/chartInspectorCapabilities";
import type { ChartStyleSectionId } from "@/lib/chartStyleSectionRegistry";
import { resolveD3InspectorFeatureMatrix } from "@/components/charts/engine/d3/inspectorCapabilityMatrix";

const DEPTH_VISUAL_CHART_TYPES = new Set<ChartType>([
  "line",
  "area",
  "area-stack",
  "timeline",
  "scatter",
  "combo",
  "chart-mix-dual-line",
  "pie",
  "pie-donut",
  "pie-rose",
  "pie-donut-rose",
  "bar",
  "bar-stack",
  "percentage-bar-stack",
  "bar-group",
  "bar-group-stack",
  "bar-horizontal",
  "bar-stack-horizontal",
  "percentage-bar-stack-horizontal",
  "chart-mix",
  "chart-mix-group",
  "chart-mix-stack",
  "heatmap",
  "gauge",
  "stock-line",
  "funnel",
]);

/** D3 renderer 实测消费 seriesGradient 的类型（renderBar/Area/Line/DualAxes 族） */
const SERIES_GRADIENT_CHART_TYPES = new Set<ChartType>([
  "line",
  "area",
  "area-stack",
  "timeline",
  "bar",
  "bar-stack",
  "percentage-bar-stack",
  "bar-group",
  "bar-group-stack",
  "bar-horizontal",
  "bar-stack-horizontal",
  "percentage-bar-stack-horizontal",
  "combo",
  "chart-mix",
  "chart-mix-group",
  "chart-mix-stack",
  "chart-mix-dual-line",
]);

export type LegendEditorMode = "shell" | "d3" | "none";

export function supportsDepthVisualToggle(chartType: ChartType): boolean {
  return DEPTH_VISUAL_CHART_TYPES.has(chartType);
}

/** paletteOpacity：2D 地图 + 饼图系列填充 */
const PALETTE_OPACITY_CHART_TYPES = new Set<ChartType>([
  "map",
  "pie",
  "pie-donut",
  "pie-rose",
  "pie-donut-rose",
]);

export function supportsPaletteOpacity(chartType: ChartType): boolean {
  return PALETTE_OPACITY_CHART_TYPES.has(chartType);
}

export function supportsSeriesGradientToggle(chartType: ChartType): boolean {
  return SERIES_GRADIENT_CHART_TYPES.has(chartType);
}

export function listSeriesGradientChartTypes(): ChartType[] {
  return [...SERIES_GRADIENT_CHART_TYPES];
}

export function resolveLegendEditorMode(chartType: ChartType): LegendEditorMode {
  const caps = chartInspectorCapabilities(chartType);
  if (!caps.legend) return "none";
  if (supportsEmbeddedShellLegend(chartType)) return "shell";
  return "d3";
}

/** 按图表能力过滤样式 Tab 分区，避免展示不可用的配置项 */
export function filterStyleSectionsForChart(
  chartType: ChartType,
  sections: ChartStyleSectionId[],
): ChartStyleSectionId[] {
  const caps = chartInspectorCapabilities(chartType);
  const d3Matrix = resolveD3InspectorFeatureMatrix(chartType);
  return sections.filter((id) => {
    if (id === "legend") {
      if (d3Matrix?.legend === "missing") return false;
      return caps.legend;
    }
    if (id === "label") return caps.label || caps.labelFormat;
    if (id === "remark") return caps.remark;
    return true;
  });
}
