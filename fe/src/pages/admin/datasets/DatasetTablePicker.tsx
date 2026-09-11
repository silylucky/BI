import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SchemaBrowser } from "@/components/datasources/SchemaBrowser";
import {
  qualifiedTableName,
  type TableSelection,
} from "@/components/datasources/schemaBrowserUtils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { fetchDatasetQueryConfig } from "@/lib/datasetChartBinding";
import {
  filterSyncJobBindDatasources,
  resolveAnalyticsDatasourceId,
} from "@/lib/datasourceRoles";
import { formatSyncDatasourceDisplay } from "@/lib/formatDatasourceDisplay";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { DatasetFieldWorkbench } from "./components/DatasetFieldWorkbench";
import {
  DatasetQualifiedTableReadout,
  SYNC_HEADER_LABEL_BLOCK_CLASS,
  SYNC_HEADER_READOUT_MIN_H,
  SyncOutputConnectionReadout,
} from "./components/SyncOutputConnectionReadout";
import { setPrimaryTable } from "./datasetTableSelection";
import { useDatasetWorkbenchColumns } from "./hooks/useDatasetWorkbenchColumns";
import type { DatasetBindDraft, DatasetOrigin, DatasetTable } from "./types";

type DsItem = {
  id: string;
  name: string;
  code?: string;
  database?: string;
  type?: string;
  host?: string;
  port?: number;
};

function parseFocusTable(prefillTable?: string): { schema: string; table: string } | undefined {
  if (!prefillTable?.trim()) return undefined;
  const raw = prefillTable.trim();
  if (raw.includes(".")) {
    const [schema, table] = raw.split(".", 2);
    if (schema && table) return { schema, table };
  }
  return { schema: "public", table: raw };
}

function parseTableFocus(tableName: string): { schema: string; table: string } | undefined {
  if (!tableName.trim()) return undefined;
  if (tableName.includes(".")) {
    const [schema, table] = tableName.split(".", 2);
    if (schema && table) return { schema, table };
  }
  return { schema: "public", table: tableName };
}

