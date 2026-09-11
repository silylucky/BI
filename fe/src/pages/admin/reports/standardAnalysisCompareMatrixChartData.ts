import type { CompareMatrixResult } from "./useStandardAnalysis";

export const COMPARE_MATRIX_CHART_TOP_N = 8;

export type MatrixLineChartRow = [string, string, number];

export function sortPeriodKeysAsc(periodKeys: string[]): string[] {
  return [...periodKeys].sort();
}

export function pickTopMatrixDimensions(
  rows: CompareMatrixResult["rows"],
  periodKeys: string[],
  limit = COMPARE_MATRIX_CHART_TOP_N,
): string[] {
  if (periodKeys.length === 0) return [];

  return [...rows]
    .map((row) => {
      const values = periodKeys.map((key) => row.values[key] ?? 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { key: row.key, range: max - min, latest: values[0] ?? 0 };
    })
    .sort((left, right) => right.range - left.range || right.latest - left.latest)
    .slice(0, limit)
    .map((item) => item.key);
}

export function matrixPeriodTotals(
  matrixData: CompareMatrixResult,
): Array<{ periodKey: string; total: number }> {
  const periodKeys = sortPeriodKeysAsc(matrixData.periodKeys);
  return periodKeys.map((periodKey) => ({
    periodKey,
    total: matrixData.rows.reduce((sum, row) => sum + (row.values[periodKey] ?? 0), 0),
  }));
}

export function matrixToLineRows(
  matrixData: CompareMatrixResult,
  limit = COMPARE_MATRIX_CHART_TOP_N,
): {
  headers: string[];
  rows: MatrixLineChartRow[];
  selectedDimensions: string[];
  totalRowCount: number;
} {
  const periodKeys = sortPeriodKeysAsc(matrixData.periodKeys);
  const selectedDimensions = pickTopMatrixDimensions(matrixData.rows, periodKeys, limit);
  const headers = ["period", "dim", "cnt"];
  const rows: MatrixLineChartRow[] = [];

  for (const dimension of selectedDimensions) {
    const row = matrixData.rows.find((item) => item.key === dimension);
    if (!row) continue;
    for (const periodKey of periodKeys) {
      rows.push([periodKey, dimension, row.values[periodKey] ?? 0]);
    }
  }

  return {
    headers,
    rows,
    selectedDimensions,
    totalRowCount: matrixData.rows.length,
  };
}
