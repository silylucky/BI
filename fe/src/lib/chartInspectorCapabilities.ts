import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  isGeoMapChartType,
  isKpiType,
  isLineOrBarType,
} from "@/lib/chartViewConfig";
import { resolveEngineCapabilities } from "@/components/charts/engine/capabilities";
import { isD3FeaturePartial } from "@/components/charts/engine/d3/inspectorCapabilityMatrix";
import { tableInspectorProfile } from "@/lib/chartTableInspector";

export type ChartInspectorCapabilities = {
  legend: boolean;
  label: boolean;
  dataZoom: boolean;
  styleVariant: boolean;
  labelFormat: boolean;
  background: boolean;
  border: boolean;
  remark: boolean;
  markLines: boolean;
  conditional: boolean;
  timeRange: boolean;
  /** D3 矩阵标 partial：能力可用但仅部分系列/场景生效 */
  legendPartial: boolean;
  conditionalPartial: boolean;
};

const NO_PARTIAL = { legendPartial: false, conditionalPartial: false } as const;

export function chartInspectorCapabilities(
  chartType: ChartViewConfig["chartType"],
): ChartInspectorCapabilities {
  const engineCaps = resolveEngineCapabilities(chartType);
  const base = {
    background: true,
    border: true,
    remark: true,
  };

  const tableProfile = tableInspectorProfile(chartType);
  if (tableProfile) {
    return {
      ...base,
      legend: false,
      label: false,
      dataZoom: false,
      styleVariant: false,
      labelFormat: false,
      remark: false,
      markLines: false,
      conditional: tableProfile.advancedConditional,
      timeRange: tableProfile.advancedTimeRange,
      ...NO_PARTIAL,
    };
  }

  if (isKpiType(chartType)) {
    return {
      ...base,
      legend: false,
      label: false,
      dataZoom: false,
      styleVariant: false,
      labelFormat: true,
      remark: false,
      markLines: false,
      conditional: false,
      timeRange: false,
      ...NO_PARTIAL,
    };
  }

  const labelFormat =
    isGeoMapChartType(chartType) ||
    isLineOrBarType(chartType) ||
    chartType === "gauge" ||
    chartType === "scatter" ||
    chartType === "multi-scatter" ||
    chartType === "quadrant" ||
    chartType === "waterfall" ||
    chartType === "funnel" ||
    chartType === "graph" ||
    chartType === "radar" ||
    chartType === "treemap" ||
    chartType === "circle-packing" ||
    chartType === "bar-range" ||
    chartType === "bidirectional-bar" ||
    chartType === "progress-bar" ||
    chartType === "stock-line" ||
    chartType === "bullet-graph";

  return {
    ...base,
    legend: engineCaps.legend,
    label: engineCaps.label,
    dataZoom: engineCaps.dataZoom,
    styleVariant: engineCaps.styleVariant,
    labelFormat,
    markLines: engineCaps.markLines,
    conditional: engineCaps.conditional,
    timeRange: !isGeoMapChartType(chartType) && !isKpiType(chartType),
    legendPartial: isD3FeaturePartial(chartType, "legend"),
    conditionalPartial: isD3FeaturePartial(chartType, "conditional"),
  };
}

/** 嵌入看板/大屏不走 React 壳层图例的类型（地图色带、关系图节点等仍用图表内渲染） */
const EMBEDDED_SHELL_LEGEND_BLOCKLIST = new Set<ChartViewConfig["chartType"]>([
  "map",
  "map-3d",
  "heatmap",
  "t-heatmap",
  "gauge",
  "liquid",
  "sankey",
  "graph",
]);

export function supportsEmbeddedShellLegend(chartType: ChartViewConfig["chartType"]): boolean {
  if (EMBEDDED_SHELL_LEGEND_BLOCKLIST.has(chartType)) return false;
  return chartInspectorCapabilities(chartType).legend;
}

/** 高级 Tab 是否至少有一项可配置能力 */
export function chartHasAdvancedTab(chartType: ChartViewConfig["chartType"]): boolean {
  const caps = chartInspectorCapabilities(chartType);
  return (
    caps.dataZoom ||
    caps.timeRange ||
    caps.markLines ||
    caps.conditional ||
    chartType === "map" ||
    chartType === "map-3d"
  );
}
