import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedLeaveDialog } from "@/components/ui/unsaved-leave-dialog";
import { useFormDirtyState } from "@/hooks/use-form-dirty-state";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { resolveAnalyticsDatasourceId, type DatasourceListItem } from "@/lib/datasourceRoles";
import { ExtensionRuntimeDatasourceField } from "./ExtensionRuntimeDatasourceField";
import { ReportMetricDatasetFields } from "./ReportMetricDatasetFields";
import {
  metricKeyValidationMessage,
  resolveExtensionDefaultDataSourceId,
} from "../reportExtensionUtils";
import { type ExtensionMetric, useReportTemplates } from "../useReportTemplates";

const EMPTY_FORM = {
  metricKey: "",
  metricLabel: "",
  datasetId: "",
  boundConfigId: "",
};

function buildMetricFromForm(form: typeof EMPTY_FORM): ExtensionMetric | null {
  if (!form.metricKey.trim() || !form.metricLabel.trim()) return null;
  return {
    key: form.metricKey.trim(),
    label: form.metricLabel.trim(),
    visible: true,
    queryMode: "dataset",
    datasetId: form.datasetId.trim(),
    boundConfigId: form.boundConfigId.trim(),
  };
}

function formFromMetric(metric: ExtensionMetric) {
  return {
    metricKey: metric.key,
    metricLabel: metric.label,
    datasetId: metric.datasetId ?? "",
    boundConfigId: metric.boundConfigId ?? "",
  };
}

function metricsNeedDataSource(metrics: ExtensionMetric[]) {
  return metrics.some((m) => {
    if (!m.visible && m.visible !== undefined) return false;
    return Boolean(m.boundConfigId || m.datasetId);
  });
}

type DraftSnapshot = {
  metrics: ExtensionMetric[];
  defaultDataSourceId: string;
};

function serializeDraft(value: DraftSnapshot): string {
  return JSON.stringify(value);
}

