import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { BACKEND_CATALOG_FIELD_RULES } from "@/components/charts/chartCatalogBackendFieldRules";
import { deriveFieldRuleFromDeCatalog, type ChartAxesConfig, type DeAxisId } from "@/lib/chartDeAxis";
import { getCachedCatalog, type ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { migrateChartConfigToDeAxes, syncLegacyFieldsFromAxes } from "@/lib/resolveChartEncoding";

export type ChartFieldRule = {
  minDimensions: number;
  maxDimensions: number;
  minMetrics: number;
  maxMetrics: number;
  note?: string;
};

/** 与 backend/app/viz/builtin.py FieldRule 对齐（catalog 未加载时的兜底） */
const FALLBACK_FIELD_RULES: Record<string, ChartFieldRule> = {
  table: { minDimensions: 0, maxDimensions: 8, minMetrics: 0, maxMetrics: 8 },
  line: { minDimensions: 1, maxDimensions: 8, minMetrics: 1, maxMetrics: 8 },
  bar: { minDimensions: 1, maxDimensions: 8, minMetrics: 1, maxMetrics: 8 },
  pie: { minDimensions: 1, maxDimensions: 1, minMetrics: 1, maxMetrics: 1 },
  gauge: { minDimensions: 0, maxDimensions: 0, minMetrics: 1, maxMetrics: 1 },
  liquid: { minDimensions: 0, maxDimensions: 0, minMetrics: 1, maxMetrics: 1 },
  "table-normal": { minDimensions: 1, maxDimensions: 8, minMetrics: 1, maxMetrics: 8 },
  "table-pivot": { minDimensions: 1, maxDimensions: 8, minMetrics: 1, maxMetrics: 8 },
  "bar-range": { minDimensions: 1, maxDimensions: 1, minMetrics: 2, maxMetrics: 2 },
  "progress-bar": { minDimensions: 1, maxDimensions: 1, minMetrics: 2, maxMetrics: 2 },
  "bullet-graph": { minDimensions: 1, maxDimensions: 1, minMetrics: 2, maxMetrics: 3 },
  "stock-line": { minDimensions: 1, maxDimensions: 8, minMetrics: 4, maxMetrics: 4 },
  map: { minDimensions: 1, maxDimensions: 3, minMetrics: 1, maxMetrics: 1 },
  "gis-map": {
    minDimensions: 0,
    maxDimensions: 3,
    minMetrics: 0,
    maxMetrics: 1,
    note: "底图无需字段；可选经/纬散点或热力层（gisProject.layers[] · activeLayerId · 图层级 binding 覆写）",
  },
  heatmap: { minDimensions: 2, maxDimensions: 2, minMetrics: 1, maxMetrics: 1 },
  kpi: { minDimensions: 0, maxDimensions: 0, minMetrics: 1, maxMetrics: 1 },
  timeline: {
    minDimensions: 1,
    maxDimensions: 1,
    minMetrics: 0,
    maxMetrics: 4,
    note: "时间轴需 1 个时间维度，可选 0–4 个指标",
  },
  sankey: {
    minDimensions: 2,
    maxDimensions: 2,
    minMetrics: 1,
    maxMetrics: 1,
    note: "桑基图需 2 个维度（起始、终点）与 1 个指标",
  },
  funnel: {
    minDimensions: 1,
    maxDimensions: 1,
    minMetrics: 1,
    maxMetrics: 1,
    note: "漏斗图需 1 个维度与 1 个指标",
  },
  graph: {
    minDimensions: 2,
    maxDimensions: 2,
    minMetrics: 0,
    maxMetrics: 1,
    note: "关系图需 2 个维度（起点、终点）；网络拓扑适合网状关系，流向分层适合起点→终点",
  },
  "chart-mix": {
    minDimensions: 1,
    maxDimensions: 8,
    minMetrics: 1,
    maxMetrics: 8,
    note: "双轴图左柱或右线至少 1 个指标",
  },
  "chart-mix-group": {
    minDimensions: 1,
    maxDimensions: 8,
    minMetrics: 1,
    maxMetrics: 8,
  },
  "chart-mix-stack": {
    minDimensions: 1,
    maxDimensions: 8,
    minMetrics: 1,
    maxMetrics: 8,
  },
  "chart-mix-dual-line": {
    minDimensions: 1,
    maxDimensions: 8,
    minMetrics: 1,
    maxMetrics: 8,
  },
};

export function resolveChartFieldRule(chartType: string): ChartFieldRule {
  const fromCatalog = getCachedCatalog()?.find((c) => c.type === chartType)?.fieldRule;
  const fallback = FALLBACK_FIELD_RULES[chartType];
  const backendSnap = BACKEND_CATALOG_FIELD_RULES[chartType];
  const base: ChartFieldRule = {
    minDimensions: fromCatalog?.minDimensions ?? fallback?.minDimensions ?? backendSnap?.minDimensions ?? 0,
    maxDimensions: fromCatalog?.maxDimensions ?? fallback?.maxDimensions ?? backendSnap?.maxDimensions ?? 8,
    minMetrics: fromCatalog?.minMetrics ?? fallback?.minMetrics ?? backendSnap?.minMetrics ?? 0,
    maxMetrics: fromCatalog?.maxMetrics ?? fallback?.maxMetrics ?? backendSnap?.maxMetrics ?? 8,
    note: fromCatalog?.note ?? fallback?.note ?? backendSnap?.note,
  };
  if (!backendSnap) return base;
  return {
    minDimensions: Math.max(base.minDimensions, backendSnap.minDimensions),
    maxDimensions: Math.max(base.maxDimensions, backendSnap.maxDimensions),
    minMetrics: Math.max(base.minMetrics, backendSnap.minMetrics),
    maxMetrics: Math.max(base.maxMetrics, backendSnap.maxMetrics),
    note: base.note || backendSnap.note,
  };
}

/** catalog/BE 与 DE 轴蓝图取较大上限，避免散点 drill 槽在持久化时被裁切 */
export function resolveEffectiveChartFieldRule(chartType: string): ChartFieldRule {
  const rule = resolveChartFieldRule(chartType);
  const deRule = deriveFieldRuleFromDeCatalog(chartType);
  return {
    minDimensions: Math.max(rule.minDimensions, deRule.minDimensions),
    maxDimensions: Math.max(rule.maxDimensions, deRule.maxDimensions),
    minMetrics: Math.max(rule.minMetrics, deRule.minMetrics),
    maxMetrics: Math.max(rule.maxMetrics, deRule.maxMetrics),
    note: rule.note,
  };
}

function trimAxes(axes: ChartAxesConfig | undefined): ChartAxesConfig | undefined {
  if (!axes) return undefined;
  const next: ChartAxesConfig = {};
  for (const [axisId, refs] of Object.entries(axes)) {
    const trimmed = (refs ?? [])
      .filter((r) => r.field?.trim())
      .map((r) => ({ field: r.field.trim(), label: r.label ?? null }));
    if (trimmed.length > 0) next[axisId as DeAxisId] = trimmed;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** 提交校验前：迁移 DE 轴 → 同步 legacy → 剔除空槽并按类型上限裁剪 */
export function sanitizeChartFieldsForValidate(cfg: ChartViewConfig): ChartViewConfig {
  const synced = syncLegacyFieldsFromAxes(migrateChartConfigToDeAxes(cfg));
  const rule = resolveEffectiveChartFieldRule(synced.chartType);
  return {
    ...synced,
    axes: trimAxes(synced.axes),
    dimensions: (synced.dimensions ?? [])
      .filter((d) => d.field?.trim())
      .slice(0, rule.maxDimensions),
    metrics: (synced.metrics ?? [])
      .filter((m) => m.field?.trim())
      .slice(0, rule.maxMetrics),
  };
}

export function catalogFieldRule(item: ChartTypeCatalogItem): ChartFieldRule {
  return resolveChartFieldRule(item.type);
}
