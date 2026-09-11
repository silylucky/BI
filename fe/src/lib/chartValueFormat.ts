import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import { formatMetricValue } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartLabelStyle } from "@/lib/chartDeStyle";
import { resolveLiquidMetricFormat } from "@/lib/liquidLabelFormat";

/** 组件 deStyle.label 优先于看板 numberFormat；水波图指标行走 resolveLiquidMetricFormat */
export function resolveChartValueFormat(
  deLabel: ChartLabelStyle | undefined,
  dashboardFormat: NumberFormatConfig | undefined,
  chartType?: string,
): NumberFormatConfig {
  if (chartType === "liquid") {
    return resolveLiquidMetricFormat(deLabel, dashboardFormat);
  }
  if (!deLabel?.formatType && deLabel?.thousandSeparator === undefined && deLabel?.decimals == null && !deLabel?.unit && !deLabel?.metricUnit && !dashboardFormat) {
    return { type: "auto", thousandSeparator: true };
  }
  return {
    type: deLabel?.formatType ?? dashboardFormat?.type ?? "auto",
    decimals: deLabel?.metricDecimals ?? deLabel?.decimals ?? dashboardFormat?.decimals,
    unit: deLabel?.metricUnit ?? deLabel?.unit ?? dashboardFormat?.unit,
    thousandSeparator:
      deLabel?.metricThousandSeparator ??
      deLabel?.thousandSeparator ??
      dashboardFormat?.thousandSeparator,
  };
}

export function formatChartValue(
  raw: unknown,
  format: NumberFormatConfig | undefined,
): string {
  return formatMetricValue(raw, format);
}

/** 百分比堆叠/柱图：Y 轴或 X 轴刻度强制 percent 格式 */
export function mergePercentValueFormat(
  format: NumberFormatConfig | undefined,
  isPercent: boolean,
): NumberFormatConfig | undefined {
  if (!isPercent) return format;
  return {
    ...format,
    type: "percent",
    decimals: format?.decimals ?? 0,
  };
}

export function echartsTooltipValueFormatter(format: NumberFormatConfig | undefined) {
  return (params: unknown) => {
    if (params == null) return "";
    if (typeof params === "object" && params !== null && "value" in params) {
      const v = (params as { value: unknown }).value;
      if (Array.isArray(v)) return formatChartValue(v[v.length - 1], format);
      return formatChartValue(v, format);
    }
    return formatChartValue(params, format);
  };
}

export function isNumericCell(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && String(value).trim() !== "";
}

export function formatTableCellValue(
  raw: unknown,
  format: NumberFormatConfig | undefined,
): string {
  if (!isNumericCell(raw)) return String(raw ?? "");
  return formatChartValue(raw, format);
}
