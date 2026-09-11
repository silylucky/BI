import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { pickChartNativeBodyUi } from "@/lib/chartNativeBodyUi";
import { remapLegacySqlFieldsInChartConfig } from "@/lib/legacySqlFieldAliases";
import { migrateTimelineChartConfig } from "@/lib/migrateTimelineChartType";

type StyleMigration = {
  match: (cfg: ChartViewConfig) => boolean;
  nextType: string;
  nextVariant?: string;
};

const STYLE_VARIANT_MIGRATIONS: StyleMigration[] = [
  { match: (c) => c.chartType === "bar" && c.styleVariant === "stacked", nextType: "bar-stack" },
  { match: (c) => c.chartType === "bar" && c.styleVariant === "grouped", nextType: "bar-group" },
  { match: (c) => c.chartType === "bar" && c.styleVariant === "horizontal", nextType: "bar-horizontal" },
  { match: (c) => c.chartType === "pie" && c.styleVariant === "donut", nextType: "pie-donut" },
  { match: (c) => c.chartType === "pie" && c.styleVariant === "rose", nextType: "pie-rose" },
  { match: (c) => c.chartType === "line" && c.styleVariant === "area", nextType: "area" },
  { match: (c) => c.chartType === "line" && c.styleVariant === "stacked", nextType: "area-stack" },
];

const TYPE_MIGRATIONS: Record<string, string> = {
  table: "table-info",
  combo: "chart-mix",
  heatmap: "t-heatmap",
  wordCloud: "word-cloud",
};

/** 将存量 chartType / styleVariant 迁移为 DE 独立 type */
export function migrateChartViewConfig<T extends ChartViewConfig>(config: T): T {
  let next = migrateTimelineChartConfig(config) as T;

  const directTarget = TYPE_MIGRATIONS[next.chartType];
  if (directTarget) {
    next = { ...next, chartType: directTarget as T["chartType"], styleVariant: "default" };
  }

  for (const rule of STYLE_VARIANT_MIGRATIONS) {
    if (!rule.match(next)) continue;
    next = {
      ...next,
      chartType: rule.nextType as T["chartType"],
      styleVariant: rule.nextVariant ?? "default",
    };
    break;
  }

  next = remapLegacySqlFieldsInChartConfig({
    ...next,
    mode: "dataset",
    bindingId: undefined,
    sql: undefined,
    schema: undefined,
    table: undefined,
    index: undefined,
    nativeBody: pickChartNativeBodyUi(next.nativeBody),
  });

  return next;
}

/** 递归迁移 layoutJson 内 widget chartConfig */
export function migrateLayoutChartTypes(layoutJson: unknown): unknown {
  if (!layoutJson || typeof layoutJson !== "object") return layoutJson;
  if (Array.isArray(layoutJson)) {
    return layoutJson.map(migrateLayoutChartTypes);
  }
  const obj = layoutJson as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "chartConfig" && value && typeof value === "object") {
      next[key] = migrateChartViewConfig(value as ChartViewConfig);
      continue;
    }
    next[key] = migrateLayoutChartTypes(value);
  }
  return next;
}
