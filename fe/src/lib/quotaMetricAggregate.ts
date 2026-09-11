/** 单指标 quota 图（gauge/liquid）跨行聚合 */
export function aggregateQuotaMetric(
  rows: unknown[][],
  columns: string[],
  metricField: string,
): number {
  const mi = columns.indexOf(metricField);
  if (mi < 0) return 0;
  let sum = 0;
  for (const row of rows) {
    const v = Number(row[mi] ?? 0);
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}
