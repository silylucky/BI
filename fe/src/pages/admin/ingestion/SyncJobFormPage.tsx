import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, Play, RefreshCw, Square } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { SourceHealthAlert } from "@/components/datasources/SourceHealthAlert";
import { AdminPageHeaderIcon, AdminPageShell } from "@/components/layout/admin-page-shell";
import { ADMIN_PAGE_SURFACE_CLASS } from "@/components/layout/list-page-kit";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { getApiValidationFieldErrors, mapApiError } from "@/lib/apiError";
import { hasCapability } from "@/lib/capabilities";
import { isSyncSourceCapable } from "@/lib/datasourceRoles";
import { sessionUserFromMe } from "@/lib/session";
import type { SourceHealth } from "@/lib/sourceHealth";
import { isSourceUnavailable } from "@/lib/sourceHealth";
import { useSyncJobRun, type SyncRunSuccess } from "@/hooks/useSyncJobRun";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { UnsavedLeaveDialog } from "@/components/ui/unsaved-leave-dialog";
import { useFormDirtyState } from "@/hooks/use-form-dirty-state";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import {
  defaultSyncSourceObject,
  findJobsSharingTargetTable,
  suggestSyncTargetTable,
  syncSourceObjectLabel,
  syncSourceObjectPlaceholder,
} from "@/lib/suggestSyncTargetTable";
import {
  SyncJobForm,
  SYNC_JOB_FORM_ID,
  type DatasourceItem,
  type JobFormState,
  type LegacyInlineSource,
  type SyncMode,
} from "./components/SyncJobForm";
import { SyncConsumeActionCard } from "./components/SyncConsumeActionCard";
import { isSyncRunSucceeded, type SyncJobLastRun, type SyncJobSummary } from "./components/sync-job-types";

const DEFAULT_SOURCE_TABLE = defaultSyncSourceObject("mysql");

const newJobFormDefaults: JobFormState = {
  name: "",
  sourceDataSourceId: "",
  sourceSchema: "",
  table: DEFAULT_SOURCE_TABLE,
  target_table: "",
  syncMode: "full",
  primaryKey: "id",
  incrementalColumn: "updated_at",
  schedule_cron: "",
  enabled: true,
};

function serializeJobForm(form: JobFormState): string {
  return JSON.stringify(form);
}

const syncJobPageIcon = (
  <AdminPageHeaderIcon>
    <RefreshCw className="size-6" aria-hidden />
  </AdminPageHeaderIcon>
);

function buildPayload(form: JobFormState) {
  return {
    name: form.name,
    target_table: form.target_table,
    schedule_cron: form.schedule_cron || null,
    enabled: form.enabled,
    sync_mode: form.syncMode,
    primary_key: form.syncMode === "incremental" ? form.primaryKey : null,
    incremental_column: form.syncMode === "incremental" ? form.incrementalColumn : null,
    source_mode: "datasource" as const,
    source_data_source_id: form.sourceDataSourceId,
    source_table: form.table,
    source_schema: form.sourceSchema.trim() || null,
  };
}

