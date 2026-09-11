import type { RenderSpec } from "@/components/charts/engine/types";

export type TableColumnMeta = {
  field: string;
  label: string;
};

export type TableDetailModel = {
  kind: "detail";
  columns: string[];
  columnMeta: TableColumnMeta[];
  rows: unknown[][];
};

export type PivotMetric = {
  field: string;
  label: string;
};

export type PivotTableModel = {
  kind: "pivot";
  rowField: string;
  rowLabel: string;
  colField: string;
  colLabel: string;
  metrics: PivotMetric[];
  rowKeys: string[];
  colKeys: string[];
  /** rowKey → colKey → metricField → aggregated value */
  cells: Record<string, Record<string, Record<string, number>>>;
  showRowTotal: boolean;
  showColTotal: boolean;
};

export type TableModel = TableDetailModel | PivotTableModel;

export type BuildTableModelInput = {
  plotType: string;
  rows: unknown[][];
  columns: string[];
  spec: RenderSpec;
};
