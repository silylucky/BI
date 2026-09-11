import type { BuildTableModelInput, PivotTableModel, TableColumnMeta, TableDetailModel, TableModel } from "@/components/charts/engine/d3/table/types";
import { resolveEncodingFieldLabel } from "@/lib/chartFieldLabels";

function resolveFields(spec: BuildTableModelInput["spec"], columns: string[]) {
  const axisColumnFields = (spec.encoding.axes?.xAxis ?? [])
    .map((ref) => ref.field?.trim())
    .filter((field): field is string => Boolean(field));
  const dimFields = spec.encoding.dimensions
    .map((d) => d.field)
    .filter((field): field is string => Boolean(field?.trim()));
  const metricFields = spec.encoding.metrics
    .map((m) => m.field)
    .filter((field): field is string => Boolean(field?.trim()));
  const fallbackFields =
    axisColumnFields.length > 0
      ? axisColumnFields
      : dimFields.length + metricFields.length > 0
        ? [...dimFields, ...metricFields]
        : columns;
  return { dimFields, metricFields, fallbackFields };
}

function columnMeta(spec: BuildTableModelInput["spec"], fields: string[]): TableColumnMeta[] {
  return fields.map((field) => ({
    field,
    label: resolveEncodingFieldLabel(spec.encoding, field),
  }));
}

function toNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number.parseFloat(String(raw ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildDetailTableModel(input: BuildTableModelInput): TableDetailModel {
  const { fallbackFields } = resolveFields(input.spec, input.columns);
  return {
    kind: "detail",
    columns: fallbackFields,
    columnMeta: columnMeta(input.spec, fallbackFields),
    rows: input.rows,
  };
}

export function buildPivotTableModel(
  input: BuildTableModelInput,
  options?: { showRowTotal?: boolean; showColTotal?: boolean },
): PivotTableModel {
  const { dimFields, metricFields, fallbackFields } = resolveFields(input.spec, input.columns);
  const rowField = dimFields[0] ?? "";
  const colField = dimFields[1] ?? "";
  const metrics = (metricFields.length ? metricFields : fallbackFields.slice(-1)).map((field) => {
    const metric = input.spec.encoding.metrics.find((m) => m.field === field);
    return {
      field,
      label: metric?.label?.trim() || resolveEncodingFieldLabel(input.spec.encoding, field),
    };
  });

  const rowIdx = input.columns.indexOf(rowField);
  const colIdx = input.columns.indexOf(colField);
  const metricIndices = Object.fromEntries(
    metrics.map((m) => [m.field, input.columns.indexOf(m.field)]),
  );

  const rowKeys: string[] = [];
  const colKeys: string[] = [];
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const cells: PivotTableModel["cells"] = {};

  const ensure = (rowKey: string, colKey: string) => {
    if (!cells[rowKey]) cells[rowKey] = {};
    if (!cells[rowKey][colKey]) cells[rowKey][colKey] = {};
    return cells[rowKey][colKey];
  };

  for (const row of input.rows) {
    const rk = String(rowIdx >= 0 ? row[rowIdx] ?? "" : "");
    const ck = String(colIdx >= 0 ? row[colIdx] ?? "" : "");
    if (!rowSet.has(rk)) {
      rowSet.add(rk);
      rowKeys.push(rk);
    }
    if (!colSet.has(ck)) {
      colSet.add(ck);
      colKeys.push(ck);
    }
    const bucket = ensure(rk, ck);
    for (const metric of metrics) {
      const mi = metricIndices[metric.field];
      const val = mi >= 0 ? toNumber(row[mi]) : 0;
      bucket[metric.field] = (bucket[metric.field] ?? 0) + val;
    }
  }

  const rowDim = input.spec.encoding.dimensions.find((d) => d.field === rowField);
  const colDim = input.spec.encoding.dimensions.find((d) => d.field === colField);

  return {
    kind: "pivot",
    rowField,
    rowLabel: rowDim?.label?.trim() || resolveEncodingFieldLabel(input.spec.encoding, rowField),
    colField,
    colLabel: colDim?.label?.trim() || resolveEncodingFieldLabel(input.spec.encoding, colField),
    metrics,
    rowKeys,
    colKeys,
    cells,
    showRowTotal: options?.showRowTotal !== false,
    showColTotal: options?.showColTotal !== false,
  };
}

export function buildTableModel(input: BuildTableModelInput): TableModel {
  if (input.plotType === "table-pivot") {
    return buildPivotTableModel(input);
  }
  return buildDetailTableModel(input);
}
