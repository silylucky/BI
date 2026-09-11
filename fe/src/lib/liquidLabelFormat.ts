import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { ChartLabelStyle } from "@/lib/chartDeStyle";

/** 水波图「指标」行格式：与「占比」分离，禁止 percent（占比专用） */
export function resolveLiquidMetricFormat(
  label: ChartLabelStyle | undefined,
  dashboardFormat?: NumberFormatConfig,
): NumberFormatConfig {
  const legacyType = label?.metricFormatType ?? label?.formatType ?? dashboardFormat?.type ?? "auto";
  const type = legacyType === "percent" ? "auto" : legacyType;
  return {
    type,
    decimals: label?.metricDecimals ?? label?.decimals ?? dashboardFormat?.decimals ?? 0,
    unit: label?.metricUnit ?? label?.unit ?? dashboardFormat?.unit,
    thousandSeparator:
      label?.metricThousandSeparator ??
      label?.thousandSeparator ??
      dashboardFormat?.thousandSeparator ??
      true,
  };
}

export function resolveLiquidRatioFormat(
  label: ChartLabelStyle | undefined,
  metricFormat?: NumberFormatConfig,
): NumberFormatConfig {
  return {
    type: "percent",
    decimals: label?.ratioDecimals ?? 0,
    thousandSeparator: metricFormat?.thousandSeparator,
  };
}
