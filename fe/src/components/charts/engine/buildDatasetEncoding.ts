import type { ChartFieldRef } from "@/lib/chartViewConfig";
import type { RenderSpec } from "@/components/charts/engine/types";
import type { ChartAxesConfig } from "@/lib/chartDeAxis";
import { fieldFromAxisOrLegacy, normalizeCartesianSubField, resolveDualAxesMetrics } from "@/lib/chartAxisPlanFields";
import { getChartPlugin } from "@/components/charts/engine/plugins/registry";
import { DE_AREA_FILL_OPACITY } from "@/components/charts/engine/presentationConstants";

export const CARTESIAN_CATEGORY_KEY_SEP = "\u0001";

/** 将内部复合类目标签转为可读展示文案（单维或 tooltip 单行） */
export function formatCompositeCategoryDisplay(key: string): string {
  const text = String(key);
  if (!text.includes(CARTESIAN_CATEGORY_KEY_SEP)) return formatCategoryCellValue(text);
  return text
    .split(CARTESIAN_CATEGORY_KEY_SEP)
    .map(formatCategoryCellValue)
    .filter((part) => part.length > 0)
    .join(" / ");
}

/** 单元格原始值 → 轴标签文案（空/null 不展示） */
export function formatCategoryCellValue(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const text = String(raw).trim();
  if (!text || text === "null" || text === "undefined") return "";
  return text;
}

/** 从复合类目标签推断结构层数（含空维占位） */
export function inferCompositeCategoryLevels(categories: string[]): number {
  let levels = 1;
  for (const category of categories) {
    if (!category.includes(CARTESIAN_CATEGORY_KEY_SEP)) continue;
    levels = Math.max(levels, category.split(CARTESIAN_CATEGORY_KEY_SEP).length);
  }
  return levels;
}

