import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { parseQualifiedTable } from "@/lib/datasetTableUtils";
import { resolveSyncSourceSchema } from "../components/syncSourceTablePicker";
import { queryKeys } from "@/lib/queryKeys";
import type { EtlColumnMeta } from "../etlRuleSuggest";

type SyncJobSourceMeta = {
  source_data_source_id?: string | null;
  source_type?: string;
  source?: {
    table?: string;
    database?: string;
    schema?: string | null;
    type?: string;
  };
};

function resolveSourceTableParts(job: SyncJobSourceMeta | undefined) {
  const rawTable = job?.source?.table?.trim() ?? "";
  if (!rawTable) return { schema: "", table: "" };
  if (rawTable.includes(".")) {
    const parsed = parseQualifiedTable(rawTable);
    return { schema: parsed.schema, table: parsed.table };
  }
  const explicitSchema = job?.source?.schema?.trim();
  if (explicitSchema) {
    return { schema: explicitSchema, table: rawTable };
  }
  return {
    schema: job?.source?.database?.trim() ?? "",
    table: rawTable,
  };
}

export function useSyncJobSourceColumns(jobId: string | undefined) {
  const jobQuery = useQuery({
    queryKey: ["sync-job", jobId, "etl-source"],
    queryFn: () => apiFetch<SyncJobSourceMeta>(`/api/v1/ingestion/sync-jobs/${jobId}`),
    enabled: Boolean(jobId),
    staleTime: 60_000,
  });

  const dataSourceId = jobQuery.data?.source_data_source_id?.trim() ?? "";
  const { schema: parsedSchema, table } = useMemo(
    () => resolveSourceTableParts(jobQuery.data),
    [jobQuery.data],
  );

  const schemasQuery = useQuery({
    queryKey: queryKeys.datasources.schemas(dataSourceId),
    queryFn: () =>
      apiFetch<{ items: Array<{ name: string }> }>(
        `/api/v1/datasources/${dataSourceId}/schemas`,
      ),
    enabled: Boolean(dataSourceId),
    staleTime: 60_000,
  });

  const schema = useMemo(() => {
    if (parsedSchema) return parsedSchema;
    const names = (schemasQuery.data?.items ?? []).map((item) => item.name);
    return resolveSyncSourceSchema(
      names,
      jobQuery.data?.source?.database,
      jobQuery.data?.source?.type ?? jobQuery.data?.source_type,
    );
  }, [
    jobQuery.data?.source?.database,
    jobQuery.data?.source?.type,
    jobQuery.data?.source_type,
    parsedSchema,
    schemasQuery.data?.items,
  ]);

  const columnsQuery = useQuery({
    queryKey: queryKeys.datasources.columns(dataSourceId, schema, table),
    queryFn: () =>
      apiFetch<{ items: Array<{ name: string; dataType?: string }> }>(
        `/api/v1/datasources/${dataSourceId}/columns?schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`,
      ),
    enabled: Boolean(dataSourceId && table),
    staleTime: 60_000,
  });

  const columns: EtlColumnMeta[] = useMemo(
    () =>
      (columnsQuery.data?.items ?? []).map((item) => ({
        name: item.name,
        dataType: item.dataType,
      })),
    [columnsQuery.data?.items],
  );

  const columnNames = useMemo(() => columns.map((col) => col.name), [columns]);

  return {
    sourceTable: table,
    columnNames,
    columns,
    columnsLoading: jobQuery.isLoading || columnsQuery.isLoading,
    columnsReady: Boolean(dataSourceId && table && columnsQuery.isSuccess),
    hasDataSource: Boolean(dataSourceId),
  };
}
