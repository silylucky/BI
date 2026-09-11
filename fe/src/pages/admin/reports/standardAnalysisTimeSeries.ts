/** 标准分析活跃度/趋势：时间序列表格 → 图表行变换（排序、趋势累计） */

function findTimeColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => /^(d|date|日期|时间)$/i.test(header));
}

function findCountColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => /^(cnt|count|数量|total|sum)$/i.test(header));
}

/** ISO 日期 / 周桶 / 月桶 按时间先后排序 */
export function compareTimeSeriesKeys(left: string, right: string): number {
  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();
  const leftMs = Date.parse(leftText);
  const rightMs = Date.parse(rightText);
  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) return leftMs - rightMs;
  return leftText.localeCompare(rightText, undefined, { numeric: true });
}

export function sortTimeSeriesRows(headers: string[], rows: unknown[][]): unknown[][] {
  const timeIdx = findTimeColumnIndex(headers);
  if (timeIdx < 0 || rows.length <= 1) return rows;
  return [...rows].sort((left, right) =>
    compareTimeSeriesKeys(String(left[timeIdx] ?? ""), String(right[timeIdx] ?? "")),
  );
}

/** 趋势主题：按时间排序后对计数列做累计，使折线反映总量增长而非稀疏日计数 */
export function prepareTrendChartRows(headers: string[], rows: unknown[][]): unknown[][] {
  const sorted = sortTimeSeriesRows(headers, rows);
  const cntIdx = findCountColumnIndex(headers);
  if (cntIdx < 0) return sorted;

  let running = 0;
  return sorted.map((row) => {
    const next = [...row];
    const daily = Number(row[cntIdx]);
    if (Number.isFinite(daily)) running += daily;
    next[cntIdx] = running;
    return next;
  });
}

export function maxDailyCountInRows(headers: string[], rows: unknown[][]): number | null {
  const cntIdx = findCountColumnIndex(headers);
  if (cntIdx < 0) return null;
  let peak = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = Number(row[cntIdx]);
    if (!Number.isFinite(value)) continue;
    if (value > peak) peak = value;
  }
  return Number.isFinite(peak) ? peak : null;
}

export function lastCumulativeCount(headers: string[], rows: unknown[][]): number | null {
  const prepared = prepareTrendChartRows(headers, rows);
  const cntIdx = findCountColumnIndex(headers);
  if (cntIdx < 0 || prepared.length === 0) return null;
  const value = Number(prepared[prepared.length - 1]?.[cntIdx]);
  return Number.isFinite(value) ? value : null;
}
