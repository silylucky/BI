import type { ChartType, ChartViewConfig } from "@/lib/chartViewConfig";
import {
  deriveFieldRuleFromDeCatalog,
  getDeAxisBlueprint,
  type DeAxisFieldType,
  type DeAxisId,
} from "@/lib/chartDeAxis";
import { ensureDeAxisCapacity, migrateChartConfigToDeAxes } from "@/lib/resolveChartEncoding";
import { resolveChartFieldRule, resolveEffectiveChartFieldRule } from "@/lib/chartFieldRules";

export type ChartFieldSlotHints = {
  dimensionLabel: string;
  metricLabel: string;
};

export type ChartDataSlotBlueprint = {
  axisId: DeAxisId;
  index: number;
  /** DE fieldType；both 表示维/指标均可拖入 */
  kind: DeAxisFieldType;
  label: string;
  required?: boolean;
  showAggregation?: boolean;
  uiMode?: "single" | "multi";
  limit?: number;
  maxDimensions?: number;
  maxMetrics?: number;
};

function firstSlotLabel(slots: ChartDataSlotBlueprint[], kind: DeAxisFieldType): string | undefined {
  return slots.find((s) => s.kind === kind || s.kind === "both")?.label;
}

/** 图表类型 → 轴槽位文案（兼容旧调用） */
export function chartFieldSlotHints(chartType: ChartType | string): ChartFieldSlotHints {
  const slots = chartDataSlotBlueprint(chartType);
  return {
    dimensionLabel: firstSlotLabel(slots, "dimension") ?? "维度字段",
    metricLabel: firstSlotLabel(slots, "metric") ?? "度量字段",
  };
}

/** DataEase chart-edit：按图表类型固定槽位（真理源 chartDeAxis/catalog） */
export function chartDataSlotBlueprint(chartType: ChartType | string): ChartDataSlotBlueprint[] {
  return getDeAxisBlueprint(chartType).map((slot) => ({
    axisId: slot.axisId,
    index: slot.index,
    kind: slot.fieldType,
    label: slot.label,
    required: slot.required,
    showAggregation: slot.showAggregation,
    uiMode: slot.uiMode,
    limit: slot.limit,
    maxDimensions: slot.maxDimensions,
    maxMetrics: slot.maxMetrics,
  }));
}

/** @deprecated 使用 chartRenderRequiredCounts */
export function chartMinFieldCounts(chartType: ChartType | string): {
  minDimensions: number;
  minMetrics: number;
} {
  return chartRenderRequiredCounts(chartType);
}

/** 渲染/校验所需最少已填字段（对标 DE 必填轴 + backend field_rule） */
export function chartRenderRequiredCounts(chartType: ChartType | string): {
  minDimensions: number;
  minMetrics: number;
} {
  const rule = resolveChartFieldRule(chartType);
  const deRule = deriveFieldRuleFromDeCatalog(chartType);
  const slots = getDeAxisBlueprint(chartType);
  let requiredDims = 0;
  let requiredMetrics = 0;

  for (const slot of slots) {
    if (slot.required === false) continue;
    if (slot.uiMode === "multi") continue;
    if (slot.fieldType === "dimension") {
      requiredDims += 1;
    } else if (slot.fieldType === "metric") {
      requiredMetrics += 1;
    } else if (slot.legacy?.kind === "dimension") {
      requiredDims += 1;
    } else if (slot.legacy?.kind === "metric") {
      requiredMetrics += 1;
    } else {
      requiredDims += 1;
      requiredMetrics += 1;
    }
  }

  return {
    minDimensions: Math.max(requiredDims, rule.minDimensions, deRule.minDimensions),
    minMetrics: Math.max(requiredMetrics, rule.minMetrics, deRule.minMetrics),
  };
}

/** 切换图表类型时补齐 DE 轴结构并同步 dimensions/metrics 投影 */
export function ensureChartSlotCapacity(cfg: ChartViewConfig): ChartViewConfig {
  const migrated = migrateChartConfigToDeAxes(cfg);
  const rule = resolveEffectiveChartFieldRule(migrated.chartType);
  const withAxes = ensureDeAxisCapacity(migrated);
  const dimensions = [...(withAxes.dimensions ?? [])].slice(0, rule.maxDimensions);
  const metrics = [...(withAxes.metrics ?? [])].slice(0, rule.maxMetrics);
  const { minDimensions, minMetrics } = chartRenderRequiredCounts(migrated.chartType);
  while (dimensions.length < minDimensions) dimensions.push({ field: "" });
  while (metrics.length < minMetrics) metrics.push({ field: "" });
  return { ...withAxes, dimensions, metrics };
}
