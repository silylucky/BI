import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Hash, Table2, Type } from "lucide-react";
import { toast } from "sonner";
import { classifyDatasetField, resolveFieldKind } from "@/components/dashboard/datasetFieldClassification";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mapApiError } from "@/lib/apiError";
import { fetchTablePreview } from "@/lib/datasetTablePreview";
import { parseQualifiedTable } from "@/lib/datasetTableUtils";
import { refreshSyncDatasetBinding } from "@/lib/syncConsumeApi";
import type { DatasetBindDraft, DatasetOrigin } from "../types";
import {
  autoIdentifyDraft,
  resolveKindForField,
  selectAllDraft,
  toggleColumnInDraft,
  toggleFieldKind,
} from "./datasetFieldWorkbenchState";

function FieldKindIcon({ field, draft }: { field: string; draft: DatasetBindDraft }) {
  const kind = resolveKindForField(field, draft);
  if (kind === "metric") return <Hash className="size-3.5 text-success-500" aria-hidden />;
  if (/(?:^|_)(date|time|day|month|year|week)(?:$|_)/i.test(field)) {
    return <Calendar className="size-3.5 text-brand-500" aria-hidden />;
  }
  return <Type className="size-3.5 text-brand-500" aria-hidden />;
}

export function DatasetFieldWorkbench({
  dataSourceId,
  connectorType = "postgresql",
  tableName,
  columnNames,
  columnsLoading,
  columnsError,
  bindDraft,
  onBindDraftChange,
  boundConfigId,
  origin = "manual",
  syncJobId,
  syncDataSourceName,
  syncDataSourceEndpoint,
  onRefreshBinding,
  fieldsLocked = false,
}: {
  dataSourceId: string;
  connectorType?: string;
  tableName: string;
  columnNames: string[];
  columnsLoading: boolean;
  columnsError?: unknown;
  bindDraft: DatasetBindDraft;
  onBindDraftChange: (next: DatasetBindDraft) => void;
  boundConfigId?: string | null;
  origin?: DatasetOrigin;
  syncJobId?: string | null;
  syncDataSourceName?: string;
  syncDataSourceEndpoint?: string;
  onRefreshBinding?: () => void;
  fieldsLocked?: boolean;
}) {
  const isSyncOrigin = origin === "sync_job";
  const parsed = parseQualifiedTable(tableName);
  const [refreshing, setRefreshing] = useState(false);
  const allColumnNames = useMemo(() => {
    const merged = new Set([...columnNames, ...bindDraft.selectedColumns]);
    return [...merged];
  }, [bindDraft.selectedColumns, columnNames]);
  const previewColumns =
    bindDraft.selectedColumns.length > 0 ? bindDraft.selectedColumns : allColumnNames;

  const previewQuery = useQuery({
    queryKey: ["dataset-preview", dataSourceId, parsed.schema, parsed.table, previewColumns.join(",")],
    queryFn: () =>
      fetchTablePreview({
        dataSourceId,
        schema: parsed.schema || "public",
        table: parsed.table,
        columns: bindDraft.selectedColumns.length > 0 ? bindDraft.selectedColumns : undefined,
        limit: 20,
      }),
    enabled: Boolean(dataSourceId && parsed.table && allColumnNames.length > 0),
  });

  const { dimensions, metrics } = useMemo(() => {
    const dims: string[] = [];
    const mets: string[] = [];
    for (const col of allColumnNames) {
      if (resolveKindForField(col, bindDraft) === "metric") mets.push(col);
      else dims.push(col);
    }
    return { dimensions: dims, metrics: mets };
  }, [allColumnNames, bindDraft]);

  const handleRefreshSync = async () => {
    if (!syncJobId) return;
    setRefreshing(true);
    try {
      const result = await refreshSyncDatasetBinding(syncJobId);
      onBindDraftChange({
        selectedColumns: result.columns,
        columnKinds: Object.fromEntries(
          result.columns.map((c) => [c, bindDraft.columnKinds[c] ?? classifyDatasetField(c)]),
        ),
      });
      toast.success(`已刷新绑定列（${result.columns.length} 列）`);
      onRefreshBinding?.();
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setRefreshing(false);
    }
  };

  if (!tableName) return null;

  const canShowFields = allColumnNames.length > 0;
  const metadataPending = columnsLoading && columnNames.length === 0;
  const actionColumns = columnNames.length > 0 ? columnNames : allColumnNames;

  return (
    <section className="flex min-h-[320px] flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Table2 className="size-4 text-gray-400" aria-hidden />
          <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">字段工作台</h3>
          {boundConfigId ? (
            <Badge variant="light" color="success" size="sm">
              已绑定
            </Badge>
          ) : (
            <Badge variant="light" color="light" size="sm">
              保存后绑定
            </Badge>
          )}
          {isSyncOrigin ? (
            <Badge variant="light" color="primary" size="sm">
              同步产物
            </Badge>
          ) : null}
          {fieldsLocked ? (
            <Badge variant="light" color="warning" size="sm" data-testid="demo-fields-locked-badge">
              官方示例
            </Badge>
          ) : null}
        </div>
        <Badge variant="light" color="light" size="sm" data-testid="bind-selected-count">
          已选 {bindDraft.selectedColumns.length}/{allColumnNames.length || "—"}
        </Badge>
      </div>

      {fieldsLocked ? (
        <Alert variant="info" data-testid="demo-fields-locked-alert">
          <AlertTitle>官方示例字段已锁定</AlertTitle>
          <AlertDescription className="text-theme-xs">
            出图字段与维/指标类型由平台预置，仅供浏览与出图引用，不可修改。
          </AlertDescription>
        </Alert>
      ) : isSyncOrigin ? (
        <Alert variant="info">
          <AlertTitle>来自同步任务</AlertTitle>
          <AlertDescription className="text-theme-xs">
            {syncJobId ? (
              <>
                同步任务 ID：<span className="font-mono"> {syncJobId.slice(0, 8)}…</span>。
              </>
            ) : null}
            图表将查询表
            <span className="font-mono"> {tableName}</span>
            {syncDataSourceName ? (
              <>
                ，经数据连接「{syncDataSourceName}」
                {syncDataSourceEndpoint ? (
                  <>
                    （<span className="font-mono">{syncDataSourceEndpoint}</span>）
                  </>
                ) : null}
              </>
            ) : null}
            ；保存 Dataset 后出图字段生效。
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          勾选出图字段、切换维/指标类型；保存 Dataset 时自动更新绑定配置。
        </p>
      )}

      <Tabs defaultValue="fields" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList variant="enclosed" size="sm">
            <TabsTrigger value="fields">字段管理</TabsTrigger>
            <TabsTrigger value="preview">数据预览</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fieldsLocked || actionColumns.length === 0}
              onClick={() => onBindDraftChange(autoIdentifyDraft(actionColumns))}
            >
              自动识别
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={fieldsLocked || actionColumns.length === 0}
              onClick={() => onBindDraftChange(selectAllDraft(actionColumns))}
            >
              全选
            </Button>
            {isSyncOrigin && syncJobId && boundConfigId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refreshing}
                loading={refreshing}
                loadingText="刷新中…"
                onClick={() => void handleRefreshSync()}
              >
                刷新绑定（自动识别）
              </Button>
            ) : null}
          </div>
        </div>

        <TabsContent value="fields" className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
          {metadataPending && !canShowFields ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : !canShowFields ? (
            <p className="text-theme-xs text-gray-500">
              {columnsError
                ? "列元数据加载失败，请检查数据源连接后重试。"
                : tableName
                  ? `表 ${tableName} 没有可浏览的列（多为数据库内部表）。请更换为业务 schema（如 public）下的数据表，例如 host_metrics。`
                  : "暂无字段，请先选择数据表。"}
            </p>
          ) : (
            <div className="grid gap-3">
              {metadataPending ? (
                <p className="text-theme-xs text-gray-400">表结构加载中，先展示已绑定字段…</p>
              ) : null}
              {columnsError && columnNames.length === 0 ? (
                <p className="text-theme-xs text-warning-600 dark:text-warning-400">
                  列元数据暂不可用，当前仅展示已绑定字段。
                </p>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
              {[
                { title: "维度", fields: dimensions },
                { title: "指标", fields: metrics },
              ].map(({ title, fields }) => (
                <div key={title} className="grid min-h-0 grid-rows-[auto_1fr] gap-2">
                  <Label className="text-theme-xs text-gray-600 dark:text-gray-400">{title}</Label>
                  <ul className="min-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/[0.02] lg:min-h-0 lg:h-full">
                    {fields.length === 0 ? (
                      <li className="px-2 py-1 text-theme-xs text-gray-400">无</li>
                    ) : (
                      fields.map((col) => (
                        <li key={col} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-white/5">
                          <Checkbox
                            aria-label={col}
                            checked={bindDraft.selectedColumns.includes(col)}
                            disabled={fieldsLocked}
                            onCheckedChange={(checked) =>
                              onBindDraftChange(toggleColumnInDraft(bindDraft, col, checked === true))
                            }
                          />
                          <FieldKindIcon field={col} draft={bindDraft} />
                          <span className="min-w-0 flex-1 truncate font-mono text-theme-xs">{col}</span>
                          {!fieldsLocked ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => onBindDraftChange(toggleFieldKind(bindDraft, col))}
                            >
                              转{resolveKindForField(col, bindDraft) === "metric" ? "维度" : "指标"}
                            </Button>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
          {previewQuery.isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : previewQuery.data?.columns.length ? (
            <div className="custom-scrollbar max-h-none min-h-[160px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-800 lg:max-h-64">
              <table className="w-full min-w-max text-left text-theme-xs">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900">
                  <tr>
                    {previewQuery.data.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        <span className="font-mono">{col}</span>
                        <Badge variant="light" color="light" size="sm" className="ml-1">
                          {resolveKindForField(col, bindDraft) === "metric" ? "指标" : "维度"}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewQuery.data.rows.slice(0, 20).map((row, ri) => (
                    <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                      {row.map((cell, ci) => (
                        <td key={ci} className="whitespace-nowrap px-2 py-1 font-mono text-gray-600 dark:text-gray-300">
                          {cell == null ? "—" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-theme-xs text-gray-500">暂无预览数据</p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