export function SyncJobFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const canManage = useMemo(
    () => (user ? hasCapability(sessionUserFromMe(user), "ingestion:manage") : false),
    [user],
  );
  const isEdit = Boolean(id);
  const justCreated = Boolean(
    (location.state as { justCreated?: boolean } | null)?.justCreated,
  );
  const navigate = useNavigate();
  const [form, setForm] = useState<JobFormState>(newJobFormDefaults);
  const [legacyInlineSource, setLegacyInlineSource] = useState<LegacyInlineSource | null>(null);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth>("none");
  const [existingJobs, setExistingJobs] = useState<SyncJobSummary[]>([]);
  const [allDatasources, setAllDatasources] = useState<DatasourceItem[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);
  const [recentRunSuccess, setRecentRunSuccess] = useState<SyncRunSuccess | null>(null);
  const [consumeCardDismissed, setConsumeCardDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetTableManualRef = useRef(false);
  const newJobInitializedRef = useRef(false);

  const { runJob, cancelJob, runningId, pollingJobId, cancellingId, runError, clearRunError } = useSyncJobRun({
    onSuccess: (payload) => {
      setConsumeCardDismissed(false);
      setRecentRunSuccess(payload);
    },
  });

  const { isDirty, isBaselineReady, resetBaseline, markSaved } = useFormDirtyState(
    form,
    serializeJobForm,
  );

  const leaveGuardEnabled = isBaselineReady && isDirty;
  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: leaveGuardEnabled,
  });

  useEffect(() => {
    void (async () => {
      try {
        const [dsData, jobsData] = await Promise.all([
          apiFetch<{ items: DatasourceItem[] }>("/api/v1/datasources"),
          apiFetch<{ items: SyncJobSummary[] }>("/api/v1/ingestion/sync-jobs"),
        ]);
        setAllDatasources(dsData.items);
        setExistingJobs(jobsData.items);
        if (!id && !newJobInitializedRef.current) {
          const syncSourceDs = dsData.items.filter((item) => isSyncSourceCapable(item.type));
          const firstDs = syncSourceDs[0];
          const defaultTable = firstDs ? defaultSyncSourceObject(firstDs.type) : DEFAULT_SOURCE_TABLE;
          const suggested = suggestSyncTargetTable(
            defaultTable,
            jobsData.items.map((job) => job.target_table),
          );
          const nextForm: JobFormState = {
            ...newJobFormDefaults,
            table: defaultTable,
            target_table: suggested,
            sourceDataSourceId: firstDs?.id ?? "",
            sourceSchema: "",
          };
          setForm(nextForm);
          resetBaseline(nextForm);
          newJobInitializedRef.current = true;
        }
      } catch {
        setAllDatasources([]);
        setExistingJobs([]);
      }
    })();
  }, [id, resetBaseline]);

  useEffect(() => {
    if (!id) {
      if (!newJobInitializedRef.current) return;
      resetBaseline(form);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const job = await apiFetch<{
          name: string;
          enabled: boolean;
          sync_mode: SyncMode;
          primary_key: string | null;
          incremental_column: string | null;
          source_data_source_id: string | null;
          source: {
            type: string;
            host: string;
            port: number;
            database: string;
            schema?: string | null;
            username: string;
            password: string;
            table: string;
          };
          target_table: string;
          schedule_cron: string | null;
          last_run?: SyncJobLastRun | null;
          source_health?: SourceHealth | null;
        }>(`/api/v1/ingestion/sync-jobs/${id}`);
        const nextForm: JobFormState = {
          name: job.name,
          sourceDataSourceId: job.source_data_source_id ?? "",
          sourceSchema: job.source.schema ?? "",
          table: job.source.table,
          target_table: job.target_table,
          syncMode: job.sync_mode ?? "full",
          primaryKey: job.primary_key ?? "id",
          incrementalColumn: job.incremental_column ?? "updated_at",
          schedule_cron: job.schedule_cron ?? "",
          enabled: job.enabled,
        };
        setForm(nextForm);
        setSourceHealth(job.source_health ?? "none");
        resetBaseline(nextForm);
        targetTableManualRef.current = true;
        setLegacyInlineSource(
          job.source_data_source_id
            ? null
            : {
                host: job.source.host,
                port: job.source.port,
                database: job.source.database,
                username: job.source.username,
              },
        );
        if (isSyncRunSucceeded(job.last_run?.status)) {
          setRecentRunSuccess({
            jobId: id,
            jobName: job.name,
            targetTable: job.target_table,
            rowsSynced: job.last_run?.rows_synced ?? null,
            consumeWarning: job.last_run?.consume_warning ?? null,
          });
        } else {
          setRecentRunSuccess(null);
        }
      } catch (err) {
        setError(mapApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, resetBaseline]);

  const datasources = useMemo(
    () => allDatasources.filter((item) => isSyncSourceCapable(item.type)),
    [allDatasources],
  );

  const selectedDatasource = useMemo(
    () => allDatasources.find((item) => item.id === form.sourceDataSourceId),
    [allDatasources, form.sourceDataSourceId],
  );

  const conflictingJobs = useMemo(
    () => findJobsSharingTargetTable(existingJobs, form.target_table, isEdit ? id : undefined),
    [existingJobs, form.target_table, id, isEdit],
  );

  const canSubmit = Boolean(form.sourceDataSourceId.trim()) && datasources.length > 0;

  const applySuggestedTarget = (sourceTable: string) => {
    const suggested = suggestSyncTargetTable(
      sourceTable,
      existingJobs.map((job) => job.target_table),
    );
    setForm((prev) => ({ ...prev, target_table: suggested }));
    targetTableManualRef.current = false;
  };

  const update = <K extends keyof JobFormState>(key: K, value: JobFormState[K]) => {
    if (key === "target_table") {
      targetTableManualRef.current = true;
    }
    if (key === "table" && !targetTableManualRef.current && typeof value === "string") {
      setForm((prev) => {
        const suggested = suggestSyncTargetTable(
          value,
          existingJobs.map((job) => job.target_table),
        );
        return { ...prev, table: value, target_table: suggested };
      });
      setFieldErrors((prev) => {
        if (!prev.table && !prev.target_table) return prev;
        const next = { ...prev };
        delete next.table;
        delete next.target_table;
        return next;
      });
      return;
    }
    if (key === "sourceDataSourceId") {
      setLegacyInlineSource(null);
      const nextDs = allDatasources.find((item) => item.id === value);
      if (typeof value === "string" && nextDs) {
        setForm((prev) => {
          const shouldResetSource =
            !prev.table.trim() ||
            prev.table === DEFAULT_SOURCE_TABLE ||
            prev.table === defaultSyncSourceObject("rest_api") ||
            prev.table === defaultSyncSourceObject("mysql");
          if (!shouldResetSource) {
            return { ...prev, sourceDataSourceId: value, sourceSchema: "" };
          }
          const nextTable = defaultSyncSourceObject(nextDs.type);
          const suggested = suggestSyncTargetTable(
            nextTable,
            existingJobs.map((job) => job.target_table),
          );
          return {
            ...prev,
            sourceDataSourceId: value,
            sourceSchema: "",
            table: nextTable,
            target_table: targetTableManualRef.current ? prev.target_table : suggested,
          };
        });
        setFieldErrors((prev) => {
          if (!prev.sourceDataSourceId && !prev.table && !prev.target_table) return prev;
          const next = { ...prev };
          delete next.sourceDataSourceId;
          delete next.table;
          delete next.target_table;
          return next;
        });
        return;
      }
      setForm((prev) => ({ ...prev, sourceDataSourceId: value, sourceSchema: "" }));
      setFieldErrors((prev) => {
        if (!prev.sourceDataSourceId) return prev;
        const next = { ...prev };
        delete next.sourceDataSourceId;
        return next;
      });
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const submitPayload = async (): Promise<boolean> => {
    if (submitting) return false;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    const payload = buildPayload(form);
    try {
      if (isEdit && id) {
        await apiFetch(`/api/v1/ingestion/sync-jobs/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("同步任务已更新");
        markSaved(form);
        setLegacyInlineSource(null);
      } else {
        const created = await apiFetch<{ id: string }>("/api/v1/ingestion/sync-jobs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("同步任务已创建", {
          description: "可在此页立即运行同步，成功后一键创建 Dataset 出图。",
        });
        markSaved(form);
        navigate(`/admin/ingestion/sync-jobs/${created.id}/edit`, {
          replace: true,
          state: { justCreated: true },
        });
      }
      return true;
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      setFieldErrors(getApiValidationFieldErrors(err));
      toast.error(message);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event?: FormEvent): Promise<boolean> => {
    event?.preventDefault();
    if (!form.sourceDataSourceId.trim()) {
      const message = "请选择业务源连接；若尚无可用连接，请先在连接管理登记可同步的数据源";
      setError(message);
      toast.error(message);
      return false;
    }
    if (conflictingJobs.length > 0) {
      const message = `目标表 ${form.target_table} 已被任务「${conflictingJobs.map((job) => job.name).join("、")}」使用，请改用其他目标表名`;
      setError(message);
      setFieldErrors({ target_table: message });
      toast.error(message);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      return false;
    }
    return submitPayload();
  };

  const handleSaveAndLeave = async () => {
    const ok = await handleSubmit();
    if (ok) confirmLeave();
  };

  const pageDescription = useMemo(() => {
    if (!isBaselineReady) {
      return "先在连接管理登记业务源连接，再配置同步与目标表。";
    }
    if (datasources.length === 0) {
      return "尚无可用同步源连接 · 请先在连接管理登记";
    }
    if (isDirty) return "有未保存的更改 · 保存后生效";
    return "已保存 · 支持全量覆盖或增量 upsert 到托管分析库";
  }, [datasources.length, isBaselineReady, isDirty]);

  const sharedTargetJobNames = useMemo(() => {
    if (!recentRunSuccess || !id || recentRunSuccess.jobId !== id) return [];
    return existingJobs
      .filter(
        (job) => job.id !== id && job.target_table === recentRunSuccess.targetTable,
      )
      .map((job) => job.name);
  }, [existingJobs, id, recentRunSuccess]);

  const handleConfirmRun = useCallback(async () => {
    if (!id || !form.name.trim()) return;
    setRunConfirmOpen(false);
    clearRunError();
    await runJob({ id, name: form.name.trim() });
  }, [clearRunError, form.name, id, runJob]);

  const showConsumeCard =
    isEdit &&
    id &&
    !consumeCardDismissed &&
    recentRunSuccess?.jobId === id &&
    recentRunSuccess.targetTable === form.target_table;

  if (loading) {
    return (
      <AdminPageShell
        layout="fill"
        title={isEdit ? "编辑同步任务" : "新建同步任务"}
        icon={syncJobPageIcon}
      >
        <Skeleton className="h-full min-h-[480px] w-full rounded-2xl" />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      layout="fill"
      title={isEdit ? "编辑同步任务" : "新建同步任务"}
      icon={syncJobPageIcon}
      description={pageDescription}
      leadingActions={
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/ingestion/sync-jobs">
            <ArrowLeft className="size-4" aria-hidden />
            返回列表
          </Link>
        </Button>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isEdit && canManage && id ? (
            runningId === id || pollingJobId === id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-error-600 hover:text-error-700"
                disabled={cancellingId === id}
                loading={cancellingId === id}
                loadingText="停止中…"
                onClick={() => void cancelJob({ id, name: form.name || "同步任务" })}
              >
                <Square className="size-3.5 fill-current" aria-hidden />
                停止同步
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting || isDirty || isSourceUnavailable(sourceHealth)}
                title={
                  isSourceUnavailable(sourceHealth)
                    ? "数据源不可用，无法运行同步"
                    : isDirty
                      ? "请先保存更改后再运行"
                      : undefined
                }
                onClick={() => setRunConfirmOpen(true)}
              >
                <Play className="size-4" aria-hidden />
                立即运行
              </Button>
            )
          ) : null}
          <Button
            type="submit"
            form={SYNC_JOB_FORM_ID}
            variant="primary"
            size="sm"
            loading={submitting}
            loadingText={isEdit ? "保存中…" : "创建中…"}
            disabled={submitting || !canSubmit || (isEdit && !isDirty)}
            title={!canSubmit ? "请先在连接管理登记可同步的数据源并选择业务源连接" : undefined}
          >
            {isEdit ? "保存" : "创建"}
          </Button>
        </div>
      }
    >
      <div
        className={cn(
          ADMIN_PAGE_SURFACE_CLASS,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-6 py-6 lg:px-8 lg:py-8"
        >
          {error || runError ? (
            <div className="mx-auto mb-6 w-full max-w-3xl shrink-0">
              <PageErrorBanner
                message={error ?? runError ?? ""}
                autoHideMs={0}
                onRetry={() => {
                  setError(null);
                  setFieldErrors({});
                  clearRunError();
                }}
              />
            </div>
          ) : null}

          {isEdit ? (
            <div className="mx-auto mb-6 w-full max-w-3xl shrink-0">
              <SourceHealthAlert health={sourceHealth} entity="sync_job" />
            </div>
          ) : null}

          {showConsumeCard ? (
            <div className="mx-auto mb-6 w-full max-w-3xl shrink-0">
              <SyncConsumeActionCard
                jobId={id!}
                jobName={form.name.trim() || undefined}
                targetTable={recentRunSuccess!.targetTable}
                rowsSynced={recentRunSuccess!.rowsSynced}
                consumeWarning={recentRunSuccess!.consumeWarning}
                sharedTargetJobNames={sharedTargetJobNames}
                canManage={canManage}
                onDismiss={() => setConsumeCardDismissed(true)}
              />
            </div>
          ) : null}

          <SyncJobForm
            form={form}
            isEdit={isEdit}
            jobId={id}
            justCreated={justCreated}
            hideConsumeGuide={showConsumeCard}
            etlRulesHref={isEdit && id ? `/admin/ingestion/sync-jobs/${id}/etl-rules` : undefined}
            datasources={datasources}
            selectedDatasource={selectedDatasource}
            legacyInlineSource={legacyInlineSource}
            fieldErrors={fieldErrors}
            conflictingJobNames={conflictingJobs.map((job) => job.name)}
            onSuggestTargetTable={() => applySuggestedTarget(form.table)}
            onChange={update}
            onSubmit={(event) => void handleSubmit(event)}
          />
        </div>
      </div>
      <UnsavedLeaveDialog
        open={leaveDialogOpen}
        saving={submitting}
        entityLabel="同步任务"
        onStay={cancelLeave}
        onDiscardLeave={confirmLeave}
        onSaveAndLeave={handleSaveAndLeave}
      />

      <AlertDialog open={runConfirmOpen} onOpenChange={setRunConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认手动运行同步？</AlertDialogTitle>
            <AlertDialogDescription>
              {form.syncMode === "full"
                ? "全量同步将清空并覆盖托管分析库中的目标表数据。"
                : "将按增量策略拉取并 upsert 到托管分析库目标表。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runningId === id}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              disabled={runningId === id}
              onClick={() => void handleConfirmRun()}
            >
              确认运行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}
