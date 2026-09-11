import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers } from "lucide-react";
import { toast } from "sonner";
import { SourceHealthAlert } from "@/components/datasources/SourceHealthAlert";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedLeaveDialog } from "@/components/ui/unsaved-leave-dialog";
import { useFormDirtyState } from "@/hooks/use-form-dirty-state";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  fetchDatasetQueryConfig,
  persistDatasetBind,
} from "@/lib/datasetChartBinding";
import { queryKeys } from "@/lib/queryKeys";
import {
  bindDraftFromBinding,
  EMPTY_BIND_DRAFT,
  seedBindDraftFromColumns,
} from "./components/datasetFieldWorkbenchState";
import { loadPrimaryOnly, normalizeTablesSingle } from "./datasetTableSelection";
import {
  canSubmitDataset,
  DATASET_EDITOR_FORM_ID,
  DatasetEditorForm,
  datasetSubmitBlockers,
} from "./DatasetEditorForm";
import { useDatasetTableColumns } from "./hooks/useDatasetTableColumns";
import type { DatasetEditorValues, DatasetItem } from "./types";
import { resolveAnalyticsDatasourceId } from "@/lib/datasourceRoles";
import { isDemoPackageDataset } from "@/lib/demoPackage";
import { tablesMatchForBind, parseQualifiedTable } from "@/lib/datasetTableUtils";

const datasetPageIcon = (
  <AdminPageHeaderIcon>
    <Layers className="size-6" aria-hidden />
  </AdminPageHeaderIcon>
);

const EMPTY: DatasetEditorValues = {
  datasetId: "",
  displayName: "",
  tables: [],
  computedFields: [],
  allowedRoles: ["analyst"],
  bindDraft: EMPTY_BIND_DRAFT,
};

function normalizeValues(values: DatasetEditorValues): DatasetEditorValues {
  return {
    ...values,
    datasetId: values.datasetId.trim(),
    displayName: values.displayName.trim(),
    tables: normalizeTablesSingle(values.tables),
    tableSourceDataSourceId: values.tableSourceDataSourceId?.trim() || undefined,
    computedFields: values.computedFields
      .filter((field) => field.name.trim() || field.expression.trim())
      .map((f) => ({
        name: f.name.trim(),
        expression: f.expression.trim(),
      })),
    bindDraft: values.bindDraft
      ? {
          selectedColumns: [...values.bindDraft.selectedColumns],
          columnKinds: { ...values.bindDraft.columnKinds },
        }
      : EMPTY_BIND_DRAFT,
  };
}

/** API 写入体：剥离 FE-only bindDraft，避免后端静默丢弃或 422。 */
function toDatasetApiPayload(values: DatasetEditorValues): Omit<DatasetEditorValues, "bindDraft"> {
  const normalized = normalizeValues(values);
  const { bindDraft: _bindDraft, ...payload } = normalized;
  return payload;
}

function serializeDatasetValues(values: DatasetEditorValues): string {
  return JSON.stringify(normalizeValues(values));
}

function valuesFromSearchParams(searchParams: URLSearchParams): DatasetEditorValues {
  const targetTable = searchParams.get("targetTable")?.trim() ?? "";
  const suggestedDatasetId =
    searchParams.get("suggestedDatasetId")?.trim() || targetTable;
  const tableName = targetTable
    ? targetTable.includes(".")
      ? targetTable
      : `public.${targetTable}`
    : "";
  return {
    ...EMPTY,
    datasetId: suggestedDatasetId,
    displayName: suggestedDatasetId,
    tables: tableName ? [{ name: tableName }] : [],
  };
}

function shouldSeedFromBoundConfig(
  primaryTableName: string,
  bound: { columns?: string[]; schema?: string; table?: string } | undefined,
): boolean {
  if (!bound?.columns?.length) return false;
  return tablesMatchForBind(primaryTableName, bound.schema, bound.table);
}

