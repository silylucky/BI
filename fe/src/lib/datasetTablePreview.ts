import { apiFetch } from "@/lib/api";

export type TablePreviewResult = {
  columns: string[];
  rows: (string | number | boolean | null)[][];
};

export async function fetchTablePreview(params: {
  dataSourceId: string;
  schema: string;
  table: string;
  columns?: string[];
  limit?: number;
}): Promise<TablePreviewResult> {
  const limit = params.limit ?? 20;
  const resp = await apiFetch<{
    columns: string[];
    rows: (string | number | boolean | null)[][];
  }>("/api/v1/query/execute", {
    method: "POST",
    body: JSON.stringify({
      dataSourceId: params.dataSourceId,
      mode: "table",
      schema: params.schema,
      table: params.table,
      limit,
      offset: 0,
    }),
  });
  const columns = Array.isArray(resp.columns) ? resp.columns : [];
  const rows = Array.isArray(resp.rows) ? resp.rows : [];
  if (!params.columns?.length) {
    return { columns, rows };
  }
  const pick = new Set(params.columns);
  const indices = columns.map((c, i) => (pick.has(c) ? i : -1)).filter((i) => i >= 0);
  return {
    columns: indices.map((i) => columns[i]),
    rows: rows.map((row) => indices.map((i) => row[i] ?? null)),
  };
}
