import type { ChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { chartViewModelToRenderSpec } from "@/components/charts/engine/buildChartViewModel";
import {
  ADVANCED_CHART_ROW_CAP,
  GRAPH_CHART_ROW_CAP,
  capRows,
  colIndex,
  resolveCartesianAxisFields,
} from "@/components/charts/engine/buildDatasetEncoding";
import { aggregateGraphFromRows } from "@/components/charts/engine/plugins/plans/graphPlanData";
import {
  barRangePlan,
  bulletGraphPlan,
  progressBarPlan,
  stockLinePlan,
} from "@/components/charts/engine/plugins/plans/buildComparePlans";
import { encodeCartesianRows } from "@/components/charts/engine/antv/spec/encodeCartesian";
import { encodePieRows } from "@/components/charts/engine/antv/spec/encodePie";
import { PIE_RADIUS_FRAC_DEFAULT } from "@/components/charts/engine/d3/radial/pieLayout";
import type { ChartViewModel, RenderSpec } from "@/components/charts/engine/types";
import { aggregateQuotaMetric } from "@/lib/quotaMetricAggregate";
import { getDeAxisLegacyMap } from "@/lib/chartDeAxis";
import { fieldFromAxisOrLegacy, normalizeCartesianSubField, optionalAxisField, resolveDualAxesMetrics } from "@/lib/chartAxisPlanFields";

export function emptyPlan(plotType = "Line", error?: string): ChartRenderPlan {
  return { kind: "d3", plotType, options: { data: [] }, empty: true, error };
}

export function errorPlan(message: string, plotType = "Line"): ChartRenderPlan {
  return { kind: "d3", plotType, options: { data: [] }, empty: true, error: message };
}

export function d3Plan(plotType: string, options: Record<string, unknown>): ChartRenderPlan {
  return { kind: "d3", plotType, options };
}

function specWithMetrics(spec: RenderSpec, metricFields: string[]): RenderSpec {
  const allowed = new Set(metricFields.filter(Boolean));
  const seen = new Set<string>();
  return {
    ...spec,
    encoding: {
      ...spec.encoding,
      metrics: spec.encoding.metrics.filter((m) => {
        if (!allowed.has(m.field)) return false;
        if (seen.has(m.field)) return false;
        seen.add(m.field);
        return true;
      }),
    },
  };
}

function resolveMetricLabel(spec: RenderSpec, field: string): string {
  if (!field) return field;
  const fromYAxis = spec.encoding.axes?.yAxis?.find((m) => m.field === field);
  if (fromYAxis?.label?.trim()) return fromYAxis.label.trim();
  const fromYExt = spec.encoding.axes?.yAxisExt?.find((m) => m.field === field);
  if (fromYExt?.label?.trim()) return fromYExt.label.trim();
  const fromMetrics = spec.encoding.metrics.find((m) => m.field === field);
  return fromMetrics?.label?.trim() || field;
}

/** 双轴线侧仅类别轴聚合，不拆分子类别维 */
function trimSpecToCategoryAxis(spec: RenderSpec): RenderSpec {
  return {
    ...spec,
    encoding: {
      ...spec.encoding,
      dimensions: spec.encoding.dimensions.slice(0, 1),
    },
  };
}

/** 为 encodeCartesianRows 注入子类别（写入 xAxisExt / dimensions[1]） */
function injectSubCategory(spec: RenderSpec, subField: string | undefined): RenderSpec {
  const categoryField =
    fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0) ||
    spec.encoding.dimensions[0]?.field?.trim() ||
    "";
  const sub = normalizeCartesianSubField(categoryField, subField);
  const axes = { ...spec.encoding.axes };
  if (!sub) {
    axes.xAxisExt = [];
    axes.extStack = [];
    return {
      ...spec,
      encoding: {
        ...spec.encoding,
        dimensions: spec.encoding.dimensions.slice(0, 1),
        axes,
      },
    };
  }
  const categoryDim = spec.encoding.dimensions[0];
  const dimensions = categoryDim ? [categoryDim, { field: sub }] : [{ field: sub }];
  return {
    ...spec,
    encoding: {
      ...spec.encoding,
      dimensions,
      axes: {
        ...axes,
        xAxisExt: [{ field: sub }],
      },
    },
  };
}

