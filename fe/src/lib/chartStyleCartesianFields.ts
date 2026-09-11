import type { ChartType } from "@/lib/chartViewConfig";

/** 按 chartType 解析 cartesianShape 字段子集 */
export function resolveCartesianShapeFields(chartType: ChartType): string[] | undefined {
  if (
    chartType === "bar" ||
    chartType.startsWith("bar-") ||
    chartType.startsWith("percentage-bar") ||
    chartType.startsWith("chart-mix")
  ) {
    if (chartType === "waterfall") return ["barRadius"];
    if (chartType === "bar-range" || chartType === "progress-bar" || chartType === "bullet-graph") {
      return ["barWidthRatio", "barRadius"];
    }
    return ["barWidthRatio", "barRadius"];
  }
  if (chartType === "line" || chartType.startsWith("area")) {
    return ["lineSmooth", "lineWidth", "pointSize", "areaOpacity"];
  }
  if (chartType === "scatter" || chartType === "quadrant" || chartType === "multi-scatter") {
    return ["pointSize"];
  }
  return undefined;
}

export function chartTypeHasTooltipSection(chartType: ChartType): boolean {
  if (chartType.startsWith("table")) return false;
  if (chartType === "t-heatmap" || chartType === "kpi") return false;
  if (chartType === "gis-map") return false;
  return true;
}

function isHorizontalCategoryChart(chartType: ChartType): boolean {
  return (
    chartType === "bar-horizontal" ||
    chartType === "bar-stack-horizontal" ||
    chartType === "percentage-bar-stack-horizontal" ||
    chartType === "bar-range" ||
    chartType === "bullet-graph" ||
    chartType === "progress-bar" ||
    chartType === "bidirectional-bar"
  );
}

/** 样式面板「标签方向」应出现在哪些类目轴侧 */
export function resolveCategoryLabelAxisSides(chartType: ChartType): Array<"x" | "y"> {
  if (chartType === "heatmap") return ["x", "y"];
  if (chartType === "scatter" || chartType === "quadrant" || chartType === "multi-scatter") {
    return [];
  }
  if (isHorizontalCategoryChart(chartType)) return ["y"];
  return ["x"];
}
