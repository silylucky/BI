import type { RenderSpec } from "@/components/charts/engine/types";
import { safeColIndex } from "@/components/charts/engine/buildDatasetEncoding";
import { fieldFromAxisOrLegacy } from "@/lib/chartAxisPlanFields";
import { DEFAULT_PIE_OTHER_LABEL } from "@/lib/chartDeStyle";

export type AntvPieRow = { type: string; value: number };

export type PieMergeOptions = {
  topN: number;
  otherLabel?: string;
};

/** 保留 Top N，其余合并为一项（对标 DE「合并数据」） */
export function applyPieMergeTopN(rows: AntvPieRow[], opts: PieMergeOptions): AntvPieRow[] {
  const topN = Math.max(1, Math.floor(opts.topN));
  if (rows.length <= topN) return rows;
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, topN);
  const restValue = sorted.slice(topN).reduce((sum, row) => sum + row.value, 0);
  if (restValue <= 0) return top;
  const label = opts.otherLabel?.trim() || DEFAULT_PIE_OTHER_LABEL;
  return [...top, { type: label, value: restValue }];
}

/** 按维度聚合指标（与笛卡尔图 sumAt 语义一致）；优先 DE xAxis/yAxis */
export function encodePieRows(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
): AntvPieRow[] {
  const dim =
    fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0) ||
    spec.encoding.dimensions[0]?.field?.trim() ||
    "";
  const metric =
    fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0) ||
    spec.encoding.metrics[0]?.field?.trim() ||
    "";
  const di = safeColIndex(columns, dim);
  const mi = safeColIndex(columns, metric);
  if (di === null || mi === null) return [];

  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[di] ?? "");
    totals.set(key, (totals.get(key) ?? 0) + Number(row[mi] ?? 0));
  }
  return [...totals.entries()].map(([type, value]) => ({ type, value }));
}
