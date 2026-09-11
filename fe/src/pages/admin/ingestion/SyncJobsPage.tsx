import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { hasCapability } from "@/lib/capabilities";
import { sessionUserFromMe } from "@/lib/session";
import {
  BatchDeleteDialog,
  ListPageBatchActions,
  useListBatchMode,
} from "@/components/layout/list-batch-delete";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { runBatchDelete } from "@/lib/runBatchDelete";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { ListPagePagination, ListPageSection, ListPageTableFrame } from "@/components/layout/list-page-kit";
import { ListGhostEmptyState } from "@/components/ui/panel-empty-state";
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
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { SyncConsumeActionCard } from "./components/SyncConsumeActionCard";
import { SyncJobsEmptyState } from "./components/SyncJobsEmptyState";
import { SyncJobsMetrics } from "./components/SyncJobsMetrics";
import { SyncJobsTable } from "./components/SyncJobsTable";
import {
  SyncJobsToolbar,
  type SyncJobStatusFilter,
} from "./components/SyncJobsToolbar";
import { type SyncJobListResponse, type SyncJobSummary, type SyncRunSuccessPayload, isSyncRunActive, isSyncRunSucceeded, syncRunCompletionToast, syncRunSuccessFromJob } from "./components/sync-job-types";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { sliceListPage, useListPagination } from "@/lib/list-pagination";
import { cn } from "@/lib/utils";

type RecentRunSuccess = SyncRunSuccessPayload;

function filterByStatus(jobs: SyncJobSummary[], statusFilter: SyncJobStatusFilter) {
  switch (statusFilter) {
    case "enabled":
      return jobs.filter((job) => job.enabled);
    case "disabled":
      return jobs.filter((job) => !job.enabled);
    case "scheduled":
      return jobs.filter((job) => Boolean(job.schedule_cron));
    default:
      return jobs;
  }
}

