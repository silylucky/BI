import type { ChartType } from "@/lib/chartViewConfig";
import type { ChartDeStyle } from "@/lib/chartDeStyle";
import {
  DEFAULT_PIE_INNER_RADIUS_PERCENT,
  DEFAULT_PIE_MERGE_TOP_N,
  DEFAULT_PIE_OUTER_RADIUS_PERCENT,
} from "@/lib/chartDeStyleBlocks";

export function isPieChartType(type: ChartType): boolean {
  return type === "pie" || type.startsWith("pie-");
}

export function isPieDonutChartType(type: ChartType): boolean {
  return type === "pie-donut" || type === "pie-donut-rose";
}

export function shouldApplyPieInnerRadius(
  chartType?: ChartType,
  styleVariant?: string,
): boolean {
  if (!chartType) return false;
  if (isPieDonutChartType(chartType)) return true;
  return chartType === "pie" && styleVariant === "donut";
}

export function isPieRoseOnlyChartType(
  chartType?: ChartType,
  styleVariant?: string,
): boolean {
  if (chartType === "pie-rose") return true;
  return chartType === "pie" && styleVariant === "rose";
}

/**
 * 新建饼图族时的默认 deStyle（对标 DataEase 饼图：合并 Top N、外置标签、底部图例）。
 * 数值 fallback 见各 `DEFAULT_PIE_*` 常量；此处写入显式字段以便面板与渲染一致。
 */
export const DEFAULT_PIE_CHART_DE_STYLE: Pick<ChartDeStyle, "pie" | "label"> = {
  pie: {
    mergeOthers: true,
    topN: DEFAULT_PIE_MERGE_TOP_N,
    outerRadiusPercent: DEFAULT_PIE_OUTER_RADIUS_PERCENT,
    padAngle: 0,
  },
  label: {
    show: true,
    position: "outside",
    showDimension: true,
    showIndicator: true,
    showPercent: true,
    percentDecimals: 2,
    thousandSeparator: true,
  },
};

export function buildDefaultPieDeStyle(type: ChartType): Pick<ChartDeStyle, "pie" | "label"> {
  const isDonut = isPieDonutChartType(type);
  if (!isDonut) return DEFAULT_PIE_CHART_DE_STYLE;
  return {
    ...DEFAULT_PIE_CHART_DE_STYLE,
    pie: {
      ...DEFAULT_PIE_CHART_DE_STYLE.pie,
      innerRadiusPercent: DEFAULT_PIE_INNER_RADIUS_PERCENT,
    },
  };
}
