import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Copy, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { AdminPageHeaderIcon, AdminPageShell } from "@/components/layout/admin-page-shell";
import { ListPagePagination, ListPageSection } from "@/components/layout/list-page-kit";
import { apiFetch } from "@/lib/api";
import { hasCapability } from "@/lib/capabilities";
import { localizeApiMessage, mapApiError } from "@/lib/apiError";
import { isSourceUnavailable } from "@/lib/sourceHealth";
import type { SourceHealth } from "@/lib/sourceHealth";
import { sessionUserFromMe } from "@/lib/session";
import { sliceListPage, useListPagination } from "@/lib/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceHealthAlert } from "@/components/datasources/SourceHealthAlert";
import { SyncConsumeActionCard } from "./components/SyncConsumeActionCard";
import { type SyncJobListResponse, type SyncJobSummary } from "./components/sync-job-types";

const RUNS_FETCH_LIMIT = 100;

type SyncRunItem = {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_synced: number | null;
  rows_truncated?: boolean;
  consume_warning?: string | null;
  error_message: string | null;
  trace_id: string;
  retry_count: number;
};

type SyncRunListResponse = {
  items: SyncRunItem[];
};

function statusBadge(status: string) {
  if (status === "succeeded" || status === "succeeded_with_warnings") {
    return { color: "success" as const, label: status === "succeeded_with_warnings" ? "成功（有警告）" : "成功" };
  }
  if (status === "failed") return { color: "error" as const, label: "失败" };
  return { color: "warning" as const, label: "运行中" };
}

const historyPageIcon = (
  <AdminPageHeaderIcon>
    <History className="size-6" aria-hidden />
  </AdminPageHeaderIcon>
);