function dualAxesBarSubField(
  spec: RenderSpec,
  mode: "default" | "group" | "stack",
): string {
  if (mode === "group") {
    return optionalAxisField(spec, "xAxisExt", 0, "dimension", 1);
  }
  if (mode === "stack") {
    const category = fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0);
    const stack = optionalAxisField(spec, "extStack", 0, "dimension", 1);
    return normalizeCartesianSubField(category, stack) ?? "";
  }
  return "";
}

function dualAxesLineSubField(
  spec: RenderSpec,
  axisId: "extBubble" | "xAxisExt",
): string {
  const legacyMap = getDeAxisLegacyMap(spec.chartType ?? "");
  const mapped = legacyMap.find((entry) => entry.axisId === axisId && entry.index === 0);
  if (mapped?.legacy) {
    const { kind, index } = mapped.legacy;
    return optionalAxisField(spec, axisId, 0, kind, index);
  }
  const legacyIndex = axisId === "xAxisExt" ? 1 : 1;
  return optionalAxisField(spec, axisId, 0, "dimension", legacyIndex);
}

/** 仪表盘/水波图：0~1 原样；1~100 视为百分比；更大数值满弧展示原值 */
function resolveQuotaPercent(value: number): { percent: number; rawValue: number } {
  if (!Number.isFinite(value)) return { percent: 0, rawValue: 0 };
  if (value < 0) return { percent: 0, rawValue: value };
  if (value >= 0 && value <= 1) return { percent: value, rawValue: value };
  if (value > 1 && value <= 100) return { percent: value / 100, rawValue: value };
  return { percent: 1, rawValue: value };
}

function aggregateQuotaMetricLocal(rows: unknown[][], columns: string[], metricField: string): number {
  return aggregateQuotaMetric(rows, columns, metricField);
}

function gaugePlan(
  rows: unknown[][],
  columns: string[],
  metricField: string,
  metricLabel?: string | null,
): ChartRenderPlan {
  const value = aggregateQuotaMetricLocal(rows, columns, metricField);
  const { percent, rawValue } = resolveQuotaPercent(value);
  const dimensionLabel = metricLabel?.trim() || metricField;
  return d3Plan("Gauge", {
    percent,
    rawValue,
    dimensionLabel,
  });
}

function liquidPlan(rows: unknown[][], columns: string[], metricField: string): ChartRenderPlan {
  const rawValue = aggregateQuotaMetricLocal(rows, columns, metricField);
  return d3Plan("Liquid", { rawValue, rows, columns, metricField });
}

function kpiPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const metrics = spec.encoding.metrics.map((m) => ({
    field: m.field,
    label: m.label ?? m.field,
  }));
  const labelField = spec.encoding.dimensions[0]?.field;
  return d3Plan("Kpi", { metrics, rows, columns, labelField });
}

function aggregateByDimension(
  spec: RenderSpec,
  rows: unknown[][],
  columns: string[],
  valueMapper: (row: unknown[], di: number, mi: number) => Record<string, string | number>,
): Record<string, string | number>[] {
  const dim = spec.encoding.dimensions[0]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const di = colIndex(columns, dim);
  const mi = colIndex(columns, metric);
  if (di < 0 || mi < 0) return [];

  const map = new Map<string, Record<string, string | number>>();
  for (const row of rows) {
    const key = String(row[di] ?? "");
    const mapped = valueMapper(row, di, mi);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, mapped);
      continue;
    }
    for (const [field, val] of Object.entries(mapped)) {
      if (field === "type" || field === "stage") continue;
      if (typeof val === "number") {
        existing[field] = Number(existing[field] ?? 0) + val;
      }
    }
  }
  return [...map.values()];
}

function funnelPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const data = aggregateByDimension(spec, rows, columns, (row, di, mi) => ({
    stage: String(row[di] ?? ""),
    number: Number(row[mi] ?? 0),
  })).map((row) => ({
    stage: String(row.stage ?? ""),
    number: Number(row.number ?? 0),
  }));
  return d3Plan("Funnel", { data, xField: "stage", yField: "number" });
}

function sankeyPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const src = spec.encoding.dimensions[0]?.field ?? "";
  const dst = spec.encoding.dimensions[1]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const si = colIndex(columns, src);
  const di = colIndex(columns, dst);
  const mi = colIndex(columns, metric);
  const data = rows.map((r) => ({
    source: String(r[si] ?? ""),
    target: String(r[di] ?? ""),
    value: Number(r[mi] ?? 0),
  }));
  return d3Plan("Sankey", { data, sourceField: "source", targetField: "target", weightField: "value" });
}

function graphPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const src = spec.encoding.dimensions[0]?.field ?? "";
  const dst = spec.encoding.dimensions[1]?.field ?? "";
  const metric = spec.encoding.metrics[0]?.field ?? "";
  const graph = aggregateGraphFromRows(rows, columns, src, dst, metric);
  const layout = spec.styleVariant === "dagre" ? "dagre" : "force";
  return d3Plan("ForceGraph", {
    nodes: graph.nodes,
    edges: graph.edges,
    layout: { type: layout },
    graphTruncated: graph.truncated,
  });
}

function heatmapMatrixPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const x = fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0);
  const y = fieldFromAxisOrLegacy(spec, "xAxisExt", 0, "dimension", 1);
  const m = fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0);
  const xi = colIndex(columns, x);
  const yi = colIndex(columns, y);
  const mi = colIndex(columns, m);
  if (xi < 0 || yi < 0 || mi < 0) {
    return errorPlan("热力图缺少横轴、纵轴或指标列", "Heatmap");
  }

  const cellBucket = new Map<string, { x: string; y: string; value: number }>();
  for (const r of rows) {
    const xKey = String(r[xi] ?? "");
    const yKey = String(r[yi] ?? "");
    const raw = Number(r[mi] ?? 0);
    const value = Number.isFinite(raw) ? raw : 0;
    const key = `${xKey}\0${yKey}`;
    const cur = cellBucket.get(key);
    if (cur) {
      cur.value += value;
    } else {
      cellBucket.set(key, { x: xKey, y: yKey, value });
    }
  }

  return d3Plan("Heatmap", { data: [...cellBucket.values()], xField: "x", yField: "y", colorField: "value" });
}

function piePlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
  variant: "default" | "donut" | "rose" | "donut-rose",
): ChartRenderPlan {
  const data = encodePieRows(spec, rows, columns);
  const innerRadius = variant === "donut" || variant === "donut-rose" ? 0.5 : 0;
  return d3Plan("Pie", {
    data,
    angleField: "value",
    colorField: "type",
    radius: PIE_RADIUS_FRAC_DEFAULT,
    innerRadius,
    roseType: variant === "rose" || variant === "donut-rose" ? "radius" : undefined,
  });
}

function cartesianCategoryLevelCount(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
): number | undefined {
  const { categoryFields } = resolveCartesianAxisFields(spec.encoding);
  return categoryFields.length > 1 ? categoryFields.length : undefined;
}

function columnPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
  opts: { horizontal?: boolean; stack?: boolean; group?: boolean; percent?: boolean },
): ChartRenderPlan {
  const enc = encodeCartesianRows(spec, rows, columns, "bar");
  const horizontal = opts.horizontal ?? false;
  const plotType = horizontal ? "Bar" : "Column";
  const categoryLevelCount = cartesianCategoryLevelCount(spec);
  const metricField = spec.encoding.metrics[0]?.field ?? "";
  return d3Plan(plotType, {
    data: enc.data,
    xField: enc.xField,
    yField: enc.yField,
    seriesField: enc.seriesField,
    defaultSeriesName: resolveMetricLabel(spec, metricField),
    isStack: opts.stack ?? false,
    isGroup: opts.group ?? false,
    isPercent: opts.percent ?? false,
    isHorizontal: horizontal,
    ...(categoryLevelCount ? { categoryLevelCount } : {}),
  });
}

function linePlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  vm: ChartViewModel,
  rows: unknown[][],
  columns: string[],
  opts: { area?: boolean; stack?: boolean; smooth?: boolean },
): ChartRenderPlan {
  const enc = encodeCartesianRows(spec, rows, columns, "line");
  const isHorizontal = enc.isHorizontal;
  const categoryLevelCount = cartesianCategoryLevelCount(spec);
  const metricField = spec.encoding.metrics[0]?.field ?? "";
  return d3Plan(isHorizontal ? "Bar" : "Line", {
    data: enc.data,
    xField: enc.xField,
    yField: enc.yField,
    seriesField: enc.seriesField,
    defaultSeriesName: resolveMetricLabel(spec, metricField),
    smooth: opts.smooth ?? vm.styleVariant === "smooth",
    area: opts.area ? {} : undefined,
    isStack: opts.stack ?? false,
    isHorizontal,
    ...(categoryLevelCount ? { categoryLevelCount } : {}),
  });
}

function dualAxesPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
  mode: "default" | "group" | "stack" | "dual-line",
): ChartRenderPlan {
  const categoryLevelCount = cartesianCategoryLevelCount(spec);
  const { columnMetric, lineMetric } = resolveDualAxesMetrics(spec);
  if (!columnMetric && !lineMetric) {
    return errorPlan("柱线组合图至少配置左柱或右线之一", "DualAxes");
  }

  const columnGeom = {
    geometry: "column" as const,
    isGroup: mode === "group",
    isStack: mode === "stack",
  };
  const lineGeom = { geometry: "line" as const };

  if (mode === "dual-line") {
    const leftSub = dualAxesLineSubField(spec, "xAxisExt");
    const rightSub = dualAxesLineSubField(spec, "extBubble");
    const leftEnc = columnMetric
      ? encodeCartesianRows(
          injectSubCategory(
            specWithMetrics(trimSpecToCategoryAxis(spec), [columnMetric]),
            leftSub,
          ),
          rows,
          columns,
          "line",
        )
      : null;
    const rightEnc = lineMetric
      ? encodeCartesianRows(
          injectSubCategory(
            specWithMetrics(trimSpecToCategoryAxis(spec), [lineMetric]),
            rightSub,
          ),
          rows,
          columns,
          "line",
        )
      : null;
    const fallbackEnc = leftEnc ?? rightEnc!;
    const lineLabels = [columnMetric, lineMetric]
      .filter(Boolean)
      .map((field) => resolveMetricLabel(spec, field));
    return d3Plan("DualAxes", {
      data: [leftEnc?.data ?? [], rightEnc?.data ?? []],
      xField: fallbackEnc.xField,
      yField: [leftEnc?.yField ?? fallbackEnc.yField, rightEnc?.yField ?? fallbackEnc.yField],
      lineLabels,
      leftLineSeriesField: leftEnc?.seriesField,
      lineSeriesField: rightEnc?.seriesField,
      geometryOptions: [lineGeom, lineGeom],
      ...(categoryLevelCount ? { categoryLevelCount } : {}),
    });
  }

  const barSub = dualAxesBarSubField(spec, mode);
  const lineSub = dualAxesLineSubField(spec, "extBubble");

  if (columnMetric && !lineMetric) {
    const barEnc = encodeCartesianRows(
      injectSubCategory(specWithMetrics(trimSpecToCategoryAxis(spec), [columnMetric]), barSub),
      rows,
      columns,
      "bar",
    );
    return d3Plan("DualAxes", {
      data: [barEnc.data, []],
      xField: barEnc.xField,
      yField: [barEnc.yField, barEnc.yField],
      lineLabels: [resolveMetricLabel(spec, columnMetric)],
      columnSeriesField: barEnc.seriesField,
      geometryOptions: [columnGeom, lineGeom],
      ...(categoryLevelCount ? { categoryLevelCount } : {}),
    });
  }

  if (!columnMetric && lineMetric) {
    const lineEnc = encodeCartesianRows(
      injectSubCategory(specWithMetrics(trimSpecToCategoryAxis(spec), [lineMetric]), lineSub),
      rows,
      columns,
      "line",
    );
    return d3Plan("DualAxes", {
      data: [[], lineEnc.data],
      xField: lineEnc.xField,
      yField: [lineEnc.yField, lineEnc.yField],
      lineLabels: [resolveMetricLabel(spec, lineMetric)],
      lineSeriesField: lineEnc.seriesField,
      geometryOptions: [columnGeom, lineGeom],
      ...(categoryLevelCount ? { categoryLevelCount } : {}),
    });
  }

  const barEnc = encodeCartesianRows(
    injectSubCategory(specWithMetrics(trimSpecToCategoryAxis(spec), [columnMetric]), barSub),
    rows,
    columns,
    "bar",
  );
  const lineEnc = encodeCartesianRows(
    injectSubCategory(specWithMetrics(trimSpecToCategoryAxis(spec), [lineMetric]), lineSub),
    rows,
    columns,
    "line",
  );
  return d3Plan("DualAxes", {
    data: [barEnc.data, lineEnc.data],
    xField: barEnc.xField,
    yField: [barEnc.yField, lineEnc.yField],
    lineLabels: [columnMetric, lineMetric].map((field) => resolveMetricLabel(spec, field)),
    columnSeriesField: barEnc.seriesField,
    lineSeriesField: lineEnc.seriesField,
    geometryOptions: [columnGeom, lineGeom],
    ...(categoryLevelCount ? { categoryLevelCount } : {}),
  });
}

