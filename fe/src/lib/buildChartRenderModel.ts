import { isGeoMapChartType, isGisMapChartType } from "@/lib/chartViewConfig";
import { isLegacyTableChartType } from "@/lib/chartViewConfig";
import { isChartExecuteReady } from "@/lib/chartExecuteProbe";
import { activeFieldRefs } from "@/lib/chartConfigState";
import { deAxisRenderReady, resolveChartEncoding } from "@/lib/resolveChartEncoding";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

export type ChartRenderModel =
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "table"; displayCols: string[] }
  | { kind: "ready" };

export function parseMetricValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateFieldColumns(
  columns: string[],
  dims: ReturnType<typeof activeFieldRefs>,
  metrics: ReturnType<typeof activeFieldRefs>,
): ChartRenderModel | null {
  for (const dim of dims) {
    if (!columns.includes(dim.field)) {
      return { kind: "error", message: `维度列「${dim.field}」不存在，请检查字段配置` };
    }
  }
  for (const metric of metrics) {
    if (!columns.includes(metric.field)) {
      return { kind: "error", message: `指标列「${metric.field}」不存在，请检查字段配置` };
    }
  }
  return null;
}

function readyWhenRows(rows: unknown[][]): ChartRenderModel {
  if (rows.length === 0) return { kind: "empty" };
  return { kind: "ready" };
}

function pickColumns(columns: string[], fields: string[]): string[] {
  if (!fields.length) return columns;
  return fields.filter((f) => columns.includes(f));
}

export function buildChartRenderModel(
  config: ChartViewConfig,
  columns: string[],
  rows: (string | number | boolean | null)[][],
): ChartRenderModel {
  const encoding = resolveChartEncoding(config);
  const dims = encoding.dimensions;
  const metrics = encoding.metrics;

  if (isLegacyTableChartType(config.chartType)) {
    const fields = [...dims.map((d) => d.field), ...metrics.map((m) => m.field)];
    const displayCols = pickColumns(columns, fields);
    if (rows.length === 0) return { kind: "empty" };
    return { kind: "table", displayCols: displayCols.length ? displayCols : columns };
  }

  if (
    config.chartType === "table-info" ||
    config.chartType === "table-normal" ||
    config.chartType === "table-pivot"
  ) {
    if (!deAxisRenderReady(config)) {
      if (config.chartType === "table-normal") {
        if (!dims.length) return { kind: "error", message: "请配置维度字段" };
        return { kind: "error", message: "请配置指标字段" };
      }
      if (config.chartType === "table-pivot") {
        if (!dims.length) return { kind: "error", message: "请配置行维度" };
        return { kind: "error", message: "请配置指标字段" };
      }
      return { kind: "error", message: "请配置数据列" };
    }
    for (const field of [...dims, ...metrics].map((f) => f.field)) {
      if (field && !columns.includes(field)) {
        return { kind: "error", message: `列「${field}」不存在，请检查字段配置` };
      }
    }
    if (rows.length === 0) return { kind: "empty" };
    return { kind: "ready" };
  }

  if (config.chartType === "kpi" || config.chartType === "gauge" || config.chartType === "liquid") {
    if (!metrics.length) return { kind: "error", message: "请配置指标字段" };
    const columnError = validateFieldColumns(columns, dims, metrics);
    if (columnError) return columnError;
    return readyWhenRows(rows);
  }

  if (isGisMapChartType(config.chartType)) {
    if (isChartExecuteReady(config)) {
      const lngField = dims[0]?.field;
      const latField = dims[1]?.field;
      if (lngField && latField) {
        if (!columns.includes(lngField)) {
          return { kind: "error", message: `经度列「${lngField}」不存在，请检查字段配置` };
        }
        if (!columns.includes(latField)) {
          return { kind: "error", message: `纬度列「${latField}」不存在，请检查字段配置` };
        }
        if (metrics.length && !columns.includes(metrics[0]!.field)) {
          return { kind: "error", message: `指标列「${metrics[0]!.field}」不存在，请检查字段配置` };
        }
      }
      if (rows.length === 0) return { kind: "ready" };
      return { kind: "ready" };
    }
    return { kind: "ready" };
  }

  if (isGeoMapChartType(config.chartType)) {
    const regionDim = dims[0]?.field;
    if (!regionDim) return { kind: "error", message: "请配置地理维度字段" };
    if (!metrics.length) return { kind: "error", message: "请配置指标字段" };
    if (!columns.includes(regionDim)) {
      return { kind: "error", message: `维度列「${regionDim}」不存在，请检查字段配置` };
    }
    for (const metric of metrics) {
      if (!columns.includes(metric.field)) {
        return { kind: "error", message: `指标列「${metric.field}」不存在，请检查字段配置` };
      }
    }
    if (rows.length === 0) return { kind: "empty" };
    return { kind: "ready" };
  }

  if (config.chartType === "sankey") {
    const src = dims[0]?.field;
    const dst = dims[1]?.field;
    if (!src || !dst) return { kind: "error", message: "请配置起止维度字段" };
    if (!metrics.length) return { kind: "error", message: "请配置指标字段" };
    const columnError = validateFieldColumns(columns, dims.slice(0, 2), metrics);
    if (columnError) return columnError;
    return readyWhenRows(rows);
  }

  if (config.chartType === "graph") {
    const src = dims[0]?.field;
    const dst = dims[1]?.field;
    if (!src || !dst) return { kind: "error", message: "请配置起止维度字段" };
    const columnError = validateFieldColumns(columns, dims.slice(0, 2), metrics);
    if (columnError) return columnError;
    return readyWhenRows(rows);
  }

  if (!deAxisRenderReady(config)) {
    return { kind: "error", message: "请完成必填字段轴配置" };
  }

  const columnError = validateFieldColumns(columns, dims, metrics);
  if (columnError) return columnError;
  return readyWhenRows(rows);
}
