import type { CustomVizRuntimeEncoding, CustomVizRuntimePayload } from "./customVizPayload";

export type CategorySeriesPoint = {
  category: string;
  values: (number | null)[];
  sortKey: number | null;
  sourceIndex: number;
};

export type ParsedCategorySeries = {
  categories: string[];
  series: Array<{ field: string; values: (number | null)[] }>;
  points: CategorySeriesPoint[];
};

const DATE_PREFIX = /^(?:\d{4}[-/]\d{1,2}[-/]\d{1,2})/;

export function columnIndex(columns: string[], field: string): number {
  return columns.indexOf(field.trim());
}

export function resolveEncodingIndices(
  columns: string[],
  encoding?: CustomVizRuntimeEncoding,
): { dimensionIndices: number[]; metricIndices: number[] } {
  if (encoding) {
    const dimensionIndices = encoding.dimensions
      .map((f) => columnIndex(columns, f))
      .filter((i) => i >= 0);
    const metricIndices = encoding.metrics
      .map((f) => columnIndex(columns, f))
      .filter((i) => i >= 0);
    if (dimensionIndices.length > 0 && metricIndices.length > 0) {
      return { dimensionIndices, metricIndices };
    }
  }
  if (columns.length >= 2) {
    return {
      dimensionIndices: [0],
      metricIndices: columns.slice(1).map((_, i) => i + 1),
    };
  }
  return { dimensionIndices: [], metricIndices: [] };
}

export function parseDateSortKey(value: unknown): number | null {
  const text = String(value ?? "");
  if (!DATE_PREFIX.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toNumericCell(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

/** 将 bound payload 解析为「类别轴 + 多指标序列」，供折线/柱/面积等 cartesian 组件复用。 */
export function parseCategorySeriesPayload(args: {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  encoding?: CustomVizRuntimeEncoding;
  maxMetrics?: number;
}): ParsedCategorySeries | null {
  const { columns, rows, encoding, maxMetrics = 8 } = args;
  if (!columns.length || !rows.length) return null;

  const { dimensionIndices, metricIndices } = resolveEncodingIndices(columns, encoding);
  if (dimensionIndices.length === 0 || metricIndices.length === 0) return null;

  const dimIdx = dimensionIndices[0];
  const metricCols = metricIndices.slice(0, maxMetrics);
  const points: CategorySeriesPoint[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const values = metricCols.map((colIdx) => toNumericCell(row[colIdx]));
    if (!values.some((v) => v != null)) continue;
    const category = String(row[dimIdx] ?? "");
    points.push({
      category,
      values,
      sortKey: parseDateSortKey(row[dimIdx]),
      sourceIndex: i,
    });
  }

  if (points.length === 0) return null;

  points.sort((a, b) => {
    if (a.sortKey != null && b.sortKey != null) return a.sortKey - b.sortKey;
    if (a.sortKey != null) return -1;
    if (b.sortKey != null) return 1;
    return a.sourceIndex - b.sourceIndex;
  });

  const series = metricCols.map((colIdx, seriesIdx) => ({
    field: columns[colIdx] ?? `metric_${seriesIdx + 1}`,
    values: points.map((p) => p.values[seriesIdx] ?? null),
  }));

  return {
    categories: points.map((p) => p.category),
    series,
    points,
  };
}

export function parseCategorySeriesFromPayload(
  payload: Pick<CustomVizRuntimePayload, "columns" | "rows" | "encoding"> | null | undefined,
  maxMetrics?: number,
): ParsedCategorySeries | null {
  if (!payload?.rows?.length) return null;
  return parseCategorySeriesPayload({
    columns: payload.columns ?? [],
    rows: payload.rows,
    encoding: payload.encoding,
    maxMetrics,
  });
}

export function pickNearestPointIndex(
  mx: number,
  my: number,
  points: Array<{ x: number; y: number }>,
  radius = 36,
): number {
  let closest = -1;
  let distMin = radius;
  for (let i = 0; i < points.length; i += 1) {
    const d = Math.hypot(mx - points[i].x, my - points[i].y);
    if (d < distMin) {
      distMin = d;
      closest = i;
    }
  }
  return closest;
}

/** Canvas 组件通用：tooltip 跟随指针并限制在容器内，避免越界串位。 */
export function placeTooltipNearPointer(
  container: HTMLElement,
  tooltip: HTMLElement,
  clientX: number,
  clientY: number,
): void {
  const rect = container.getBoundingClientRect();
  const lx = clientX - rect.left;
  const ly = clientY - rect.top;
  const width = rect.width;
  const height = rect.height;
  const tw = tooltip.offsetWidth || 140;
  const th = tooltip.offsetHeight || 52;
  const left = Math.min(Math.max(lx + 12, 8), Math.max(8, width - tw - 8));
  const top = Math.min(Math.max(ly - th - 12, 8), Math.max(8, height - th - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function formatMetricCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}
