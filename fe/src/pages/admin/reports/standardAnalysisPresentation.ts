import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { AnalysisTheme } from "./useStandardAnalysis";
import { humanizeColumnName } from "./standardAnalysisFieldLabels";

const INLINE_CHART_DS = "00000000-0000-4000-8000-000000000001";

export const SECTION_COLUMN_LABELS: Record<string, string> = {
  dim: "维度",
  cnt: "数量",
  d: "日期",
  status: "状态",
};

export type RenderSectionLike = {
  kind?: string;
  chartType?: string;
  columns: Array<{ name?: string; key?: string } | string>;
  rows: unknown[];
};

export function humanizeSectionHeader(header: string): string {
  return SECTION_COLUMN_LABELS[header] ?? header;
}

export function humanizeSectionHeaders(headers: string[]): string[] {
  return headers.map(humanizeSectionHeader);
}

export function isChartSection(section: RenderSectionLike | undefined): section is RenderSectionLike & {
  kind: "chart";
  chartType: "bar" | "line";
} {
  return (
    section?.kind === "chart" &&
    (section.chartType === "bar" || section.chartType === "line")
  );
}

export function defaultLivePresentationMode(section: RenderSectionLike | undefined): "chart" | "table" {
  return isChartSection(section) ? "chart" : "table";
}

export function resolveSectionChartType(chartType: string): ChartViewConfig["chartType"] {
  if (chartType === "bar") return "bar-horizontal";
  if (chartType === "line") return "line";
  return "bar-horizontal";
}

export function buildStandardSectionChartConfig(
  headers: string[],
  chartType: "bar" | "line",
  theme?: AnalysisTheme,
): ChartViewConfig {
  const [dimensionField, metricField] = headers;
  const resolvedChartType = resolveSectionChartType(chartType);
  const isTrend = theme === "trend";
  const isTimeSeries = theme === "activity" || isTrend;
  // 聚合列 dim/d 与表格 humanizeSectionHeaders 一致；勿用 fieldMapping 物理列名作轴标题
  const dimensionLabel = dimensionField ? humanizeSectionHeader(dimensionField) : undefined;
  const metricLabel = metricField
    ? isTrend
      ? "累计数量"
      : humanizeSectionHeader(metricField)
    : "数量";

  return {
    chartType: resolvedChartType,
    styleVariant: isTrend ? "area" : undefined,
    dataSourceId: INLINE_CHART_DS,
    mode: "sql",
    sql: "SELECT 1",
    dimensions: dimensionField
      ? [{ field: dimensionField, label: dimensionLabel ?? humanizeColumnName(dimensionField) }]
      : [],
    metrics: metricField ? [{ field: metricField, label: metricLabel }] : [],
    nativeBody:
      resolvedChartType === "line" && isTimeSeries
        ? {
            deStyle: {
              cartesian: {
                lineSmooth: false,
                areaOpacity: isTrend ? 0.22 : 0.12,
                lineWidth: 2,
                pointSize: isTrend ? 0 : 3,
              },
            },
          }
        : undefined,
  };
}

const EPOCH_DATE_MARKERS = new Set(["1970-01-01", "1970-01-01 00:00:00"]);

export function isTimeSeriesTheme(theme: AnalysisTheme): boolean {
  return theme === "activity" || theme === "trend";
}

/** 活跃度/趋势：单点或 1970 日期通常表示时间字段映射错误 */
export function detectSuspiciousTimeSeries(
  theme: AnalysisTheme,
  headers: string[],
  rows: unknown[][],
): string | null {
  if (!isTimeSeriesTheme(theme) || rows.length === 0) return null;

  const dateIdx = headers.findIndex((header) => header === "d" || header === "date");
  if (dateIdx < 0) return null;

  const dates = rows
    .map((row) => String(row[dateIdx] ?? "").trim())
    .filter((value) => value.length > 0);
  if (dates.length === 0) return null;

  const uniqueDates = new Set(dates);
  const allEpoch = dates.every((date) => EPOCH_DATE_MARKERS.has(date.slice(0, 10)));
  const singleEpochPoint = uniqueDates.size === 1 && allEpoch;

  if (singleEpochPoint) {
    return "时间轴出现 1970-01-01，通常表示「时间字段」绑到了数值列，或当前数据集根本没有日期列。请到配置页修正映射，或换用含 sale_date / created_at 的数据集。";
  }

  if (uniqueDates.size === 1 && rows.length >= 5) {
    return `全部 ${rows.length} 条记录被聚合成同一日期（${dates[0]}），请检查时间字段是否映射正确。`;
  }

  return null;
}

export function livePresentationAriaLabel(theme: AnalysisTheme): string {
  switch (theme) {
    case "distribution":
      return "区域分布图表";
    case "activity":
      return "活跃度趋势图表";
    case "trend":
      return "趋势图表";
    default:
      return "标准分析图表";
  }
}
