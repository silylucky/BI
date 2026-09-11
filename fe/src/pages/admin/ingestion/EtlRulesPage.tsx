import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeaderIcon, AdminPageShell } from "@/components/layout/admin-page-shell";
import { ADMIN_PAGE_SURFACE_CLASS } from "@/components/layout/list-page-kit";
import { useListBatchMode } from "@/components/layout/list-batch-delete";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { useFormDirtyState } from "@/hooks/use-form-dirty-state";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { UnsavedLeaveDialog } from "@/components/ui/unsaved-leave-dialog";
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
import { cn } from "@/lib/utils";
import {
  DIRTY_ORDERS_DEMO_ETL_RULES,
  DIRTY_ORDERS_DEMO_SOURCE_TABLE,
} from "./etlDemoTemplate";
import { EtlRulesEditor } from "./components/EtlRulesEditor";
import { type EtlRule } from "./components/EtlRuleCard";
import { useSyncJobSourceColumns } from "./hooks/useSyncJobSourceColumns";
import { summarizeEtlRules } from "./etlRuleSuggest";

const etlRulesPageIcon = (
  <AdminPageHeaderIcon>
    <Settings2 className="size-6" aria-hidden />
  </AdminPageHeaderIcon>
);

function emptyRule(type = "rename_column"): EtlRule {
  if (type === "rename_column") return { type, from: "", to: "" };
  if (type === "cast_type") return { type, column: "", to: "float" };
  if (type === "fill_null") return { type, column: "", value: "" };
  return { type, column: "", op: "ne", value: "" };
}

function serializeRules(rules: EtlRule[]): string {
  return JSON.stringify(rules);
}

