import type { ChartViewConfig } from "@/lib/chartViewConfig";

/** E2E / 口语别名 → catalog chartType */
const DEV_CHART_TYPE_ALIASES: Record<string, ChartViewConfig["chartType"]> = {
  column: "bar",
};

export function resolveDevChartType(raw: string | null): ChartViewConfig["chartType"] | null {
  if (!raw?.trim()) return null;
  const key = raw.trim();
  return (DEV_CHART_TYPE_ALIASES[key] ?? key) as ChartViewConfig["chartType"];
}