export function DatasetFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createPrefill = useMemo(
    () => (mode === "create" ? valuesFromSearchParams(searchParams) : EMPTY),
    [mode, searchParams],
  );
  const preferredDataSourceId = searchParams.get("dataSourceId")?.trim() || undefined;
  const prefillTable = searchParams.get("targetTable")?.trim() || undefined;
  const [values, setValues] = useState<DatasetEditorValues>(createPrefill);
  const [isSaving, setIsSaving] = useState(false);
  const bindSeedKeyRef = useRef("");
  const detailHydratedIdRef = useRef<string | null>(null);

  useEffect(() => {
    detailHydratedIdRef.current = null;
    bindSeedKeyRef.current = "";
  }, [id]);

  const detailQuery = useQuery({
    queryKey: [...queryKeys.datasets.detail(id ?? ""), "with-bind"],
    queryFn: async () => {
      const item = await apiFetch<DatasetItem>(`/api/v1/datasets/${id}`);
      const primaryTable = loadPrimaryOnly(item.tables)[0]?.name ?? "";
      const parsed = primaryTable ? parseQualifiedTable(primaryTable) : null;
      const dsId = item.tableSourceDataSourceId?.trim() || preferredDataSourceId;

      const columnsPrefetch =
        dsId && parsed?.table
          ? queryClient.prefetchQuery({
              queryKey: queryKeys.datasources.columns(dsId, parsed.schema, parsed.table),
              queryFn: () =>
                apiFetch<{ items: Array<{ name: string }> }>(
                  `/api/v1/datasources/${dsId}/columns?schema=${encodeURIComponent(parsed.schema)}&table=${encodeURIComponent(parsed.table)}`,
                ),
            })
          : null;

      const bound =
        item.boundConfigId && primaryTable
          ? await fetchDatasetQueryConfig(item.boundConfigId)
          : undefined;

      void columnsPrefetch;

      let bindDraft = EMPTY_BIND_DRAFT;
      if (bound && shouldSeedFromBoundConfig(primaryTable, bound)) {
        bindDraft = bindDraftFromBinding(bound.columns ?? [], bound.columnKinds);
      }
      return { item, bindDraft };
    },
    enabled: mode === "edit" && Boolean(id),
    retry: (count, err) => {
      if (err instanceof Error && err.message.includes("不存在")) return false;
      return count < 1;
    },
  });

  const datasetItem = detailQuery.data?.item;
  const isDemoPackage =
    mode === "edit" &&
    (datasetItem?.isDemoPackage ??
      isDemoPackageDataset(values.datasetId, values.displayName));
  const boundConfigId = datasetItem?.boundConfigId;

  const primaryTableName = values.tables[0]?.name ?? "";
  const dsQuery = useQuery({
    queryKey: queryKeys.datasources.list({ includeManaged: true }),
    queryFn: () => apiFetch<{ items: Array<{ id: string; type?: string }> }>("/api/v1/datasources?includeManaged=true"),
  });
  const effectiveDataSourceIdForColumns = useMemo(() => {
    if (values.tableSourceDataSourceId) return values.tableSourceDataSourceId;
    if (preferredDataSourceId) return preferredDataSourceId;
    const items = dsQuery.data?.items ?? [];
    if (items.length === 0) return "";
    return resolveAnalyticsDatasourceId(items, undefined);
  }, [dsQuery.data?.items, preferredDataSourceId, values.tableSourceDataSourceId]);
  const { columnNames, columnsLoading } = useDatasetTableColumns(
    effectiveDataSourceIdForColumns,
    primaryTableName,
  );

  const { isDirty, isBaselineReady, resetBaseline, markSaved } = useFormDirtyState(
    values,
    serializeDatasetValues,
  );

  const leaveGuardEnabled = isBaselineReady && isDirty;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: leaveGuardEnabled,
  });

  useEffect(() => {
    if (mode === "create") {
      setValues(createPrefill);
      if (!createPrefill.tables[0]?.name) {
        resetBaseline(createPrefill);
        bindSeedKeyRef.current = "create-empty";
      } else {
        bindSeedKeyRef.current = "";
      }
      return;
    }
    if (!detailQuery.data) return;
    const { item, bindDraft: loadedBindDraft } = detailQuery.data;
    if (detailHydratedIdRef.current === item.datasetId) return;
    detailHydratedIdRef.current = item.datasetId;
    const tables = loadPrimaryOnly(item.tables);
    if (item.tables.length > 1 && tables[0]?.name) {
      toast.info(`已切换为单表模式，仅保留主表 ${tables[0].name}`);
    }
    const nextValues: DatasetEditorValues = {
      datasetId: item.datasetId,
      displayName: item.displayName,
      tables,
      computedFields: item.computedFields.map((c) => ({ ...c })),
      allowedRoles: [...item.allowedRoles],
      tableSourceDataSourceId: item.tableSourceDataSourceId ?? undefined,
      bindDraft: loadedBindDraft,
    };
    setValues(nextValues);
    bindSeedKeyRef.current = loadedBindDraft.selectedColumns.length
      ? `bound:${item.datasetId}`
      : "";
    resetBaseline(nextValues);
    if (!item.tables[0]?.name) {
      bindSeedKeyRef.current = "edit-no-table";
    }
  }, [detailQuery.data, mode, resetBaseline, createPrefill]);

  useEffect(() => {
    if (!primaryTableName || columnsLoading || columnNames.length === 0) return;
    if (values.bindDraft.selectedColumns.length > 0) return;

    const seedKey = `cols:${primaryTableName}:${columnNames.join(",")}`;
    if (bindSeedKeyRef.current === seedKey || bindSeedKeyRef.current.startsWith("bound:")) return;

    bindSeedKeyRef.current = seedKey;
    const nextDraft = seedBindDraftFromColumns(columnNames, null);
    setValues((current) => {
      const nextValues = { ...current, bindDraft: nextDraft };
      resetBaseline(nextValues);
      return nextValues;
    });
  }, [columnNames, columnsLoading, primaryTableName, resetBaseline, values.bindDraft.selectedColumns.length]);

  const handleSave = async (): Promise<boolean> => {
    const body = normalizeValues(values);
    const apiPayload = toDatasetApiPayload(values);
    setIsSaving(true);
    try {
      await apiFetch("/api/v1/datasets/validate", {
        method: "POST",
        body: JSON.stringify(apiPayload),
      });

      const saved =
        mode === "create"
          ? await apiFetch<DatasetItem>("/api/v1/datasets", {
              method: "POST",
              body: JSON.stringify(apiPayload),
            })
          : await apiFetch<DatasetItem>(`/api/v1/datasets/${body.datasetId}`, {
              method: "PUT",
              body: JSON.stringify(apiPayload),
            });

      const bindDraft = body.bindDraft;
      const tableSourceId = body.tableSourceDataSourceId;
      const primaryTable = body.tables[0]?.name;
      if (
        bindDraft &&
        bindDraft.selectedColumns.length > 0 &&
        tableSourceId &&
        primaryTable
      ) {
        const connectorType =
          dsQuery.data?.items.find((d) => d.id === tableSourceId)?.type ?? "postgresql";
        try {
          const bindResult = await persistDatasetBind({
            datasetId: saved.datasetId,
            boundConfigId: datasetItem?.boundConfigId ?? boundConfigId,
            dataSourceId: tableSourceId,
            connectorType,
            tableName: primaryTable,
            selectedColumns: bindDraft.selectedColumns,
            columnKinds: bindDraft.columnKinds,
          });
          toast.success(
            mode === "create"
              ? `Dataset 已创建，出图字段已绑定（${bindDraft.selectedColumns.length} 列）`
              : `Dataset 已保存，出图字段已更新（${bindDraft.selectedColumns.length} 列）`,
          );
          await queryClient.invalidateQueries({ queryKey: ["query-config", bindResult.configId] });
        } catch (bindErr) {
          toast.error(
            `Dataset 已保存，但出图字段绑定失败：${mapApiError(bindErr)}。请重试保存。`,
          );
          return false;
        }
      } else {
        toast.success(mode === "create" ? "Dataset 已创建" : "Dataset 已更新");
      }

      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
      markSaved(body);
      if (mode === "create") {
        navigate(`/admin/datasets/${saved.datasetId}/edit`, { replace: true });
      } else {
        void detailQuery.refetch();
      }
      return true;
    } catch (err) {
      toast.error(mapApiError(err));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSave();
    if (ok) confirmLeave();
  };

  const pageDescription = useMemo(() => {
    if (isDemoPackage) return "官方示例 Dataset，字段与配置已锁定，仅供浏览与出图引用";
    if (!isBaselineReady) return undefined;
    if (isDirty) return "有未保存的更改 · 保存后生效";
    return mode === "create" ? "填写完成后保存以创建 Dataset" : "已保存";
  }, [isBaselineReady, isDirty, isDemoPackage, mode]);

  const canSubmit = canSubmitDataset(values);
  const submitBlockers = datasetSubmitBlockers(values);

  const transformRulesPrefill = useMemo(() => {
    if (mode !== "edit" || !id) return undefined;
    const hasSource = Boolean(effectiveDataSourceIdForColumns && primaryTableName);
    return {
      datasetId: id,
      columnNames,
      columnsLoading,
      hasDataSource: hasSource,
      disabledReason: null,
    };
  }, [
    mode,
    id,
    columnNames,
    columnsLoading,
    effectiveDataSourceIdForColumns,
    primaryTableName,
  ]);

  const headerLeadingActions = (
    <Button asChild variant="outline" size="sm">
      <Link to="/admin/datasets">
        <ArrowLeft className="size-4" aria-hidden />
        返回列表
      </Link>
    </Button>
  );

  const headerActions = isDemoPackage ? null : (
    <Button
      type="submit"
      form={DATASET_EDITOR_FORM_ID}
      variant="primary"
      size="sm"
      loading={isSaving}
      loadingText="保存中…"
      disabled={!canSubmit || isSaving || (mode === "edit" && !isDirty)}
      title={
        !canSubmit && submitBlockers.length > 0
          ? `还需：${submitBlockers.join("；")}`
          : undefined
      }
    >
      {mode === "create" ? "创建 Dataset" : "保存"}
    </Button>
  );

  if (mode === "edit" && detailQuery.isLoading) {
    return (
      <AdminPageShell title="编辑数据集" layout="fill" icon={datasetPageIcon}>
        <Skeleton className="h-full min-h-[520px] w-full rounded-2xl" />
      </AdminPageShell>
    );
  }

  if (mode === "edit" && detailQuery.isError) {
    return (
      <AdminPageShell
        title="编辑数据集"
        layout="fill"
        icon={datasetPageIcon}
        leadingActions={headerLeadingActions}
        actions={headerActions}
      >
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">{mapApiError(detailQuery.error)}</p>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title={mode === "create" ? "新建 Dataset" : "编辑数据集"}
      layout="fill"
      icon={datasetPageIcon}
      description={pageDescription}
      leadingActions={headerLeadingActions}
      actions={headerActions}
    >
      {mode === "edit" ? (
        <div className="mb-4">
          <SourceHealthAlert health={datasetItem?.sourceHealth} entity="dataset" />
        </div>
      ) : null}
      <DatasetEditorForm
        mode={mode}
        values={values}
        onChange={setValues}
        onSubmit={() => void handleSave()}
        origin={mode === "edit" ? (datasetItem?.origin ?? "manual") : "manual"}
        tablePickerPrefill={{
          preferredDataSourceId,
          prefillTable,
          savedDataSourceId: values.tableSourceDataSourceId,
          onDataSourceIdChange: (tableSourceDataSourceId) =>
            setValues((current) => ({ ...current, tableSourceDataSourceId })),
          boundConfigId: datasetItem?.boundConfigId,
          syncJobId: datasetItem?.syncJobId,
          onRefreshBinding: () => void detailQuery.refetch(),
          onTableChange: () => {
            bindSeedKeyRef.current = "";
            setValues((current) => ({ ...current, bindDraft: EMPTY_BIND_DRAFT }));
          },
        }}
        transformRulesPrefill={transformRulesPrefill}
        isDemoPackage={isDemoPackage}
      />
      <UnsavedLeaveDialog
        open={leaveDialogOpen}
        saving={isSaving}
        entityLabel="Dataset"
        onStay={cancelLeave}
        onDiscardLeave={confirmLeave}
        onSaveAndLeave={handleSaveAndLeave}
      />
    </AdminPageShell>
  );
}
