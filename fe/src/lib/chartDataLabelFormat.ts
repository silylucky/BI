import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartLabelStyle } from "@/lib/chartDeStyle";
import { formatChartValue, mergePercentValueFormat } from "@/lib/chartValueFormat";

export type DataLabelContentOptions = {
  showDimension?: boolean;
  showIndicator?: boolean;
  showPercent?: boolean;
  percentDecimals?: number;
};

export function resolveDataLabelContentFromDeStyle(
  label: ChartLabelStyle | undefined,
): DataLabelContentOptions {
  return {
    showDimension: label?.showDimension === true,
    showIndicator: label?.showIndicator !== false,
    showPercent: label?.showPercent === true,
    percentDecimals: label?.percentDecimals ?? label?.ratioDecimals ?? 2,
  };
}

export function resolveDataLabelContentFromOptions(
  options: Record<string, unknown>,
): DataLabelContentOptions {
  return {
    showDimension: options.__labelShowDimension === true,
    showIndicator: options.__labelShowIndicator !== false,
    showPercent: options.__labelShowPercent === true,
    percentDecimals: Number(options.__labelPercentDecimals ?? 2),
  };
}

/** 对标 DataEase：维度 指标 (占比%) */
export function formatDataLabelText(
  dimension: string,
  indicator: unknown,
  total: number,
  opts: DataLabelContentOptions,
  valueFormat: NumberFormatConfig | undefined,
  isPercentChart = false,
): string {
  const showDimension = opts.showDimension === true;
  const showIndicator = opts.showIndicator !== false;
  const showPercent = opts.showPercent === true;

  let indicatorText = "";
  if (showIndicator) {
    const fmt =
      isPercentChart && !showPercent
        ? mergePercentValueFormat(valueFormat, true)
        : valueFormat;
    indicatorText = formatChartValue(indicator, fmt);
  }

  let percentText = "";
  if (showPercent) {
    const n = Number(indicator ?? 0);
    const pct = isPercentChart ? n * 100 : total > 0 ? (n / total) * 100 : 0;
    percentText = `${pct.toFixed(opts.percentDecimals ?? 2)}%`;
  }

  let text = showDimension ? dimension.trim() : "";
  if (indicatorText) text = text ? `${text} ${indicatorText}` : indicatorText;
  if (percentText) text = text ? `${text} (${percentText})` : percentText;
  return text;
}

/** 多维标签分行：维度 / 指标 / 占比各占一行（对标饼图内标签） */
export function formatDataLabelLines(
  dimension: string,
  indicator: unknown,
  total: number,
  opts: DataLabelContentOptions,
  valueFormat: NumberFormatConfig | undefined,
  isPercentChart = false,
): string[] {
  const showDimension = opts.showDimension === true;
  const showIndicator = opts.showIndicator !== false;
  const showPercent = opts.showPercent === true;

  const lines: string[] = [];
  if (showDimension && dimension.trim()) lines.push(dimension.trim());

  if (showIndicator) {
    const fmt =
      isPercentChart && !showPercent
        ? mergePercentValueFormat(valueFormat, true)
        : valueFormat;
    const indicatorText = formatChartValue(indicator, fmt);
    if (indicatorText) lines.push(indicatorText);
  }

  if (showPercent) {
    const n = Number(indicator ?? 0);
    const pct = isPercentChart ? n * 100 : total > 0 ? (n / total) * 100 : 0;
    lines.push(`${pct.toFixed(opts.percentDecimals ?? 2)}%`);
  }

  return lines;
}
