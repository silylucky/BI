import { isKnownChartType } from "@/lib/chartRegistry";

/** 未知 chartType 降级为明细表（VIZ-003 / T-VIZ-R250-003） */
export function getFallbackChartType(type: string): string {
  return isKnownChartType(type) ? type : "table-info";
}
