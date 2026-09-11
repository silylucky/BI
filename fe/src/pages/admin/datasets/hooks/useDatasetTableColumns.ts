import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { parseQualifiedTable } from "@/lib/datasetTableUtils";
import { queryKeys } from "@/lib/queryKeys";

export function useDatasetTableColumns(dataSourceId: string, tableName: string) {
  const parsed = useMemo(
    () => (tableName ? parseQualifiedTable(tableName) : { schema: "", table: "" }),
    [tableName],
  );

  const columnsQuery = useQuery({
    queryKey: queryKeys.datasources.columns(dataSourceId, parsed.schema, parsed.table),
    queryFn: () =>
      apiFetch<{ items: Array<{ name: string }> }>(
        `/api/v1/datasources/${dataSourceId}/columns?schema=${encodeURIComponent(parsed.schema)}&table=${encodeURIComponent(parsed.table)}`,
      ),
    enabled: Boolean(dataSourceId && parsed.table),
    staleTime: 60_000,
  });

  const columnNames = useMemo(
    () => (columnsQuery.data?.items ?? []).map((c) => c.name),
    [columnsQuery.data?.items],
  );

  return {
    columnNames,
    columnsLoading: columnsQuery.isLoading && columnNames.length === 0,
    columnsError: columnsQuery.isError ? columnsQuery.error : null,
    parsed,
  };
}