export function ReportMetricExtensionForm({
  nodeId,
  readOnly,
  metrics,
  filters,
  defaultDataSourceId,
  isLoading,
}: {
  nodeId: string;
  readOnly: boolean;
  metrics: ExtensionMetric[];
  filters: Array<{ key: string; operator: string }>;
  defaultDataSourceId?: string | null;
  isLoading: boolean;
}) {
  const [draftMetrics, setDraftMetrics] = useState<ExtensionMetric[]>(metrics);
  const [defaultDsId, setDefaultDsId] = useState(defaultDataSourceId ?? "");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [changeNote, setChangeNote] = useState("");
  const { saveExtension } = useReportTemplates(null);
  const draftSnapshot = useMemo(
    (): DraftSnapshot => ({
      metrics: draftMetrics,
      defaultDataSourceId: defaultDsId,
    }),
    [draftMetrics, defaultDsId],
  );
  const { isDirty, isBaselineReady, resetBaseline, markSaved } = useFormDirtyState(
    draftSnapshot,
    serializeDraft,
  );
  const leaveGuardEnabled = !readOnly && isBaselineReady && isDirty;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: leaveGuardEnabled,
  });

  const dsQuery = useQuery({
    queryKey: ["reports", "datasources", "picker"],
    queryFn: () => apiFetch<{ items: DatasourceListItem[] }>("/api/v1/datasources?limit=100&includeManaged=true"),
    enabled: !readOnly,
  });
  const dsItems = dsQuery.data?.items ?? [];

  const pendingMetric = buildMetricFromForm(form);

  const showRuntimeDatasourcePicker = useMemo(
    () => metricsNeedDataSource(draftMetrics),
    [draftMetrics],
  );

  const resolvedDefaultDsId = useMemo(
    () => defaultDsId.trim() || resolveAnalyticsDatasourceId(dsItems),
    [defaultDsId, dsItems],
  );

  useEffect(() => {
    if (isLoading) return;
    setDraftMetrics(metrics);
    setDefaultDsId(defaultDataSourceId ?? "");
    resetBaseline({
      metrics,
      defaultDataSourceId: defaultDataSourceId ?? "",
    });
    resetForm();
    setChangeNote("");
  }, [nodeId, metrics, defaultDataSourceId, resetBaseline, isLoading]);

  useEffect(() => {
    if (readOnly || dsItems.length === 0) return;
    const analyticsId = resolveAnalyticsDatasourceId(dsItems, defaultDataSourceId ?? undefined);
    if (!analyticsId) return;
    setDefaultDsId((current) => current || analyticsId);
  }, [dsItems, defaultDataSourceId, readOnly]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingKey(null);
  };

  const validateFormMetric = (metric: ExtensionMetric) => {
    const keyError = metricKeyValidationMessage(metric.key);
    if (keyError) {
      toast.error(keyError);
      return false;
    }
    if (!metric.datasetId || !metric.boundConfigId) {
      toast.error("须选择数据集并完成查询绑定");
      return false;
    }
    return true;
  };

  const handleApplyMetric = () => {
    const metric = buildMetricFromForm(form);
    if (!metric) {
      toast.error("请填写指标键与显示名");
      return;
    }
    if (!validateFormMetric(metric)) return;
    const duplicate = draftMetrics.some((m) => m.key === metric.key && m.key !== editingKey);
    if (duplicate) {
      toast.error("指标键已存在");
      return;
    }
    setDraftMetrics((prev) => {
      if (editingKey) return prev.map((m) => (m.key === editingKey ? metric : m));
      return [...prev, metric];
    });
    resetForm();
  };

  const handleDelete = (key: string) => {
    setDraftMetrics((prev) => prev.filter((m) => m.key !== key));
    if (editingKey === key) resetForm();
  };

  const handleEdit = (metric: ExtensionMetric) => {
    setEditingKey(metric.key);
    setForm(formFromMetric(metric));
  };

  const hasPendingForm = pendingMetric !== null;
  const canSave =
    !readOnly &&
    (isDirty || hasPendingForm || changeNote.trim().length > 0) &&
    !saveExtension.isPending;

  const handleSave = async (): Promise<boolean> => {
    if (!changeNote.trim()) {
      toast.error("请填写变更说明");
      return false;
    }
    let nextMetrics = [...draftMetrics];
    const pending = buildMetricFromForm(form);
    if (pending) {
      if (!validateFormMetric(pending)) return false;
      const duplicate = draftMetrics.some((m) => m.key === pending.key && m.key !== editingKey);
      if (duplicate) {
        toast.error("指标键已存在");
        return false;
      }
      if (editingKey) {
        nextMetrics = nextMetrics.map((m) => (m.key === editingKey ? pending : m));
      } else if (!nextMetrics.some((m) => m.key === pending.key)) {
        nextMetrics.push(pending);
      }
    }
    if (metricsNeedDataSource(nextMetrics)) {
      const saveDsId = resolveExtensionDefaultDataSourceId(nextMetrics, dsItems, defaultDsId);
      if (!saveDsId) {
        toast.error("请选择运行数据源");
        return false;
      }
      try {
        await saveExtension.mutateAsync({
          nodeId,
          body: {
            catalogNodeId: nodeId,
            metrics: nextMetrics,
            filters,
            changeNote: changeNote.trim(),
            defaultDataSourceId: saveDsId,
          },
        });
        toast.success("扩展配置已保存");
        resetForm();
        setChangeNote("");
        markSaved({
          metrics: nextMetrics,
          defaultDataSourceId: saveDsId,
        });
        setDraftMetrics(nextMetrics);
        setDefaultDsId(saveDsId);
        return true;
      } catch (err) {
        toast.error(mapApiError(err));
        return false;
      }
    }
    try {
      await saveExtension.mutateAsync({
        nodeId,
        body: {
          catalogNodeId: nodeId,
          metrics: nextMetrics,
          filters,
          changeNote: changeNote.trim(),
        },
      });
      toast.success("扩展配置已保存");
      resetForm();
      setChangeNote("");
      markSaved({
        metrics: nextMetrics,
        defaultDataSourceId: defaultDsId,
      });
      setDraftMetrics(nextMetrics);
      return true;
    } catch (err) {
      toast.error(mapApiError(err));
      return false;
    }
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSave();
    if (ok) confirmLeave();
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {draftMetrics.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          暂无扩展指标。请填写下方表单 → 点「添加到列表」→ 填变更说明 →「保存扩展配置」；保存后可在「预览」查看。
        </p>
      ) : (
        <ul className="space-y-2">
          {draftMetrics.map((m) => (
            <li
              key={m.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 text-theme-sm dark:border-gray-800"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-800 dark:text-white/90">{m.label}</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="light" color="info">
                    数据集
                  </Badge>
                  <code className="text-theme-xs text-gray-500 dark:text-gray-400">{m.key}</code>
                </div>
              </div>
              {!readOnly ? (
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`编辑 ${m.label}`}
                    onClick={() => handleEdit(m)}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`删除 ${m.label}`}
                    onClick={() => handleDelete(m.key)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
        <div className="space-y-4 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
          <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
            {editingKey ? "编辑指标" : "添加指标"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="metric-key">指标键</Label>
              <Input
                id="metric-key"
                value={form.metricKey}
                disabled={Boolean(editingKey)}
                placeholder="如 revenue"
                onChange={(e) => setForm((f) => ({ ...f, metricKey: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="metric-label">显示名</Label>
              <Input
                id="metric-label"
                value={form.metricLabel}
                placeholder="如 营收"
                onChange={(e) => setForm((f) => ({ ...f, metricLabel: e.target.value }))}
              />
            </div>
            <ExtensionRuntimeDatasourceField
              mode={showRuntimeDatasourcePicker ? "picker" : "readonly"}
              value={showRuntimeDatasourcePicker ? defaultDsId : resolvedDefaultDsId}
              items={dsItems}
              loading={dsQuery.isLoading}
              error={dsQuery.isError ? dsQuery.error : undefined}
              onChange={setDefaultDsId}
            />
          </div>
          <ReportMetricDatasetFields
              datasetId={form.datasetId}
              boundConfigId={form.boundConfigId}
              onDatasetIdChange={(id) =>
                setForm((f) => ({ ...f, datasetId: id, boundConfigId: "" }))
              }
              onBoundConfigIdChange={(id) => {
                setForm((f) => ({ ...f, boundConfigId: id }));
                if (editingKey) {
                  setDraftMetrics((prev) =>
                    prev.map((m) => (m.key === editingKey ? { ...m, boundConfigId: id } : m)),
                  );
                  if (!changeNote.trim()) {
                    setChangeNote("更新出图字段绑定");
                  }
                }
              }}
              onSuggestedDataSourceId={(id) => {
                if (id) setDefaultDsId(id);
              }}
            />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleApplyMetric}>
              {editingKey ? "更新到列表" : "添加到列表"}
            </Button>
            {editingKey ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                取消编辑
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Label htmlFor="change-note">变更说明</Label>
            <Textarea
              id="change-note"
              value={changeNote}
              placeholder="必填，如：改用数据集"
              onChange={(e) => setChangeNote(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saveExtension.isPending ? "保存中…" : "保存扩展配置"}
          </Button>
        </div>
      ) : null}
      <UnsavedLeaveDialog
        open={leaveDialogOpen}
        saving={saveExtension.isPending}
        entityLabel="报表扩展配置"
        onStay={cancelLeave}
        onDiscardLeave={confirmLeave}
        onSaveAndLeave={handleSaveAndLeave}
      />
    </div>
  );
}
