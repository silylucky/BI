import * as d3 from "d3";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  formatDataLabelText,
  formatDataLabelLines,
  type DataLabelContentOptions,
} from "@/lib/chartDataLabelFormat";
import type { D3CartesianDatum } from "@/components/charts/engine/d3/types";

export function sumCartesianLabelTotal(data: D3CartesianDatum[]): number {
  return d3.sum(data, (d) => Number(d.__value__) || 0);
}

export function formatSimpleDataLabel(
  dimension: string,
  indicator: unknown,
  total: number,
  labelContent?: DataLabelContentOptions,
  valueFormat?: NumberFormatConfig,
  isPercentChart = false,
): string {
  return formatDataLabelText(
    dimension,
    indicator,
    total,
    labelContent ?? { showIndicator: true },
    valueFormat,
    isPercentChart,
  );
}

export function formatSimpleDataLabelLines(
  dimension: string,
  indicator: unknown,
  total: number,
  labelContent?: DataLabelContentOptions,
  valueFormat?: NumberFormatConfig,
  isPercentChart = false,
): string[] {
  return formatDataLabelLines(
    dimension,
    indicator,
    total,
    labelContent ?? { showIndicator: true },
    valueFormat,
    isPercentChart,
  );
}

export function formatCartesianDatumLabel(
  d: D3CartesianDatum,
  opts: {
    hasMultiSeries: boolean;
    labelContent?: DataLabelContentOptions;
    valueFormat?: NumberFormatConfig;
    isPercent?: boolean;
    total?: number;
  },
): string {
  const content = opts.labelContent ?? { showIndicator: true };
  const dimension = opts.hasMultiSeries
    ? String(d.__series__ ?? "")
    : String(d.__category__ ?? "");
  const total = opts.total ?? sumCartesianLabelTotal([d]);
  return formatDataLabelText(
    dimension,
    d.__value__,
    total,
    content,
    opts.valueFormat,
    opts.isPercent,
  );
}
