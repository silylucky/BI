import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mapApiError } from "@/lib/apiError";
import {
  fetchDatasetQueryConfig,
  persistDatasetBind,
} from "@/lib/datasetChartBinding";
import {
  filterSyncJobBindDatasources,
  resolveAnalyticsDatasourceId,
} from "@/lib/datasourceRoles";
import { formatSyncDatasourceDisplay } from "@/lib/formatDatasourceDisplay";
import { tablesMatchForBind } from "@/lib/datasetTableUtils";
import { queryKeys } from "@/lib/queryKeys";
import { apiFetch } from "@/lib/api";
import type { DatasetBindDraft, DatasetOrigin, DatasetTable } from "../types";
import { useDatasetWorkbenchColumns } from "../hooks/useDatasetWorkbenchColumns";
import {
  bindDraftFromBinding,
  EMPTY_BIND_DRAFT,
  seedBindDraftFromColumns,
} from "./datasetFieldWorkbenchState";
import { DatasetFieldWorkbench } from "./DatasetFieldWorkbench";

type DsItem = {
  id: string;
  name: string;
  code?: string;
  type: string;
  host?: string;
  port?: number;
  database?: string;
};

/** 独立绑定面板（报表指标页等）；Dataset 编辑页请用 TablePicker 内嵌 Workbench。 */
export function DatasetBindPanel({
  datasetId,
  tables,
  boundConfigId,
  tableSourceDataSourceId,
  origin = "manual",
  syncJobId,
  onBound,
}: {
  datasetId: string;
  tables: DatasetTable[];
  boundConfigId?: string | null;
  tableSourceDataSourceId?: string;
  origin?: DatasetOrigin;
  syncJobId?: string | null;
  onBound: (boundConfigId: string) => void;
}) {
  const isSyncOrigin = origin === "sync_job";
  const queryClient = useQueryClient();
  const primaryTableName = tables[0]?.name ?? "";
  const seedKeyRef = useRef("");
  const [bindDraft, setBindDraft] = useState<DatasetBindDraft>(EMPTY_BIND_DRAFT);
  const [saving, setSaving] = useState(false);

  const dsQuery = useQuery({
    queryKey: queryKeys.datasources.list({ includeManaged: true }),
    queryFn: () => apiFetch<{ items: DsItem[] }>("/api/v1/datasources?includeManaged=true"),
  });

  const boundConfigQuery = useQuery({
    queryKey: ["query-config", boundConfigId ?? ""],
    queryFn: () => fetchDatasetQueryConfig(boundConfigId!),
    enabled: Boolean(boundConfigId),
  });

  const allItems = dsQuery.data?.items ?? [];
  const selectableItems = useMemo(
    () => (isSyncOrigin ? filterSyncJobBindDatasources(allItems) : allItems),
    [allItems, isSyncOrigin],
  );

  const dataSourceId = useMemo(() => {
    const boundId = boundConfigQuery.data?.dataSourceId;
    if (boundId) return boundId;
    const preferred = tableSourceDataSourceId ?? undefined;
    const candidates = selectableItems.length > 0 ? selectableItems : allItems;
    return resolveAnalyticsDatasourceId(candidates, preferred);
  }, [
    allItems,
    boundConfigQuery.data?.dataSourceId,
    selectableItems,
    tableSourceDataSourceId,
  ]);

  const activeDs = useMemo(() => {
    return allItems.find((d) => d.id === dataSourceId) ?? selectableItems.find((d) => d.id === dataSourceId);
  }, [allItems, dataSourceId, selectableItems]);

  const syncDatasourceDisplay = useMemo(
    () => (activeDs ? formatSyncDatasourceDisplay(activeDs) : null),
    [activeDs],
  );

  const { columnNames, columnsLoading, columnsError } = useDatasetWorkbenchColumns(
    dataSourceId,
    primaryTableName,
    boundConfigQuery.data,
  );

  useEffect(() => {
    if (!primaryTableName) return;
    if (boundConfigId && boundConfigQuery.isLoading) return;

    const bound = boundConfigQuery.data;
    const seedKey = `${primaryTableName}:${boundConfigId ?? "none"}:${columnNames.join(",")}`;
    if (seedKeyRef.current === seedKey) return;
    seedKeyRef.current = seedKey;

    if (bound?.columns?.length && boundConfigId && tablesMatchForBind(primaryTableName, bound.schema, bound.table)) {
      setBindDraft(bindDraftFromBinding(bound.columns, bound.columnKinds));
      return;
    }

    if (columnsLoading) return;

    if (columnNames.length > 0) {
      setBindDraft(seedBindDraftFromColumns(columnNames, null));
    }
  }, [
    boundConfigId,
    boundConfigQuery.data,
    boundConfigQuery.isLoading,
    columnNames,
    columnsLoading,
    primaryTableName,
  ]);

  const handleSaveBind = async () => {
    if (!dataSourceId || !primaryTableName || bindDraft.selectedColumns.length === 0) {
      toast.error("请选择至少一个出图字段");
      return;
    }
    setSaving(true);
    try {
      const bindResult = await persistDatasetBind({
        datasetId,
        boundConfigId,
        dataSourceId,
        connectorType: activeDs?.type || "postgresql",
        tableName: primaryTableName,
        selectedColumns: bindDraft.selectedColumns,
        columnKinds: bindDraft.columnKinds,
      });
      await queryClient.invalidateQueries({ queryKey: ["query-config"] });
      seedKeyRef.current = "";
      toast.success(`出图字段已更新（${bindDraft.selectedColumns.length} 列）`);
      onBound(bindResult.configId);
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (tables.length === 0) return null;

  return (
    <div className="grid gap-3">
      <DatasetFieldWorkbench
        dataSourceId={dataSourceId}
        connectorType={activeDs?.type || "postgresql"}
        tableName={primaryTableName}
        columnNames={columnNames}
        columnsLoading={columnsLoading}
        columnsError={columnsError}
        bindDraft={bindDraft}
        onBindDraftChange={setBindDraft}
        boundConfigId={boundConfigId}
        origin={origin}
        syncJobId={syncJobId}
        syncDataSourceName={syncDatasourceDisplay?.name}
        syncDataSourceEndpoint={syncDatasourceDisplay?.endpoint}
        onRefreshBinding={() => {
          if (boundConfigId) onBound(boundConfigId);
        }}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={saving || bindDraft.selectedColumns.length === 0}
          loading={saving}
          loadingText="保存中…"
          onClick={() => void handleSaveBind()}
        >
          保存出图字段
        </Button>
      </div>
    </div>
  );
}
