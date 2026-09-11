import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { chartViewModelToRenderSpec } from "@/components/charts/engine/buildChartViewModel";
import { colIndex } from "@/components/charts/engine/buildDatasetEncoding";
import type { RenderSpec } from "@/components/charts/engine/types";
import { coerceAxisNumeric, fieldFromAxisOrLegacy } from "@/lib/chartAxisPlanFields";

function d3Plan(plotType: string, options: Record<string, unknown>): ChartRenderPlan {
  return { kind: "d3", plotType, options };
}

function errorPlan(message: string, plotType: string): ChartRenderPlan {
  return { kind: "d3", plotType, options: { data: [] }, empty: true, error: message };
}

function emptyPlan(plotType = "Line"): ChartRenderPlan {
  return { kind: "d3", plotType, options: { data: [] }, empty: true };
}

function aggregateDimMetric(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
  pick: (row: unknown[], di: number, indices: number[]) => Record<string, string | number>,
): Record<string, string | number>[] {
  const dim = spec.encoding.dimensions[0]?.field ?? "";
  const di = colIndex(columns, dim);
  const indices = spec.encoding.metrics.map((m) => colIndex(columns, m.field));
  const map = new Map<string, Record<string, string | number>>();

  for (const row of rows) {
    const key = di >= 0 ? String(row[di] ?? "") : "?";
    const mapped = pick(row, di, indices);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, mapped);
      continue;
    }
    for (const [field, val] of Object.entries(mapped)) {
      if (field === "type") continue;
      if (typeof val === "number") existing[field] = Number(existing[field] ?? 0) + val;
    }
  }
  return [...map.values()];
}

export function barRangePlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const catField = fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0);
  const lowField = fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0);
  const highField = fieldFromAxisOrLegacy(spec, "yAxisExt", 0, "metric", 1) || lowField;
  const ci = colIndex(columns, catField);
  if (ci < 0 && catField) return errorPlan(`维度列「${catField}」不存在`, "BarRange");
  if (!lowField) return errorPlan("区间图缺少开始值字段", "BarRange");

  const data = rows.map((row) => ({
    type: ci >= 0 ? String(row[ci] ?? "") : "?",
    low: coerceAxisNumeric(row, columns, lowField),
    high: coerceAxisNumeric(row, columns, highField),
  }));

  return d3Plan("BarRange", { data });
}

export function progressBarPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const targetField = fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0);
  const currentField = fieldFromAxisOrLegacy(spec, "yAxisExt", 0, "metric", 1);
  const ti = colIndex(columns, targetField);
  const ci = colIndex(columns, currentField);
  if (ti < 0 || ci < 0) return errorPlan("进度条缺少目标值或实际值指标列", "ProgressBar");

  const data = aggregateDimMetric(spec, rows, columns, (row, di, idx) => ({
    type: di >= 0 ? String(row[di] ?? "") : "?",
    target: Number(row[ti] ?? 0),
    current: Number(row[ci] ?? 0),
  })).map((row) => {
    const target = Number(row.target ?? 0);
    const current = Number(row.current ?? 0);
    let progress = 100;
    if (target !== 0) progress = (current / target) * 100;
    return {
      type: String(row.type ?? ""),
      value: current,
      target,
      progress: Math.min(Math.max(progress, 0), 100),
      max: target || Math.max(current, 1),
    };
  });

  return d3Plan("ProgressBar", { data });
}

export function bulletGraphPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const actualField = fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0);
  const targetField = fieldFromAxisOrLegacy(spec, "yAxisExt", 0, "metric", 1) || actualField;
  const rangeField = fieldFromAxisOrLegacy(spec, "extBubble", 0, "metric", 2);
  const ai = colIndex(columns, actualField);
  const ti = colIndex(columns, targetField);
  const ri = rangeField ? colIndex(columns, rangeField) : -1;
  if (ai < 0) return errorPlan(`指标列「${actualField}」不存在`, "Bullet");

  const data = aggregateDimMetric(spec, rows, columns, (row, di) => {
    const actual = Number(row[ai] ?? 0);
    const target = ti >= 0 ? Number(row[ti] ?? 0) : actual;
    const rangeMax = ri >= 0 ? Number(row[ri] ?? 0) : Math.max(actual, target, 1) * 1.2;
    return {
      type: di >= 0 ? String(row[di] ?? "") : "?",
      actual,
      target,
      rangeMax: rangeMax > 0 ? rangeMax : Math.max(actual, target, 1),
    };
  }).map((row) => ({
    type: String(row.type ?? ""),
    actual: Number(row.actual ?? 0),
    target: Number(row.target ?? 0),
    rangeMax: Number(row.rangeMax ?? 1),
  }));

  return d3Plan("Bullet", { data });
}

export function stockLinePlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const dim = fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0);
  const openField = fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0);
  const closeField = fieldFromAxisOrLegacy(spec, "yAxis", 1, "metric", 1) || openField;
  const lowField = fieldFromAxisOrLegacy(spec, "yAxis", 2, "metric", 2) || closeField;
  const highField = fieldFromAxisOrLegacy(spec, "yAxis", 3, "metric", 3) || lowField;
  const di = colIndex(columns, dim);
  const oi = colIndex(columns, openField);
  const ci = colIndex(columns, closeField);
  const li = colIndex(columns, lowField);
  const hi = colIndex(columns, highField);
  if (di < 0 || oi < 0) return errorPlan("K 线图缺少日期或价格列", "Stock");

  const data = rows.map((row) => {
    const open = Number(row[oi] ?? 0);
    const close = ci >= 0 ? Number(row[ci] ?? 0) : open;
    const low = li >= 0 ? Number(row[li] ?? 0) : Math.min(open, close);
    const high = hi >= 0 ? Number(row[hi] ?? 0) : Math.max(open, close);
    return {
      type: String(row[di] ?? ""),
      open,
      close,
      low: Math.min(low, open, close),
      high: Math.max(high, open, close),
    };
  });

  return d3Plan("Stock", { data });
}
