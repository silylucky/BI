import { CHART_EXECUTE_LIMIT } from "@/lib/chartExecuteProbe";
import { isCartesianRowLimitedType, type ChartType } from "@/lib/chartViewConfig";

export function resolveCartesianRowLimit(queryLimit?: number): number {
  return queryLimit ?? CHART_EXECUTE_LIMIT;
}

/** 折柱：超出 N 时截取前 N 行再画，不拒画。N 来自「结果展示 / 取最新 N 条」。 */
export function sliceCartesianDisplayRows<T>(
  chartType: ChartType,
  rows: T[],
  queryLimit?: number,
): T[] {
  if (!isCartesianRowLimitedType(chartType)) return rows;
  const cap = resolveCartesianRowLimit(queryLimit);
  if (rows.length <= cap) return rows;
  return rows.slice(0, cap);
}

export function isCartesianRowCountExceeded(
  chartType: ChartType,
  rowCount: number,
  queryLimit?: number,
): boolean {
  return isCartesianRowLimitedType(chartType) && rowCount > resolveCartesianRowLimit(queryLimit);
}