export function bidirectionalBarPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const dim = fieldFromAxisOrLegacy(spec, "xAxis", 0, "dimension", 0);
  const leftField = fieldFromAxisOrLegacy(spec, "yAxis", 0, "metric", 0);
  const rightField = fieldFromAxisOrLegacy(spec, "yAxisExt", 0, "metric", 1) || leftField;
  const di = colIndex(columns, dim);
  const li = colIndex(columns, leftField);
  const ri = colIndex(columns, rightField);
  if (di < 0 || li < 0) return errorPlan("双向条形图缺少维度或指标列", "BidirectionalBar");

  const map = new Map<string, { type: string; left: number; right: number }>();
  for (const row of rows) {
    const key = String(row[di] ?? "");
    const cur = map.get(key) ?? { type: key, left: 0, right: 0 };
    cur.left += Number(row[li] ?? 0);
    if (ri >= 0) cur.right += Number(row[ri] ?? 0);
    map.set(key, cur);
  }
  return d3Plan("BidirectionalBar", { data: [...map.values()] });
}

function bulletGraphPlanWrapper(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  return bulletGraphPlan(spec, rows, columns);
}

function progressBarPlanWrapper(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  return progressBarPlan(spec, rows, columns);
}

function basicScatterPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const dimField = spec.encoding.dimensions[0]?.field ?? "";
  const yField = spec.encoding.metrics[0]?.field ?? "";
  const bubbleField = spec.encoding.metrics[1]?.field;
  const di = colIndex(columns, dimField);
  const yi = colIndex(columns, yField);
  if (di < 0 || yi < 0) return errorPlan("散点图缺少维度或指标列", "Scatter");

  const categories = [...new Set(rows.map((r) => String(r[di] ?? "")))];
  const bi = bubbleField ? colIndex(columns, bubbleField) : -1;

  const data = rows.map((r) => {
    const category = String(r[di] ?? "");
    return {
      x: category,
      y: Number(r[yi] ?? 0),
      series: category,
      ...(bi >= 0 ? { size: Number(r[bi] ?? 0) } : {}),
    };
  });

  return d3Plan("Scatter", {
    data,
    xField: "x",
    yField: "y",
    colorField: "series",
    sizeField: bi >= 0 ? "size" : undefined,
    xAxisMode: "category",
    xCategories: categories,
  });
}

function xyScatterPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const metrics = spec.encoding.metrics.map((m) => m.field).filter(Boolean);
  const xField = metrics[0] ?? "";
  const yField = metrics[1] ?? metrics[0] ?? "";
  const bubbleField = spec.encoding.metrics[2]?.field;
  const seriesField = spec.encoding.dimensions[0]?.field ?? "";
  const xi = colIndex(columns, xField);
  const yi = colIndex(columns, yField);
  if (xi < 0 || yi < 0) return errorPlan("散点图缺少指标列", "Scatter");
  const di = seriesField ? colIndex(columns, seriesField) : -1;
  const bi = bubbleField ? colIndex(columns, bubbleField) : -1;
  const data = rows.map((r) => ({
    x: Number(r[xi] ?? 0),
    y: Number(r[yi] ?? 0),
    ...(seriesField && di >= 0 ? { series: String(r[di] ?? "") } : {}),
    ...(bi >= 0 ? { size: Number(r[bi] ?? 0) } : {}),
  }));
  return d3Plan("Scatter", {
    data,
    xField: "x",
    yField: "y",
    colorField: seriesField && di >= 0 ? "series" : undefined,
    sizeField: bi >= 0 ? "size" : undefined,
  });
}

function scatterPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  return basicScatterPlan(spec, rows, columns);
}

function quadrantPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const base = xyScatterPlan(spec, rows, columns);
  if (base.empty) return base;
  return { ...base, plotType: "Quadrant" };
}

function multiScatterPlan(
  spec: ReturnType<typeof chartViewModelToRenderSpec>,
  rows: unknown[][],
  columns: string[],
): ChartRenderPlan {
  const axes = spec.encoding.axes ?? {};
  const colorField =
    axes.extColor?.[0]?.field?.trim() ?? spec.encoding.dimensions[0]?.field ?? "";
  const xAxisField =
    axes.xAxis?.[0]?.field?.trim() ??
    spec.encoding.metrics[1]?.field ??
    spec.encoding.dimensions[1]?.field ??
    "";
  const yField = axes.yAxis?.[0]?.field?.trim() ?? spec.encoding.metrics[0]?.field ?? "";
  const lightnessField =
    axes.yAxisExt?.[0]?.field?.trim() ?? spec.encoding.metrics[2]?.field;
  const bubbleField =
    axes.extBubble?.[0]?.field?.trim() ?? spec.encoding.metrics[3]?.field;
  const ci = colIndex(columns, colorField);
  const yi = colIndex(columns, yField);
  if (ci < 0 || yi < 0) return errorPlan("多维散点图缺少颜色维度或 Y 轴指标", "Scatter");
  if (!xAxisField) return errorPlan("多维散点图缺少 X 轴字段", "Scatter");

  const xi = colIndex(columns, xAxisField);
  if (xi < 0) return errorPlan("多维散点图缺少 X 轴字段", "Scatter");

  const li = lightnessField ? colIndex(columns, lightnessField) : -1;
  const bi = bubbleField ? colIndex(columns, bubbleField) : -1;
  const xIsNumeric = rows.some((r) => {
    const v = r[xi];
    return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)));
  });

  const data = rows.map((r) => ({
    x: xIsNumeric ? Number(r[xi] ?? 0) : String(r[xi] ?? ""),
    y: Number(r[yi] ?? 0),
    series: String(r[ci] ?? ""),
    ...(li >= 0 ? { lightness: Number(r[li] ?? 0) } : {}),
    ...(bi >= 0 ? { size: Number(r[bi] ?? 0) } : {}),
  }));

  const xCategories = xIsNumeric
    ? undefined
    : [...new Set(data.map((d) => String(d.x)))];

  return d3Plan("Scatter", {
    data,
    xField: "x",
    yField: "y",
    colorField: "series",
    sizeField: bi >= 0 ? "size" : undefined,
    ...(xCategories ? { xAxisMode: "category", xCategories } : {}),
  });
}

function d3TablePlan(type: string, vm: ChartViewModel): ChartRenderPlan {
  const spec = chartViewModelToRenderSpec(vm);
  const { rows: capped } = capRows(vm.dataset.rows, ADVANCED_CHART_ROW_CAP);
  const plotType =
    type === "table-pivot" ? "TablePivot" : type === "table-normal" ? "TableNormal" : "TableInfo";
  return d3Plan(plotType, { rows: capped, columns: vm.dataset.columns, spec });
}

