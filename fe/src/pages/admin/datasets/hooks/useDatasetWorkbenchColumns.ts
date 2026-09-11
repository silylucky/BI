import { useMemo } from "react";
import type { DatasetChartBinding } from "@/lib/datasetChartBinding";
import { resolveMetadataTableName } from "@/lib/datasetTableUtils";
import { useDatasetTableColumns } from "./useDatasetTableColumns";

/** 字段工作台列名：优先实时元数据，失败时回退到已保存的绑定列。 */
export function useDatasetWorkbenchColumns(
  dataSourceId: string,
  datasetTableName: string,
  boundConfig?: Pick<DatasetChartBinding, "schema" | "table" | "columns"> | null,
) {
  const metadataTableName = useMemo(
    () => resolveMetadataTableName(datasetTableName, boundConfig?.schema, boundConfig?.table),
    [boundConfig?.schema, boundConfig?.table, datasetTableName],
  );

  const live = useDatasetTableColumns(dataSourceId, metadataTableName);

  const columnNames = useMemo(() => {
    if (live.columnNames.length > 0) return live.columnNames;
    return boundConfig?.columns ?? [];
  }, [boundConfig?.columns, live.columnNames]);

  const columnsLoading = live.columnsLoading && columnNames.length === 0;
  const columnsError = columnNames.length === 0 ? live.columnsError : null;

  return {
    columnNames,
    columnsLoading,
    columnsError,
    metadataTableName,
  };
}
