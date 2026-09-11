import { ReportResultTable } from "./ReportResultTable";

type CrosstabSection = {
  colLabels?: string[];
  rowLabels?: string[];
  matrix?: unknown[][];
};

export function crosstabSectionToTable(section: CrosstabSection): {
  columns: string[];
  rows: unknown[][];
} {
  const colLabels = (section.colLabels ?? []).map(String);
  const rowLabels = (section.rowLabels ?? []).map(String);
  const matrix = section.matrix ?? [];
  const columns = ["", ...colLabels];
  const rows = rowLabels.map((label, index) => [
    label,
    ...(matrix[index] ?? []).map((cell) => cell ?? ""),
  ]);
  return { columns, rows };
}

export function ReportCrosstabResultTable({ section }: { section: CrosstabSection }) {
  const { columns, rows } = crosstabSectionToTable(section);
  return <ReportResultTable columns={columns} rows={rows} />;
}