export function buildPlanForType(chartType: string, vm: ChartViewModel): ChartRenderPlan {
  const spec = chartViewModelToRenderSpec(vm);
  const rowCap = chartType === "graph" ? GRAPH_CHART_ROW_CAP : ADVANCED_CHART_ROW_CAP;
  const { rows: capped } = capRows(vm.dataset.rows, rowCap);
  const columns = vm.dataset.columns;

  if (capped.length === 0 && chartType !== "map" && chartType !== "map-3d" && chartType !== "gis-map") {
    return emptyPlan();
  }

  switch (chartType) {
    case "line":
      return linePlan(spec, vm, capped, columns, {
        smooth: vm.styleVariant === "smooth",
        area: vm.styleVariant === "area",
      });
    case "area":
      return linePlan(spec, vm, capped, columns, { area: true });
    case "area-stack":
      return linePlan(spec, vm, capped, columns, { area: true, stack: true });
    case "bar":
      return columnPlan(spec, capped, columns, {});
    case "bar-stack":
      return columnPlan(spec, capped, columns, { stack: true });
    case "bar-group":
      return columnPlan(spec, capped, columns, { group: true });
    case "bar-group-stack":
      return columnPlan(spec, capped, columns, { stack: true, group: true });
    case "percentage-bar-stack":
      return columnPlan(spec, capped, columns, { stack: true, percent: true });
    case "bar-horizontal":
      return columnPlan(spec, capped, columns, { horizontal: true });
    case "bar-stack-horizontal":
      return columnPlan(spec, capped, columns, { horizontal: true, stack: true });
    case "percentage-bar-stack-horizontal":
      return columnPlan(spec, capped, columns, { horizontal: true, stack: true, percent: true });
    case "bar-range":
      return barRangePlan(spec, capped, columns);
    case "progress-bar":
      return progressBarPlanWrapper(spec, capped, columns);
    case "bullet-graph":
      return bulletGraphPlanWrapper(spec, capped, columns);
    case "stock-line":
      return stockLinePlan(spec, capped, columns);
    case "pie":
      return piePlan(spec, capped, columns, "default");
    case "pie-donut":
      return piePlan(spec, capped, columns, "donut");
    case "pie-rose":
      return piePlan(spec, capped, columns, "rose");
    case "pie-donut-rose":
      return piePlan(spec, capped, columns, "donut-rose");
    case "gauge":
      const gaugeMetric = spec.encoding.metrics[0];
      return gaugePlan(capped, columns, gaugeMetric?.field ?? "", gaugeMetric?.label);
    case "liquid":
      return liquidPlan(capped, columns, spec.encoding.metrics[0]?.field ?? "");
    case "kpi":
      return kpiPlan(spec, capped, columns);
    case "funnel":
      return funnelPlan(spec, capped, columns);
    case "sankey":
      return sankeyPlan(spec, capped, columns);
    case "graph":
      return graphPlan(spec, capped, columns);
    case "scatter":
      return scatterPlan(spec, capped, columns);
    case "quadrant":
      return quadrantPlan(spec, capped, columns);
    case "multi-scatter":
      return multiScatterPlan(spec, capped, columns);
    case "chart-mix":
      return dualAxesPlan(spec, capped, columns, "default");
    case "chart-mix-group":
      return dualAxesPlan(spec, capped, columns, "group");
    case "chart-mix-stack":
      return dualAxesPlan(spec, capped, columns, "stack");
    case "chart-mix-dual-line":
      return dualAxesPlan(spec, capped, columns, "dual-line");
    case "t-heatmap":
    case "heatmap":
      return heatmapMatrixPlan(spec, capped, columns);
    case "map":
    case "map-3d":
      return d3Plan("Choropleth", { rows: capped, columns, spec });
    case "gis-map":
      return d3Plan("GisMap", { rows: capped, columns, spec });
    case "table-info":
    case "table-normal":
    case "table-pivot":
      return d3TablePlan(chartType, vm);
    case "radar":
      return d3Plan("Radar", { data: encodePieRows(spec, capped, columns), xField: "type", yField: "value" });
    case "treemap":
      return d3Plan("Treemap", {
        data: encodePieRows(spec, capped, columns).map((d) => ({ name: d.type, value: d.value })),
        colorField: "name",
      });
    case "circle-packing":
      return d3Plan("CirclePacking", {
        data: encodePieRows(spec, capped, columns).map((d) => ({ name: d.type, value: d.value })),
        sizeField: "value",
      });
    case "word-cloud":
    case "wordCloud":
      return d3Plan("WordCloud", {
        data: encodePieRows(spec, capped, columns).map((d) => ({ word: d.type, weight: d.value })),
        wordField: "word",
        weightField: "weight",
      });
    case "bidirectional-bar":
      return bidirectionalBarPlan(spec, capped, columns);
    case "waterfall":
      return d3Plan("Waterfall", {
        data: encodePieRows(spec, capped, columns).map((d) => ({ type: d.type, value: d.value })),
      });
    case "timeline":
      return linePlan(spec, vm, capped, columns, { smooth: vm.styleVariant === "smooth" });
    case "combo":
      return dualAxesPlan(spec, capped, columns, "default");
    default:
      return errorPlan(`未支持的图表类型: ${chartType}`);
  }
}