export function SyncJobHistoryPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = useMemo(
    () => (user ? hasCapability(sessionUserFromMe(user), "ingestion:manage") : false),
    [user],
  );
  const [runs, setRuns] = useState<SyncRunItem[]>([]);
  const [targetTable, setTargetTable] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth>("none");
  const [sharedTargetJobNames, setSharedTargetJobNames] = useState<string[]>([]);
  const pagination = useListPagination();

  const loadRuns = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [data, job] = await Promise.all([
        apiFetch<SyncRunListResponse>(
          `/api/v1/ingestion/sync-jobs/${id}/runs?limit=${RUNS_FETCH_LIMIT}`,
        ),
        apiFetch<{ target_table: string; name: string; source_health?: SourceHealth }>(
          `/api/v1/ingestion/sync-jobs/${id}`,
        ),
      ]);
      setRuns(data.items);
      setTargetTable(job.target_table);
      setJobName(job.name);
      setSourceHealth(job.source_health ?? "none");
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!id || !targetTable) {
      setSharedTargetJobNames([]);
      return;
    }
    void apiFetch<SyncJobListResponse>("/api/v1/ingestion/sync-jobs")
      .then((data) => {
        setSharedTargetJobNames(
          data.items
            .filter((job) => job.id !== id && job.target_table === targetTable)
            .map((job) => job.name),
        );
      })
      .catch(() => setSharedTargetJobNames([]));
  }, [id, targetTable]);

  const pagedRuns = useMemo(
    () => sliceListPage(runs, pagination.offset, pagination.pageSize),
    [runs, pagination.offset, pagination.pageSize],
  );

  const copyTraceId = async (traceId: string) => {
    try {
      await navigator.clipboard.writeText(traceId);
      toast.success("Trace ID 已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  const handleRetry = async () => {
    if (!id || retrying) return;
    setRetrying(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/ingestion/sync-jobs/${id}/run`, { method: "POST" });
      toast.success("已重新触发同步");
      await loadRuns();
    } catch (err) {
      const message = mapApiError(err);
      setError(message);
      toast.error(message);
    } finally {
      setRetrying(false);
    }
  };

  const hasSucceededRun = useMemo(
    () => runs.some((run) => run.status === "succeeded" || run.status === "succeeded_with_warnings"),
    [runs],
  );

  const latestSucceededRun = useMemo(
    () =>
      runs
        .filter((run) => run.status === "succeeded" || run.status === "succeeded_with_warnings")
        .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))[0],
    [runs],
  );

  return (
    <AdminPageShell
      layout="list"
      title="运行历史"
      description={`查看同步任务每次运行的状态、行数与 Trace ID。列表最多展示最近 ${RUNS_FETCH_LIMIT} 次运行。`}
      icon={historyPageIcon}
      actions={
        <div className="flex items-center gap-2">
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={retrying}
              disabled={isSourceUnavailable(sourceHealth)}
              title={isSourceUnavailable(sourceHealth) ? "数据源不可用，无法运行同步" : undefined}
              onClick={() => void handleRetry()}
            >
              <RotateCcw className="size-4" aria-hidden />
              重新同步
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void loadRuns()}>
            刷新
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/ingestion/sync-jobs">返回列表</Link>
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="shrink-0">
          <PageErrorBanner message={error} onRetry={() => void loadRuns()} />
        </div>
      ) : null}

      {isSourceUnavailable(sourceHealth) && id ? (
        <div className="shrink-0 px-6 pt-4">
          <SourceHealthAlert health={sourceHealth} entity="sync_job" />
          <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
            <Link
              to={`/admin/ingestion/sync-jobs/${id}/edit`}
              className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              前往编辑任务
            </Link>
            ，更换或恢复数据连接后再重试同步。
          </p>
        </div>
      ) : null}

      <ListPageSection>
        {hasSucceededRun && targetTable && id ? (
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <SyncConsumeActionCard
              jobId={id}
              jobName={jobName ?? undefined}
              targetTable={targetTable}
              rowsSynced={latestSucceededRun?.rows_synced}
              consumeWarning={latestSucceededRun?.consume_warning ?? undefined}
              sharedTargetJobNames={sharedTargetJobNames}
              canManage={canManage}
              onUpdated={() => void loadRuns()}
            />
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="px-6 py-16 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            暂无运行记录
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-x-only">
              <table className="w-full min-w-[880px] text-left text-theme-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">状态</th>
                    <th className="px-6 py-4 font-medium">开始时间</th>
                    <th className="px-6 py-4 font-medium">同步行数</th>
                    <th className="px-6 py-4 font-medium">重试</th>
                    <th className="px-6 py-4 font-medium">错误信息</th>
                    <th className="px-6 py-4 font-medium">Trace ID</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRuns.map((run) => {
                    const badge = statusBadge(run.status);
                    return (
                      <tr
                        key={run.id}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                      >
                        <td className="px-6 py-4">
                          <Badge color={badge.color} variant="light">
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                          {new Date(run.started_at).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                          {run.rows_synced ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                          {run.retry_count > 0 ? run.retry_count : "—"}
                        </td>
                        <td className="max-w-xs px-6 py-4 text-gray-600 dark:text-gray-300">
                          {run.error_message ? (
                            <TruncateHint title={localizeApiMessage(run.error_message)}>
                              {localizeApiMessage(run.error_message)}
                            </TruncateHint>
                          ) : run.consume_warning ? (
                            <TruncateHint title={run.consume_warning}>
                              <span className="text-warning-600 dark:text-warning-400">
                                {run.consume_warning}
                              </span>
                            </TruncateHint>
                          ) : run.rows_truncated ? (
                            <span className="text-warning-600 dark:text-warning-400">
                              已达同步行数上限，可能仍有未同步数据
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[120px] truncate font-mono text-xs text-gray-500">
                              {run.trace_id}
                            </span>
                            <IconButton
                              type="button"
                              variant="ghost"
                              size="xs"
                              aria-label="复制 Trace ID"
                              onClick={() => void copyTraceId(run.trace_id)}
                            >
                              <Copy className="size-3.5" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListPagePagination
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={runs.length}
              showSizeChanger
              onChange={pagination.onPageChange}
            />
          </>
        )}
      </ListPageSection>
    </AdminPageShell>
  );
}
