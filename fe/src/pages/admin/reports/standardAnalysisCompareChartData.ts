import type { CompareResult } from "./useStandardAnalysis";

export const COMPARE_PAIR_CHART_TOP_N = 15;

export type ComparePairChartRow = [string, string, number];

export function pickTopCompareDeltas(
  deltas: CompareResult["deltas"],
  limit = COMPARE_PAIR_CHART_TOP_N,
): CompareResult["deltas"] {
  return [...deltas]
    .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0))
    .slice(0, limit);
}

export function deltasToComparePairRows(
  deltas: CompareResult["deltas"],
  currentLabel: string,
  previousLabel: string,
  limit = COMPARE_PAIR_CHART_TOP_N,
): { headers: string[]; rows: ComparePairChartRow[] } {
  const headers = ["dim", "period", "cnt"];
  const rows: ComparePairChartRow[] = [];
  for (const delta of pickTopCompareDeltas(deltas, limit)) {
    rows.push([delta.key, currentLabel, delta.currentValue]);
    rows.push([delta.key, previousLabel, delta.previousValue ?? 0]);
  }
  return { headers, rows };
}

export function comparePairPeriodLabels(compareData: CompareResult): {
  currentLabel: string;
  previousLabel: string;
} {
  return {
    currentLabel: `本期（${compareData.currentPeriodKey}）`,
    previousLabel: `对比期（${compareData.previousPeriodKey ?? "—"}）`,
  };
}