export function SyncJobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = useMemo(
    () => (user ? hasCapability(sessionUserFromMe(user), "ingestion:manage") : false),
    [user],
  );
  const pollTimerRef = useRef<number | null>(null);
  const [jobs, setJobs] = useState<SyncJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SyncJobStatusFilter>("all");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [runTarget, setRunTarget] = useState<SyncJobSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SyncJobSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [recentRunSuccess, setRecentRunSuccess] = useState<RecentRunSuccess | null>(null);
  const pagination = useListPagination(undefined, [search, statusFilter]);

  const loadJobs = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await apiFetch<SyncJobListResponse>("/api/v1/ingestion/sync-jobs");
      setJobs(data.items);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const startRunPolling = useCallback(
    (jobId: string, jobName: string) => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
      setPollingJobId(jobId);
      const pollIntervalMs = 2000;
      const pollMaxTicks = 30;
      let ticks = 0;
      const stopPolling = () => {
        if (pollTimerRef.current !== null) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setPollingJobId((current) => (current === jobId ? null : current));
      };
      const pollOnce = async () => {
        ticks += 1;
        try {
          const data = await apiFetch<SyncJobListResponse>("/api/v1/ingestion/sync-jobs");
          setJobs(data.items);
          const job = data.items.find((item) => item.id === jobId);
          const status = job?.last_run?.status;
          if (isSyncRunSucceeded(status) && job) {
            stopPolling();
            const payload = syncRunSuccessFromJob(job);
            if (!payload) {
              return;
            }
            setRecentRunSuccess(payload);
            const message = syncRunCompletionToast(jobName, payload, status);
            const hasWarning = status === "succeeded_with_warnings" || Boolean(payload.consumeWarning);
            if (hasWarning) {
              toast.warning(message, { duration: 10_000 });
            } else {
              toast.success(message, { duration: 8000 });
            }
            return;
          }
          if (status === "failed") {
            stopPolling();
            toast.error(`任务「${jobName}」同步失败，请查看运行历史`);
            return;
          }
          if (status === "cancelled") {
            stopPolling();
            toast.message(`任务「${jobName}」已停止`);
            return;
          }
          if (ticks >= pollMaxTicks) {
            stopPolling();
            if (isSyncRunActive(status)) {
              toast.warning(`任务「${jobName}」仍在运行中，请稍后刷新或查看运行历史`, {
                duration: 10_000,
                action: {
                  label: "查看历史",
                  onClick: () => navigate(`/admin/ingestion/sync-jobs/${jobId}/history`),
                },
              });
            }
          }
        } catch {
          /* 轮询失败忽略，下一轮重试 */
        }
      };
      void pollOnce();
      pollTimerRef.current = window.setInterval(() => {
        void pollOnce();
      }, pollIntervalMs);
    },
    [navigate],
  );

  const sharedTargetJobNames = useMemo(() => {
    if (!recentRunSuccess) return [];
    return jobs
      .filter(
        (job) =>
          job.id !== recentRunSuccess.jobId &&
          job.target_table === recentRunSuccess.targetTable,
      )
      .map((job) => job.name);
  }, [jobs, recentRunSuccess]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const stats = useMemo(
    () => ({
      total: jobs.length,
      enabled: jobs.filter((j) => j.enabled).length,
      disabled: jobs.filter((j) => !j.enabled).length,
      scheduled: jobs.filter((j) => j.schedule_cron).length,
    }),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStatus = filterByStatus(jobs, statusFilter);
    if (!q) return byStatus;
    return byStatus.filter(
      (job) =>
        job.name.toLowerCase().includes(q) ||
        job.target_table.toLowerCase().includes(q) ||
        job.source_type.toLowerCase().includes(q),
    );
  }, [jobs, search, statusFilter]);

  const pagedJobs = useMemo(
    () => sliceListPage(filteredJobs, pagination.offset, pagination.pageSize),
    [filteredJobs, pagination.offset, pagination.pageSize],
  );

  const rowIds = useMemo(() => pagedJobs.map((job) => job.id), [pagedJobs]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const resultLabel = useMemo(() => {
    const hasFilter = Boolean(search.trim()) || statusFilter !== "all";
    return hasFilter ? `显示 ${filteredJobs.length} 个` : `共 ${jobs.length} 个任务`;
  }, [filteredJobs.length, jobs.length, search, statusFilter]);

  const handleRun = async (job: SyncJobSummary) => {
    setRecentRunSuccess(null);
    setRunningId(job.id);
    try {
      await apiFetch(`/api/v1/ingestion/sync-jobs/${job.id}/run`, { method: "POST" });
      setRunTarget(null);
      toast.success(`任务「${job.name}」已开始同步`, {
        action: {
          label: "查看历史",
          onClick: () => navigate(`/admin/ingestion/sync-jobs/${job.id}/history`),
        },
      });
      void loadJobs({ silent: true });
      startRunPolling(job.id, job.name);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setRunningId(null);
    }
  };

  const handleCancel = async (job: SyncJobSummary) => {
    setCancellingId(job.id);
    try {
      await apiFetch(`/api/v1/ingestion/sync-jobs/${job.id}/cancel`, { method: "POST" });
      toast.message(`已请求停止「${job.name}」`, {
        description: "将在当前阶段结束后停止，不会中断正在进行的库写入。",
      });
      void loadJobs({ silent: true });
      if (pollingJobId !== job.id) {
        startRunPolling(job.id, job.name);
      }
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setCancellingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/ingestion/sync-jobs/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await loadJobs();
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/ingestion/sync-jobs/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    await loadJobs();
    if (failed === 0) toast.success(`已删除 ${ok} 个同步任务`);
    else toast.warning(`已删除 ${ok} 个，${failed} 个删除失败`);
  };

  return (
    <AdminPageShell
      layout="list"
      title="同步任务"
      icon={
        <AdminPageHeaderIcon>
          <RefreshCw className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      description="管理源库到托管分析库的全量同步任务，配置定时计划与清洗规则。"
      actions={
        canManage ? (
          <Button asChild variant="primary" size="sm">
            <Link to="/admin/ingestion/sync-jobs/new">
              <Plus className="size-4" aria-hidden />
              新建任务
            </Link>
          </Button>
        ) : null
      }
    >
      {error ? (
        <div className="shrink-0">
          <PageErrorBanner message={error} onRetry={() => void loadJobs()} />
        </div>
      ) : null}

      {loading ? (
        <ListPageSection>
          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-xl" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </ListPageSection>
      ) : jobs.length === 0 ? (
        <ListPageSection>
          <SyncJobsEmptyState />
        </ListPageSection>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div
            className={cn(
              "shrink-0 space-y-4",
              // 出图引导卡较高时限制高度并内滚，保证下方列表+分页始终有位且分页贴底
              recentRunSuccess && "max-h-[min(42vh,22rem)] overflow-y-auto custom-scrollbar",
            )}
          >
            <SyncJobsMetrics stats={stats} />
            {recentRunSuccess ? (
              <SyncConsumeActionCard
                jobId={recentRunSuccess.jobId}
                jobName={recentRunSuccess.jobName}
                targetTable={recentRunSuccess.targetTable}
                rowsSynced={recentRunSuccess.rowsSynced}
                consumeWarning={recentRunSuccess.consumeWarning}
                sharedTargetJobNames={sharedTargetJobNames}
                canManage={canManage}
                onDismiss={() => setRecentRunSuccess(null)}
                onUpdated={() => void loadJobs({ silent: true })}
              />
            ) : null}
          </div>
          <ListPageSection className="min-h-0 flex-1">
              <SyncJobsToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                resultLabel={resultLabel}
                trailing={
                  canManage ? (
                    <ListPageBatchActions
                      batchMode={batch.batchMode}
                      onToggleBatchMode={batch.toggleBatchMode}
                      selectedCount={selection.selectedCount}
                      entityLabel="个任务"
                      onClear={selection.clear}
                      onDelete={() => setBatchDeleteOpen(true)}
                    />
                  ) : null
                }
              />
              {filteredJobs.length === 0 ? (
                <ListGhostEmptyState
                  layout="table"
                  icon={<RefreshCw className="size-7" aria-hidden />}
                  title={search.trim() ? "未找到匹配任务" : "当前筛选条件下暂无任务"}
                  description={
                    search.trim()
                      ? `未找到匹配「${search.trim()}」的任务，请调整搜索或筛选。`
                      : "尝试调整状态筛选或新建同步任务。"
                  }
                />
              ) : (
                <>
                  <ListPageTableFrame className="px-0">
                    <div className="overflow-x-only px-5 pb-5">
                      <SyncJobsTable
                        jobs={pagedJobs}
                        canManage={canManage}
                        runningId={runningId}
                        pollingJobId={pollingJobId}
                        cancellingId={cancellingId}
                        onRun={setRunTarget}
                        onCancel={(job) => void handleCancel(job)}
                        onDelete={setDeleteTarget}
                        selectedIds={selection.selectedIds}
                        onToggleSelect={batch.batchMode ? selection.toggle : undefined}
                        onToggleSelectAll={batch.batchMode ? selection.toggleAll : undefined}
                        allSelected={selection.allSelected}
                        someSelected={selection.someSelected}
                      />
                    </div>
                  </ListPageTableFrame>
                  <ListPagePagination
                    current={pagination.page}
                    pageSize={pagination.pageSize}
                    total={filteredJobs.length}
                    showSizeChanger
                    onChange={pagination.onPageChange}
                  />
                </>
              )}
          </ListPageSection>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `确定删除任务「${deleteTarget.name}」？删除后无法恢复，运行历史将一并清除。`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-error-500 text-white shadow-theme-xs hover:bg-error-600 disabled:opacity-50"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={runTarget !== null}
        onOpenChange={(open) => {
          if (!open && runningId === null) setRunTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认手动运行同步？</AlertDialogTitle>
            <AlertDialogDescription>
              {runTarget ? (
                runTarget.sync_mode === "incremental" ? (
                  <>
                    确定立即运行增量任务「{runTarget.name}」？将拉取水位之后的新数据，并按主键
                    <strong className="font-semibold text-warning-600 dark:text-warning-400">
                      upsert
                    </strong>
                    到托管分析库目标表
                    <span className="font-mono"> {runTarget.target_table}</span>，不会清空现有数据。
                  </>
                ) : (
                  <>
                    确定立即运行任务「{runTarget.name}」？将从源表全量读取数据，并
                    <strong className="font-semibold text-error-600 dark:text-error-400">
                      清空并覆盖
                    </strong>
                    托管分析库目标表
                    <span className="font-mono"> {runTarget.target_table}</span> 中的全部现有数据。
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runningId !== null}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="primary"
              disabled={runningId !== null}
              onClick={(event) => {
                event.preventDefault();
                if (runTarget) void handleRun(runTarget);
              }}
            >
              {runningId === runTarget?.id ? "运行中…" : "运行"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        count={selection.selectedCount}
        title="批量删除同步任务"
        pending={batchDeleting}
        onConfirm={() => void handleBatchDelete()}
      />
    </AdminPageShell>
  );
}
