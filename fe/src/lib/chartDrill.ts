import { activeFieldRefs } from "@/lib/chartConfigState";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { isGeoMapChartType } from "@/lib/chartViewConfig";
import type { RenderSpec } from "@/components/charts/engine/types";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";
import { resolveRenderSpec } from "@/lib/resolveRenderSpec";
import { tableInspectorProfile } from "@/lib/chartTableInspector";

export type ChartDrillFrame = {
  field: string;
  value: string;
  label?: string;
};

export const MAX_DRILL_DEPTH = 3;

const DEFAULT_GEO_DRILL_CHAIN = ["province", "city", "district"] as const;

export function resolveGeoDrillChain(config: ChartViewConfig): string[] {
  const chain = getDrillChain(config);
  return chain.length ? chain : [...DEFAULT_GEO_DRILL_CHAIN];
}

export function getDrillChain(config: ChartViewConfig): string[] {
  const dims = activeFieldRefs(config.dimensions);
  const chain: string[] = [];
  for (const dim of dims) {
    if (dim.field?.trim()) chain.push(dim.field.trim());
  }
  return chain.slice(0, MAX_DRILL_DEPTH);
}

export function isDrillEnabled(config: ChartViewConfig): boolean {
  if (isGeoMapChartType(config.chartType)) {
    return resolveGeoDrillChain(config).length >= 1;
  }
  return getDrillChain(config).length >= 2;
}

function geoMapMaxDrillDepth(config: ChartViewConfig): number {
  const chain = resolveGeoDrillChain(config);
  if (!chain.length) return 0;
  return Math.max(1, Math.min(chain.length - 1, 2));
}

export function canDrillDeeper(stack: ChartDrillFrame[], config: ChartViewConfig): boolean {
  if (isGeoMapChartType(config.chartType)) {
    return stack.length < geoMapMaxDrillDepth(config);
  }
  const chain = getDrillChain(config);
  return isDrillEnabled(config) && stack.length < chain.length - 1;
}

/** 当前层级展示的维度字段 */
export function getActiveDisplayField(
  config: ChartViewConfig,
  stack: ChartDrillFrame[],
): string | undefined {
  const chain = getDrillChain(config);
  if (!chain.length) return undefined;
  const index = Math.min(stack.length, chain.length - 1);
  return chain[index];
}

/** 点击图形元素时写入钻取栈的字段 */
export function getClickDrillField(
  config: ChartViewConfig,
  stack: ChartDrillFrame[],
): string | undefined {
  if (!canDrillDeeper(stack, config)) return undefined;
  return getActiveDisplayField(config, stack);
}

export function drillStackToFilterParameters(
  stack: ChartDrillFrame[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const frame of stack) {
    out[frame.field] = frame.value;
  }
  return out;
}

function colIndex(columns: string[], field: string): number | null {
  const index = columns.indexOf(field);
  return index >= 0 ? index : null;
}

export function filterRowsByDrillStack(
  rows: unknown[][],
  columns: string[],
  stack: ChartDrillFrame[],
): unknown[][] {
  if (!stack.length) return rows;
  return rows.filter((row) =>
    stack.every((frame) => {
      const index = colIndex(columns, frame.field);
      if (index === null) return true;
      return String(row[index] ?? "") === frame.value;
    }),
  );
}

export function aggregateRowsByField(
  rows: unknown[][],
  columns: string[],
  groupField: string,
  metricFields: string[],
): unknown[][] {
  const groupIndex = colIndex(columns, groupField);
  if (groupIndex === null || rows.length === 0) return rows;

  const metricIndexes = metricFields
    .map((field) => colIndex(columns, field))
    .filter((index): index is number => index !== null);

  const buckets = new Map<string, unknown[]>();
  for (const row of rows) {
    const key = String(row[groupIndex] ?? "");
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, [...row]);
      continue;
    }
    for (const metricIndex of metricIndexes) {
      const current = Number(existing[metricIndex] ?? 0);
      const next = Number(row[metricIndex] ?? 0);
      if (Number.isFinite(current) && Number.isFinite(next)) {
        existing[metricIndex] = current + next;
      }
    }
  }
  return Array.from(buckets.values());
}

export type ChartDrillPipelineResult = {
  rows: unknown[][];
  columns: string[];
  displayField?: string;
};

export function applyChartDrillPipeline(
  config: ChartViewConfig,
  columns: string[],
  rows: unknown[][],
  stack: ChartDrillFrame[],
): ChartDrillPipelineResult {
  const metrics = activeFieldRefs(config.metrics).map((item) => item.field);
  const filtered = filterRowsByDrillStack(rows, columns, stack);
  const displayField = getActiveDisplayField(config, stack);
  if (!displayField) {
    return { rows: filtered, columns };
  }
  const aggregated = aggregateRowsByField(filtered, columns, displayField, metrics);
  return { rows: aggregated, columns, displayField };
}

export function resolveDrillRenderSpec(
  config: ChartViewConfig,
  displayField?: string,
): RenderSpec {
  const base = resolveRenderSpec(config);
  const primary = activeFieldRefs(config.dimensions)[0]?.field;
  if (!displayField || !primary || displayField === primary) {
    return base;
  }
  return {
    ...base,
    encoding: {
      dimensions: [{ field: displayField, label: displayField }],
      metrics: activeFieldRefs(config.metrics),
    },
  };
}

export function drillBreadcrumbLabels(stack: ChartDrillFrame[]): string[] {
  return stack.map((frame) => frame.label?.trim() || frame.value);
}

const LEGACY_DRILLABLE_CHART_TYPES = new Set([
  "bar",
  "line",
  "timeline",
  "pie",
  "table",
  "map",
]);

const DRILLABLE_PALETTE_CATEGORIES = new Set(["compare", "trend", "distribute", "dual_axes"]);

/** 是否支持点击下钻（须已配置 ≥2 级维度） */
export function supportsChartDrillInteraction(config: ChartViewConfig): boolean {
  if (isGeoMapChartType(config.chartType)) {
    return resolveGeoDrillChain(config).length >= 1;
  }
  if (!isDrillEnabled(config)) return false;
  if (tableInspectorProfile(config.chartType)) return true;
  if (LEGACY_DRILLABLE_CHART_TYPES.has(config.chartType)) return true;
  const plugin = getChartPlugin(config.chartType);
  if (plugin && DRILLABLE_PALETTE_CATEGORIES.has(plugin.paletteCategory)) return true;
  return false;
}