export function EtlRulesPage() {
  const { id } = useParams();
  const [rules, setRules] = useState<EtlRule[]>([]);
  const { sourceTable, columnNames, columns, columnsLoading, columnsReady, hasDataSource } =
    useSyncJobSourceColumns(id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState(false);
  const [alignConfirmOpen, setAlignConfirmOpen] = useState(false);

  const { isDirty, isBaselineReady, resetBaseline, markSaved } = useFormDirtyState(
    rules,
    serializeRules,
  );

  const leaveGuardEnabled = isBaselineReady && isDirty;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: leaveGuardEnabled,
  });

  const rowIds = useMemo(() => rules.map((_, index) => String(index)), [rules]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const removeSelectedRules = () => {
    const indices = new Set([...selection.selectedIds].map(Number));
    setRules((prev) => prev.filter((_, i) => !indices.has(i)));
    selection.clear();
  };

  const loadRules = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setFieldErrors(false);
    try {
      const rulesData = await apiFetch<{ rules: EtlRule[] }>(
        `/api/v1/ingestion/sync-jobs/${id}/etl-rules`,
      );
      setRules(rulesData.rules);
      resetBaseline(rulesData.rules);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id, resetBaseline]);

  const autoAlignAttemptedRef = useRef(false);

  const runAutoAlign = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!id) return null;
      try {
        const data = await apiFetch<{ rules: EtlRule[] }>(
          `/api/v1/ingestion/sync-jobs/${id}/etl-rules/auto-align`,
          { method: "POST" },
        );
        setRules(data.rules);
        resetBaseline(data.rules);
        setError(null);
        setFieldErrors(false);
        if (!options?.silent) {
          if (data.rules.length > 0) {
            toast.success(`已扫描全部列并生成 ${data.rules.length} 条规则`);
          } else {
            toast.info("未生成额外规则；同步时仍会执行默认自动清洗");
          }
        }
        return data.rules;
      } catch (err) {
        if (!options?.silent) {
          setError(mapApiError(err));
        }
        return null;
      }
    },
    [id, resetBaseline],
  );

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    if (loading || !isBaselineReady || autoAlignAttemptedRef.current || !id) return;
    if (rules.length > 0) {
      autoAlignAttemptedRef.current = true;
      return;
    }
    if (!columnsReady) return;
    autoAlignAttemptedRef.current = true;
    void runAutoAlign({ silent: true });
  }, [columnsReady, id, isBaselineReady, loading, rules.length, runAutoAlign]);

  const updateRule = (index: number, key: string, value: string) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule)),
    );
  };

  const changeRuleType = (index: number, type: string) => {
    setRules((prev) => prev.map((rule, i) => (i === index ? emptyRule(type) : rule)));
  };

  const handleSave = async (): Promise<boolean> => {
    if (!id) return false;
    if (saving) return false;
    for (const rule of rules) {
      if (
        rule.type === "rename_column" &&
        (!(rule.from?.trim()) || !(rule.to?.trim()))
      ) {
        setFieldErrors(true);
        setError("请填写完整的列重命名规则");
        return false;
      }
      if (
        (rule.type === "cast_type" ||
          rule.type === "fill_null" ||
          rule.type === "filter_rows") &&
        !(rule.column?.trim())
      ) {
        setFieldErrors(true);
        setError("请填写规则涉及的列名");
        return false;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/ingestion/sync-jobs/${id}/etl-rules`, {
        method: "PUT",
        body: JSON.stringify({ rules }),
      });
      setFieldErrors(false);
      markSaved(rules);
      toast.success("清洗规则已保存");
      return true;
    } catch (err) {
      setError(mapApiError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSave();
    if (ok) confirmLeave();
  };

  const applyDirtyOrdersDemoTemplate = () => {
    setRules([...DIRTY_ORDERS_DEMO_ETL_RULES]);
    setError(null);
    setFieldErrors(false);
  };

  const applyAutoSuggestedRules = () => {
    if (!columnsReady || columns.length === 0) {
      toast.warning("未能加载源表列信息，请确认同步任务已选业务源连接与源表");
      return;
    }
    const hasExistingRules = rules.some((rule) =>
      Object.entries(rule).some(([key, value]) => key !== "type" && Boolean(value?.trim())),
    );
    if (hasExistingRules) {
      setAlignConfirmOpen(true);
      return;
    }
    void runAutoAlign();
  };

  const pageDescription = useMemo(() => {
    if (!isBaselineReady) return "加载清洗规则中…";
    if (isDirty) return "有未保存的更改 · 保存后生效";
    return `已保存 · ${summarizeEtlRules(rules)}`;
  }, [isBaselineReady, isDirty, rules]);

  if (loading) {
    return (
      <AdminPageShell layout="fill" title="清洗规则" icon={etlRulesPageIcon}>
        <Skeleton className="h-full min-h-[480px] w-full rounded-2xl" />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      layout="fill"
      title="清洗规则"
      icon={etlRulesPageIcon}
      description={pageDescription}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/ingestion/sync-jobs">返回列表</Link>
        </Button>
      }
    >
      <div className={cn(ADMIN_PAGE_SURFACE_CLASS, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
        {error ? (
          <div className="shrink-0 border-b border-gray-100 px-5 py-4 dark:border-gray-800 lg:px-8">
            <PageErrorBanner message={error} onRetry={() => void loadRules()} />
          </div>
        ) : null}

        <EtlRulesEditor
          rules={rules}
          columnNames={columnNames}
          columnsLoading={columnsLoading}
          columnsReady={columnsReady}
          hasDataSource={hasDataSource}
          fieldErrors={fieldErrors}
          isDirty={isDirty}
          saving={saving}
          batchMode={batch.batchMode}
          selectedCount={selection.selectedCount}
          showDemoTemplate={sourceTable?.trim().toLowerCase() === DIRTY_ORDERS_DEMO_SOURCE_TABLE}
          demoSourceTable={DIRTY_ORDERS_DEMO_SOURCE_TABLE}
          onToggleBatchMode={batch.toggleBatchMode}
          onClearSelection={selection.clear}
          onRemoveSelected={removeSelectedRules}
          onAddRule={() => setRules((prev) => [...prev, emptyRule()])}
          onAutoAlign={applyAutoSuggestedRules}
          onApplyDemoTemplate={applyDirtyOrdersDemoTemplate}
          onSave={() => void handleSave()}
          onRemoveRule={(index) => setRules((prev) => prev.filter((_, i) => i !== index))}
          onTypeChange={changeRuleType}
          onFieldChange={updateRule}
          isSelected={(index) => selection.isSelected(String(index))}
          onToggleSelect={(index) => selection.toggle(String(index))}
        />
      </div>

      <UnsavedLeaveDialog
        open={leaveDialogOpen}
        saving={saving}
        entityLabel="清洗规则"
        onStay={cancelLeave}
        onDiscardLeave={confirmLeave}
        onSaveAndLeave={handleSaveAndLeave}
      />

      <AlertDialog open={alignConfirmOpen} onOpenChange={setAlignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖当前规则？</AlertDialogTitle>
            <AlertDialogDescription>
              一键对齐将覆盖当前已填写的清洗规则，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              onClick={() => {
                setAlignConfirmOpen(false);
                void runAutoAlign();
              }}
            >
              继续对齐
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
