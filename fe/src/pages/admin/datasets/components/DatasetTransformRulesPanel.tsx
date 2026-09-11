import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useListBatchMode } from "@/components/layout/list-batch-delete";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { useFormDirtyState } from "@/hooks/use-form-dirty-state";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Skeleton } from "@/components/ui/skeleton";
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
import { EtlRulesEditor } from "@/pages/admin/ingestion/components/EtlRulesEditor";
import { type EtlRule } from "@/pages/admin/ingestion/components/EtlRuleCard";

type TransformRulesResponse = {
  datasetId: string;
  rules: EtlRule[];
  queryPandasApplies: boolean;
};

function emptyRule(type = "rename_column"): EtlRule {
  if (type === "rename_column") return { type, from: "", to: "" };
  if (type === "cast_type") return { type, column: "", to: "float" };
  if (type === "fill_null") return { type, column: "", value: "" };
  return { type, column: "", op: "ne", value: "" };
}

function serializeRules(rules: EtlRule[]): string {
  return JSON.stringify(rules);
}

export function DatasetTransformRulesPanel({
  datasetId,
  columnNames,
  columnsLoading,
  hasDataSource,
  disabledReason,
  etlRulesHref,
}: {
  datasetId: string;
  columnNames: string[];
  columnsLoading: boolean;
  hasDataSource: boolean;
  disabledReason?: string | null;
  etlRulesHref?: string | null;
}) {
  const [rules, setRules] = useState<EtlRule[]>([]);
  const [queryPandasApplies, setQueryPandasApplies] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState(false);
  const [alignConfirmOpen, setAlignConfirmOpen] = useState(false);

  const readOnly = Boolean(disabledReason) || !queryPandasApplies;

  const { isDirty, isBaselineReady, resetBaseline, markSaved } = useFormDirtyState(
    rules,
    serializeRules,
  );

  const rowIds = useMemo(() => rules.map((_, index) => String(index)), [rules]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFieldErrors(false);
    try {
      const data = await apiFetch<TransformRulesResponse>(
        `/api/v1/datasets/${datasetId}/transform-rules`,
      );
      setRules(data.rules);
      setQueryPandasApplies(data.queryPandasApplies);
      resetBaseline(data.rules);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }, [datasetId, resetBaseline]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const removeSelectedRules = () => {
    const indices = new Set([...selection.selectedIds].map(Number));
    setRules((prev) => prev.filter((_, i) => !indices.has(i)));
    selection.clear();
  };

  const handleSave = async () => {
    setSaving(true);
    setFieldErrors(false);
    try {
      const data = await apiFetch<TransformRulesResponse>(
        `/api/v1/datasets/${datasetId}/transform-rules`,
        { method: "PUT", body: JSON.stringify({ rules }) },
      );
      setRules(data.rules);
      setQueryPandasApplies(data.queryPandasApplies);
      markSaved(data.rules);
      toast.success("查询清洗规则已保存");
    } catch (err) {
      setFieldErrors(true);
      toast.error(mapApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const runAutoAlign = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<TransformRulesResponse>(
        `/api/v1/datasets/${datasetId}/transform-rules/auto-align`,
        { method: "POST" },
      );
      setRules(data.rules);
      setQueryPandasApplies(data.queryPandasApplies);
      resetBaseline(data.rules);
      toast.success(`已对齐 ${data.rules.length} 条规则`);
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setSaving(false);
      setAlignConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 px-6 py-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="px-6 py-4">
        <Alert severity="info" appearance="subtle" className="rounded-xl">
          <AlertTitle className="text-theme-sm">同步产物无需配置查询清洗</AlertTitle>
          <AlertDescription className="text-theme-xs leading-relaxed">
            {disabledReason ??
              "此 Dataset 由同步任务产出，数据已在写入托管分析库前完成清洗。出图查询不会再次执行 pandas 清洗。"}
            {etlRulesHref ? (
              <span className="mt-3 block">
                <Button asChild variant="outline" size="sm">
                  <Link to={etlRulesHref}>前往同步任务清洗规则</Link>
                </Button>
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? <PageErrorBanner message={error} onRetry={() => void loadRules()} /> : null}
      <EtlRulesEditor
        variant="dataset-query"
        rules={rules}
        columnNames={columnNames}
        columnsLoading={columnsLoading}
        columnsReady={columnNames.length > 0}
        hasDataSource={hasDataSource}
        fieldErrors={fieldErrors}
        isDirty={isBaselineReady && isDirty}
        saving={saving}
        batchMode={batch.batchMode}
        selectedCount={selection.selectedIds.size}
        showDemoTemplate={false}
        demoSourceTable=""
        onToggleBatchMode={batch.toggleBatchMode}
        onClearSelection={selection.clear}
        onRemoveSelected={removeSelectedRules}
        onAddRule={() => setRules((prev) => [...prev, emptyRule()])}
        onAutoAlign={() => setAlignConfirmOpen(true)}
        onApplyDemoTemplate={() => undefined}
        onSave={() => void handleSave()}
        onRemoveRule={(index) => setRules((prev) => prev.filter((_, i) => i !== index))}
        onTypeChange={(index, type) =>
          setRules((prev) => prev.map((rule, i) => (i === index ? emptyRule(type) : rule)))
        }
        onFieldChange={(index, key, value) =>
          setRules((prev) =>
            prev.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule)),
          )
        }
        isSelected={(index) => selection.selectedIds.has(String(index))}
        onToggleSelect={(index) => selection.toggle(String(index))}
      />

      <AlertDialog open={alignConfirmOpen} onOpenChange={setAlignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一键对齐全部列？</AlertDialogTitle>
            <AlertDialogDescription>
              将根据当前物理表列元数据重新生成规则并覆盖未保存的编辑内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="primary" onClick={() => void runAutoAlign()}>确认对齐</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