/** 多维度类目按轴字段顺序排序，保证分层轴父级可合并成段 */
export function sortCompositeCategoryKeys(
  categories: string[],
  structuralLevelCount?: number,
): string[] {
  const levelCount = structuralLevelCount ?? inferCompositeCategoryLevels(categories);
  if (levelCount <= 1 || categories.length <= 1) return categories;

  const partAt = (key: string, level: number): string => {
    const parts = key.includes(CARTESIAN_CATEGORY_KEY_SEP)
      ? key.split(CARTESIAN_CATEGORY_KEY_SEP)
      : [key];
    return formatCategoryCellValue(parts[level] ?? "");
  };

  return [...categories].sort((a, b) => {
    for (let level = 0; level < levelCount; level += 1) {
      const cmp = partAt(a, level).localeCompare(partAt(b, level), undefined, { numeric: true });
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

/** 类目轴域：去重 + 按维度层级排序（与分层轴分段一致） */
export function normalizeCategoryAxisDomain(
  categories: string[],
  structuralLevelCount?: number,
): { categories: string[]; structuralLevelCount: number } {
  const unique = [...new Set(categories.map((c) => String(c)))];
  const inferred = inferCompositeCategoryLevels(unique);
  const levelCount = Math.max(inferred, structuralLevelCount ?? 1);
  if (levelCount <= 1) {
    const sorted = [...unique].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { categories: sorted, structuralLevelCount: 1 };
  }
  return {
    categories: sortCompositeCategoryKeys(unique, levelCount),
    structuralLevelCount: levelCount,
  };
}

/** 有效维度层数：至少一层存在非空标签（对标 DataEase，忽略全空维） */
export function inferEffectiveCategoryLevels(categories: string[]): number {
  let maxLevel = 1;
  for (const category of categories) {
    const parts = category.includes(CARTESIAN_CATEGORY_KEY_SEP)
      ? category.split(CARTESIAN_CATEGORY_KEY_SEP)
      : [category];
    for (let i = 0; i < parts.length; i += 1) {
      if (formatCategoryCellValue(parts[i])) {
        maxLevel = Math.max(maxLevel, i + 1);
      }
    }
  }
  return maxLevel;
}

export function resolveCartesianAxisFields(encoding: RenderSpec["encoding"]): {
  categoryFields: string[];
  subDim?: string;
} {
  const axes: ChartAxesConfig = encoding.axes ?? {};
  const categoryFields = (axes.xAxis ?? [])
    .map((ref) => ref.field?.trim())
    .filter((field): field is string => Boolean(field));
  const rawSub =
    axes.xAxisExt?.[0]?.field?.trim() || axes.extStack?.[0]?.field?.trim() || undefined;

  if (categoryFields.length > 0) {
    return {
      categoryFields,
      subDim: normalizeCartesianSubField(categoryFields[0]!, rawSub),
    };
  }

  const dims = encoding.dimensions.map((d) => d.field?.trim()).filter(Boolean) as string[];
  return {
    categoryFields: dims.length > 0 ? [dims[0]!] : [],
    subDim: normalizeCartesianSubField(dims[0] ?? "", dims[1]),
  };
}

export function compositeCategoryKey(row: unknown[], columns: string[], fields: string[]): string {
  return fields
    .map((field) => {
      const idx = columns.indexOf(field);
      return idx >= 0 ? formatCategoryCellValue(row[idx]) : "";
    })
    .join(CARTESIAN_CATEGORY_KEY_SEP);
}

export const ADVANCED_CHART_ROW_CAP = 500;
/** 关系图需先聚合边，允许读取更多原始行再截断展示。 */
export const GRAPH_CHART_ROW_CAP = 5000;
export const GRAPH_NODE_CAP = 120;
export const GRAPH_EDGE_CAP = 240;
export const SANKEY_LINK_CAP = 300;

export function safeColIndex(columns: string[], field: string): number | null {
  const idx = columns.indexOf(field);
  return idx >= 0 ? idx : null;
}

function colIndex(columns: string[], field: string): number {
  return columns.indexOf(field);
}

export function capRows<T>(rows: T[], cap: number): { rows: T[]; truncated: boolean } {
  if (rows.length <= cap) return { rows, truncated: false };
  return { rows: rows.slice(0, cap), truncated: true };
}

export function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export type CartesianSeriesBuild = {
  xData: string[];
  series: Array<{ name?: string; type?: string; data?: unknown[] }>;
  isHorizontal: boolean;
};

/** 折线子类型：default / area / smooth（与 backend viz builtin 对齐） */
export function applyLineStyleVariant(styleVariant: string): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (styleVariant === "smooth") {
    patch.smooth = true;
  }
  if (styleVariant === "area") {
    patch.areaStyle = { opacity: DE_AREA_FILL_OPACITY };
  }
  if (styleVariant === "stacked") {
    patch.stack = "total";
    patch.areaStyle = { opacity: DE_AREA_FILL_OPACITY };
  }
  return patch;
}

/** 类别轴 + 可选子类别拆系列 + 指标聚合（引擎无关） */
export function buildCartesianCategorySeries(
  spec: Pick<RenderSpec, "encoding" | "styleVariant">,
  rows: unknown[][],
  columns: string[],
  seriesType: "line" | "bar",
  stylePatch?: (styleVariant: string) => Record<string, unknown>,
): CartesianSeriesBuild {
  const { categoryFields, subDim } = resolveCartesianAxisFields(spec.encoding);
  const metrics = spec.encoding.metrics.map((m: ChartFieldRef) => m.field).filter(Boolean);
  const isHorizontal = spec.styleVariant === "horizontal";

  if (categoryFields.length === 0 || metrics.length === 0) {
    return { xData: [], series: [], isHorizontal };
  }

  const categoryIdx = categoryFields.map((f) => safeColIndex(columns, f));
  if (categoryIdx.some((i) => i === null)) {
    return { xData: [], series: [], isHorizontal };
  }
  const d1i = subDim ? safeColIndex(columns, subDim) : null;

  const xData = sortCompositeCategoryKeys(
    uniqueOrdered(rows.map((r) => compositeCategoryKey(r, columns, categoryFields))),
    categoryFields.length > 1 ? categoryFields.length : undefined,
  );

  const sumAt = (xKey: string, sub: string | null, metric: string) => {
    const mi = safeColIndex(columns, metric);
    if (mi === null) return 0;
    let sum = 0;
    for (const row of rows) {
      if (compositeCategoryKey(row, columns, categoryFields) !== xKey) continue;
      if (sub !== null && d1i !== null && String(row[d1i] ?? "") !== sub) continue;
      sum += Number(row[mi] ?? 0);
    }
    return sum;
  };

  const patch = stylePatch?.(spec.styleVariant) ?? {};
  const metricLabel = (field: string) =>
    spec.encoding.metrics.find((m) => m.field === field)?.label?.trim() || field;

  if (!subDim || d1i === null) {
    const series = metrics.map((metric) => {
      const base: Record<string, unknown> = {
        type: seriesType,
        name: metricLabel(metric),
        data: xData.map((x) => sumAt(x, null, metric)),
        ...patch,
      };
      if (
        seriesType === "bar" &&
        (spec.styleVariant === "stacked" || spec.styleVariant === "grouped")
      ) {
        base.stack = spec.styleVariant === "stacked" ? "total" : undefined;
      }
      return base;
    });
    return { xData, series, isHorizontal };
  }

  const subValues = uniqueOrdered(rows.map((r) => String(r[d1i] ?? "")));
  const series: Record<string, unknown>[] = [];
  for (const sub of subValues) {
    for (const metric of metrics) {
      const name = metrics.length > 1 ? `${sub}·${metric}` : sub;
      const base: Record<string, unknown> = {
        type: seriesType,
        name,
        data: xData.map((x) => sumAt(x, sub, metric)),
        ...patch,
      };
      if (seriesType === "bar") {
        if (spec.styleVariant === "stacked") base.stack = "total";
        if (spec.styleVariant === "grouped") base.stack = undefined;
      }
      series.push(base);
    }
  }
  return { xData, series, isHorizontal };
}

function usesShellCartesianLegend(chartType: string): boolean {
  const plugin = getChartPlugin(chartType);
  if (plugin) {
    return (
      plugin.paletteCategory === "trend" ||
      plugin.paletteCategory === "compare" ||
      plugin.paletteCategory === "dual_axes"
    );
  }
  return chartType === "line" || chartType === "bar" || chartType === "timeline";
}

function cartesianSeriesTypeForLegend(chartType: string): "line" | "bar" {
  const plugin = getChartPlugin(chartType);
  return plugin?.paletteCategory === "compare" ? "bar" : "line";
}

function resolveCartesianShellLegendNames(
  spec: Pick<RenderSpec, "encoding" | "styleVariant">,
  rows: unknown[][],
  columns: string[],
  seriesType: "line" | "bar",
): string[] {
  const { series } = buildCartesianCategorySeries(spec, rows, columns, seriesType);
  return series.map((s) => String(s.name ?? "")).filter(Boolean);
}

function resolveDualAxesShellLegendNames(
  spec: Pick<RenderSpec, "chartType" | "encoding" | "styleVariant">,
  rows: unknown[][],
  columns: string[],
): string[] {
  const { columnMetric, lineMetric } = resolveDualAxesMetrics(spec as RenderSpec);

  if (spec.chartType === "chart-mix-dual-line") {
    const extBubble = spec.encoding.axes?.extBubble?.[0]?.field?.trim();
    if (extBubble) {
      const idx = safeColIndex(columns, extBubble);
      if (idx !== null) {
        const subs = uniqueOrdered(rows.map((r) => String(r[idx] ?? "")).filter(Boolean));
        if (subs.length > 1) return [columnMetric, ...subs].filter(Boolean);
      }
    }
    const names = [columnMetric, lineMetric].filter(Boolean);
    return names.length > 0 ? names : [columnMetric].filter(Boolean);
  }

  const barNames = resolveCartesianShellLegendNames(spec, rows, columns, "bar");
  if (!lineMetric) {
    return barNames.length > 0 ? barNames : [columnMetric].filter(Boolean);
  }
  if (barNames.length > 1) {
    return [...barNames, lineMetric].filter(Boolean);
  }
  return [columnMetric, lineMetric].filter((name, index, all) => name && all.indexOf(name) === index);
}

function resolveDimensionCategoryLegendNames(
  encoding: RenderSpec["encoding"],
  rows: unknown[][],
  columns: string[],
): string[] {
  const dim = encoding.dimensions[0]?.field ?? "";
  const di = safeColIndex(columns, dim);
  if (di === null) return [];
  return uniqueOrdered(rows.map((r) => String(r[di] ?? "")).filter(Boolean));
}

export function resolveSeriesLegendNames(
  spec: Pick<RenderSpec, "chartType" | "encoding" | "styleVariant">,
  rows: unknown[][],
  columns: string[],
): string[] {
  const { chartType, encoding } = spec;
  if (chartType === "waterfall") {
    return ["增加", "减少"];
  }
  if (chartType === "bidirectional-bar") {
    return ["左", "右"];
  }
  if (
    chartType === "scatter" ||
    chartType === "multi-scatter" ||
    chartType === "quadrant"
  ) {
    const names = resolveDimensionCategoryLegendNames(encoding, rows, columns);
    return names.length > 1 ? names : [];
  }
  if (
    chartType === "pie" ||
    chartType.startsWith("pie-") ||
    chartType === "funnel" ||
    chartType === "radar"
  ) {
    return resolveDimensionCategoryLegendNames(encoding, rows, columns);
  }
  if (chartType.startsWith("chart-mix")) {
    return resolveDualAxesShellLegendNames(spec, rows, columns);
  }
  if (usesShellCartesianLegend(chartType)) {
    return resolveCartesianShellLegendNames(
      spec,
      rows,
      columns,
      cartesianSeriesTypeForLegend(chartType),
    );
  }
  if (chartType === "timeline") {
    const metric = encoding.metrics[0]?.field;
    return metric ? [metric] : [];
  }
  return [];
}

export { colIndex };
