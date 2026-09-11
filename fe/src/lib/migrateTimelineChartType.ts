import type { ChartViewConfig } from "@/lib/chartViewConfig";

/** 将存量 timeline 图表迁移为 line（保留 encoding / styleVariant） */
export function migrateTimelineChartConfig<T extends ChartViewConfig>(config: T): T {
  if (config.chartType !== "timeline") return config;
  return {
    ...config,
    chartType: "line",
    styleVariant: config.styleVariant && config.styleVariant !== "default"
      ? config.styleVariant
      : "smooth",
  };
}

/** 递归迁移 layoutJson 内 widget chartConfig */
export function migrateLayoutTimelineCharts(layoutJson: unknown): unknown {
  if (!layoutJson || typeof layoutJson !== "object") return layoutJson;
  if (Array.isArray(layoutJson)) {
    return layoutJson.map(migrateLayoutTimelineCharts);
  }
  const obj = layoutJson as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "chartConfig" && value && typeof value === "object") {
      next[key] = migrateTimelineChartConfig(value as ChartViewConfig);
      continue;
    }
    if (key === "chartType" && value === "timeline") {
      next[key] = "line";
      continue;
    }
    next[key] = migrateLayoutTimelineCharts(value);
  }
  return next;
}