export function DatasetTablePicker({
  tables,
  onChange,
  preferredDataSourceId,
  prefillTable,
  savedDataSourceId,
  onDataSourceIdChange,
  origin = "manual",
  bindDraft,
  onBindDraftChange,
  boundConfigId,
  syncJobId,
  onRefreshBinding,
  onTableChange,
  isDemoPackage = false,
}: {
  tables: DatasetTable[];
  onChange: (next: DatasetTable[]) => void;
  preferredDataSourceId?: string;
  prefillTable?: string;
  savedDataSourceId?: string;
  onDataSourceIdChange?: (dataSourceId: string) => void;
  origin?: DatasetOrigin;
  bindDraft?: DatasetBindDraft;
  onBindDraftChange?: (next: DatasetBindDraft) => void;
  boundConfigId?: string | null;
  syncJobId?: string | null;
  onRefreshBinding?: () => void;
  onTableChange?: () => void;
  isDemoPackage?: boolean;
}) {
  const isSyncOrigin = origin === "sync_job";
  const readOnlyTables = (isSyncOrigin && tables.length > 0) || (isDemoPackage && tables.length > 0);
  const [dataSourceId, setDataSourceId] = useState("");
  const [pendingTablePick, setPendingTablePick] = useState<TableSelection | null>(null);
  const [pendingDataSourceId, setPendingDataSourceId] = useState<string | null>(null);
  const primaryTableName = tables[0]?.name ?? "";
  const [schemaExpanded, setSchemaExpanded] = useState(false);
  const focusTable = useMemo(
    () => parseTableFocus(primaryTableName) ?? parseFocusTable(prefillTable),
    [prefillTable, primaryTableName],
  );

  const dsQuery = useQuery({
    queryKey: queryKeys.datasources.list({ includeManaged: true }),
    queryFn: () => apiFetch<{ items: DsItem[] }>("/api/v1/datasources?includeManaged=true"),
  });

  const boundConfigQuery = useQuery({
    queryKey: ["query-config", boundConfigId ?? ""],
    queryFn: () => fetchDatasetQueryConfig(boundConfigId!),
    enabled: Boolean(boundConfigId),
  });

  const items = dsQuery.data?.items ?? [];
  const selectableItems = useMemo(
    () => (origin === "sync_job" ? filterSyncJobBindDatasources(items) : items),
    [items, origin],
  );
  const selectedDs = selectableItems.find((d) => d.id === dataSourceId);
  const syncDatasourceDisplay = useMemo(
    () => (selectedDs ? formatSyncDatasourceDisplay(selectedDs) : null),
    [selectedDs],
  );

  const headerGridLayout = Boolean(dataSourceId) && selectableItems.length > 0;
  const useTallReadout = headerGridLayout && (isSyncOrigin || readOnlyTables);

  const tableChangeButton = !readOnlyTables ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0"
      aria-expanded={schemaExpanded}
      onClick={() => setSchemaExpanded((open) => !open)}
    >
      {schemaExpanded ? (
        <>
          <ChevronUp className="size-3.5" aria-hidden />
          收起
        </>
      ) : (
        <>
          <ChevronDown className="size-3.5" aria-hidden />
          更换
        </>
      )}
    </Button>
  ) : null;

  useEffect(() => {
    if (selectableItems.length === 0) return;
    const saved = savedDataSourceId || preferredDataSourceId;
    setDataSourceId((current) => {
      if (current && selectableItems.some((d) => d.id === current)) return current;
      return resolveAnalyticsDatasourceId(selectableItems, saved);
    });
  }, [selectableItems, preferredDataSourceId, savedDataSourceId]);

  useEffect(() => {
    if (!dataSourceId || !onDataSourceIdChange || savedDataSourceId) return;
    if (primaryTableName) {
      onDataSourceIdChange(dataSourceId);
    }
  }, [dataSourceId, onDataSourceIdChange, primaryTableName, savedDataSourceId]);

  useEffect(() => {
    setSchemaExpanded(!primaryTableName);
  }, [primaryTableName]);

  const effectiveDataSourceId = useMemo(() => {
    const boundDs = boundConfigQuery.data?.dataSourceId;
    if (boundDs) return boundDs;
    return dataSourceId || savedDataSourceId || "";
  }, [boundConfigQuery.data?.dataSourceId, dataSourceId, savedDataSourceId]);

  const { columnNames, columnsLoading, columnsError } = useDatasetWorkbenchColumns(
    effectiveDataSourceId,
    primaryTableName,
    boundConfigQuery.data,
  );

  const applyTablePick = useCallback(
    (sel: TableSelection) => {
      const name = qualifiedTableName(sel.schema, sel.table);
      if (name === primaryTableName) return;
      onChange(setPrimaryTable(name));
      if (dataSourceId) {
        onDataSourceIdChange?.(dataSourceId);
      }
      onTableChange?.();
      setSchemaExpanded(false);
    },
    [dataSourceId, onChange, onDataSourceIdChange, onTableChange, primaryTableName],
  );

  const handlePickTable = useCallback(
    (sel: TableSelection) => {
      if (readOnlyTables) return;
      const name = qualifiedTableName(sel.schema, sel.table);
      if (name === primaryTableName) return;

      const hasBindDraft = (bindDraft?.selectedColumns.length ?? 0) > 0;
      if (hasBindDraft && primaryTableName) {
        setPendingTablePick(sel);
        return;
      }
      applyTablePick(sel);
    },
    [applyTablePick, bindDraft?.selectedColumns.length, primaryTableName, readOnlyTables],
  );

  const handleDataSourceChange = (nextId: string) => {
    if (readOnlyTables || isSyncOrigin) return;
    if (primaryTableName && nextId !== effectiveDataSourceId) {
      setPendingDataSourceId(nextId);
      return;
    }
    setDataSourceId(nextId);
    onDataSourceIdChange?.(nextId);
  };

  const confirmTablePick = () => {
    if (!pendingTablePick) return;
    applyTablePick(pendingTablePick);
    setPendingTablePick(null);
  };

  const confirmDataSourceChange = () => {
    if (!pendingDataSourceId) return;
    onChange([]);
    onTableChange?.();
    setSchemaExpanded(true);
    setDataSourceId(pendingDataSourceId);
    onDataSourceIdChange?.(pendingDataSourceId);
    setPendingDataSourceId(null);
  };

  const showSchemaPicker = !primaryTableName || schemaExpanded;

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        className={cn(
          "shrink-0 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]",
          headerGridLayout
            ? "grid grid-cols-1 items-stretch gap-4 px-4 py-4 md:grid-cols-2 md:gap-6"
            : "flex flex-wrap items-end gap-4 px-4 py-3",
        )}
      >
        <div className={cn("flex min-w-0 flex-col gap-2", !headerGridLayout && "grid min-w-[200px] flex-1 gap-1.5 sm:max-w-xs")}>
          <div className={headerGridLayout ? SYNC_HEADER_LABEL_BLOCK_CLASS : "grid gap-0.5"}>
            <Label htmlFor="dataset-datasource" className="text-theme-xs text-gray-600 dark:text-gray-400">
              {isSyncOrigin ? "同步产出库" : "数据源"}
            </Label>
            {isSyncOrigin ? (
              <p className="text-theme-xs text-gray-400 dark:text-gray-500">托管分析库连接（只读）</p>
            ) : headerGridLayout ? (
              <p className="text-theme-xs text-gray-400 dark:text-gray-500">选择要浏览 Schema 的数据连接</p>
            ) : null}
          </div>
          {dsQuery.isLoading ? (
            <Skeleton className={cn("h-11 w-full rounded-lg", headerGridLayout && SYNC_HEADER_READOUT_MIN_H)} />
          ) : selectableItems.length === 0 ? (
            <p className="text-theme-xs text-gray-500">
              {isSyncOrigin
                ? "未登记托管分析库，请先完成同步或配置 ANALYTICS_DATABASE_URL。"
                : "暂无可用数据源，请先在「数据源」中创建。"}
            </p>
          ) : !dataSourceId ? (
            <Skeleton className={cn("h-11 w-full rounded-lg", headerGridLayout && SYNC_HEADER_READOUT_MIN_H)} />
          ) : readOnlyTables || isSyncOrigin || isDemoPackage ? (
            selectedDs ? (
              <SyncOutputConnectionReadout
                id="dataset-datasource"
                data-testid="sync-output-datasource"
                datasource={selectedDs}
                tall={useTallReadout}
                className="min-h-0 flex-1"
              />
            ) : (
              <Skeleton className={cn("h-11 w-full rounded-lg", headerGridLayout && SYNC_HEADER_READOUT_MIN_H)} />
            )
          ) : (
            <Select value={dataSourceId} onValueChange={handleDataSourceChange}>
              <SelectTrigger id="dataset-datasource" className="h-11" aria-label="选择数据源">
                <SelectValue placeholder="选择数据源" />
              </SelectTrigger>
              <SelectContent>
                {selectableItems.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className={cn("flex min-w-0 flex-col gap-2", !headerGridLayout && "grid gap-1.5")}>
          <div className={headerGridLayout ? SYNC_HEADER_LABEL_BLOCK_CLASS : undefined}>
            <span className="text-theme-xs text-gray-600 dark:text-gray-400">当前数据表</span>
            {headerGridLayout ? (
              <p className="text-theme-xs text-gray-400 dark:text-gray-500">
                {isSyncOrigin ? "同步写入的目标表（只读）" : "已选物理表，可在下方更换"}
              </p>
            ) : null}
          </div>
          {primaryTableName ? (
            <DatasetQualifiedTableReadout
              tableName={primaryTableName}
              tall={useTallReadout}
              className="w-full"
              action={tableChangeButton}
            />
          ) : (
            <p
              className={cn(
                "flex h-11 items-center rounded-lg border border-dashed border-gray-200 px-3 text-theme-xs text-gray-500 dark:border-gray-700 dark:text-gray-400",
                useTallReadout && cn(SYNC_HEADER_READOUT_MIN_H, "h-auto justify-center"),
              )}
            >
              请在下方 Schema 树单击表名
            </p>
          )}
        </div>
      </div>

      {isSyncOrigin ? (
        <p className="shrink-0 text-theme-xs text-gray-500 dark:text-gray-400">
          同步产物固定写入托管分析库；此处仅浏览同步目标表结构，不能改选业务源连接。
        </p>
      ) : isDemoPackage ? (
        <p className="shrink-0 text-theme-xs text-gray-500 dark:text-gray-400">
          官方示例 Dataset 的数据源与物理表已预置，不可更换。
        </p>
      ) : null}

      {showSchemaPicker ? (
        <div
          className={cn(
            "shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white",
            "dark:border-gray-800 dark:bg-white/[0.02]",
            primaryTableName
              ? "h-[min(240px,28vh)] min-h-[200px]"
              : "h-[min(320px,36vh)] min-h-[240px]",
          )}
        >
          {dataSourceId ? (
            <SchemaBrowser
              key={dataSourceId}
              dataSourceId={dataSourceId}
              mode="datasetPick"
              currentTableName={primaryTableName}
              onPickTable={readOnlyTables ? undefined : handlePickTable}
              embedded
              defaultDatabase={selectedDs?.database}
              focusTable={focusTable}
              className="h-full min-h-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">请先选择数据源。</p>
            </div>
          )}
        </div>
      ) : null}

      {primaryTableName && bindDraft && onBindDraftChange ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DatasetFieldWorkbench
            dataSourceId={effectiveDataSourceId}
            connectorType={selectedDs?.type || "postgresql"}
            tableName={primaryTableName}
            columnNames={columnNames}
            columnsLoading={columnsLoading}
            columnsError={columnsError}
            bindDraft={bindDraft}
            onBindDraftChange={onBindDraftChange}
            boundConfigId={boundConfigId}
            origin={origin}
            syncJobId={syncJobId}
            syncDataSourceName={syncDatasourceDisplay?.name}
            syncDataSourceEndpoint={syncDatasourceDisplay?.endpoint}
            onRefreshBinding={onRefreshBinding}
            fieldsLocked={isDemoPackage}
          />
        </div>
      ) : null}
    </div>

      <AlertDialog
        open={pendingTablePick !== null}
        onOpenChange={(open) => !open && setPendingTablePick(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换数据表？</AlertDialogTitle>
            <AlertDialogDescription>
              切换表将重置字段勾选，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="primary" onClick={confirmTablePick}>继续</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDataSourceId !== null}
        onOpenChange={(open) => !open && setPendingDataSourceId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换数据源？</AlertDialogTitle>
            <AlertDialogDescription>
              切换数据源将清空当前数据表，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="primary" onClick={confirmDataSourceChange}>继续</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
