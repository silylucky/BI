import { Link } from "react-router";
import { useMemo } from "react";
import {
  BarChart3,
  CalendarClock,
  Database,
  Hand,
  History,
  Layers,
  MoreHorizontal,
  Pencil,
  Play,
  RefreshCw,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";
import { ListHeaderCheckbox, ListRowCheckbox, listTableSelectCellClass, listTableSelectHeadClass } from "@/components/layout/list-batch-delete";
import { SourceHealthBadge } from "@/components/datasources/SourceHealthBadge";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HintTooltip, TruncateHint } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import { localizeApiMessage } from "@/lib/apiError";
import { isSourceUnavailable } from "@/lib/sourceHealth";
import {
  consumeActionAriaLabel,
  consumeActionHref,
  consumeLabelColor,
  consumeLabelText,
} from "@/lib/syncConsumeApi";
import {
  isSyncRunActive,
  isSyncRunSucceeded,
  lastRunBadgeColor,
  lastRunStatusLabel,
  sourceSummaryLabel,
  syncModeLabel,
  type SyncJobSummary,
} from "./sync-job-types";

type SyncJobsTableProps = {
  jobs: SyncJobSummary[];
  canManage: boolean;
  runningId: string | null;
  pollingJobId?: string | null;
  cancellingId?: string | null;
  onRun: (job: SyncJobSummary) => void;
  onCancel: (job: SyncJobSummary) => void;
  onDelete: (job: SyncJobSummary) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
};

function LastRunCell({ job }: { job: SyncJobSummary }) {
  const lastRun = job.last_run;
  if (!lastRun) {
    return <span className="text-gray-400">暂无记录</span>;
  }
  return (
    <div className="space-y-1">
      <Badge color={lastRunBadgeColor(lastRun.status)} variant="light" size="sm">
        {lastRunStatusLabel(lastRun.status)}
      </Badge>
      <div className="text-theme-xs text-gray-500 dark:text-gray-400">
        {new Date(lastRun.started_at).toLocaleString("zh-CN")}
      </div>
      {lastRun.status === "succeeded" || lastRun.status === "succeeded_with_warnings" ? (
        <>
          {lastRun.rows_synced != null ? (
            <div className="text-theme-xs text-gray-500">{lastRun.rows_synced} 行</div>
          ) : null}
          {lastRun.consume_warning ? (
            <TruncateHint
              title={lastRun.consume_warning}
              className="max-w-[160px] text-theme-xs text-warning-600 dark:text-warning-400"
            >
              {lastRun.consume_warning}
            </TruncateHint>
          ) : lastRun.rows_truncated ? (
            <div className="text-theme-xs text-warning-600 dark:text-warning-400">已达同步行数上限</div>
          ) : null}
        </>
      ) : null}
      {lastRun.status === "failed" && lastRun.error_message ? (
        <TruncateHint
          title={localizeApiMessage(lastRun.error_message)}
          className="max-w-[160px] text-theme-xs text-error-600 dark:text-error-400"
        >
          {localizeApiMessage(lastRun.error_message)}
        </TruncateHint>
      ) : null}
    </div>
  );
}

function ConsumeReadyCell({ job }: { job: SyncJobSummary }) {
  const lastRun = job.last_run;
  if (!lastRun || (lastRun.status !== "succeeded" && lastRun.status !== "succeeded_with_warnings")) {
    return <span className="text-theme-xs text-gray-400">—</span>;
  }
  if (!job.consume_status) {
    return <span className="text-theme-xs text-gray-400">—</span>;
  }
  return (
    <Badge color={consumeLabelColor(job.consume_status.label)} variant="light" size="sm">
      {consumeLabelText(job.consume_status.label)}
    </Badge>
  );
}

function ConsumeActionButton({ job, canManage }: { job: SyncJobSummary; canManage: boolean }) {
  const lastRun = job.last_run;
  const consume = job.consume_status;
  if (!lastRun || !isSyncRunSucceeded(lastRun.status) || !consume) {
    return null;
  }

  const label = consumeActionAriaLabel(consume.next_action);
  const href = consumeActionHref(job.id, consume.next_action);
  const Icon =
    consume.next_action === "open_dashboard"
      ? BarChart3
      : consume.next_action === "ensure_dataset"
        ? Layers
        : Database;

  if (consume.next_action === "prepare" && !canManage) {
    return (
      <HintTooltip label="分析库尚未就绪，请联系管理员">
        <span className="inline-flex size-8 items-center justify-center text-gray-300 dark:text-gray-600">
          <Database className="size-4" aria-hidden />
        </span>
      </HintTooltip>
    );
  }

  return (
    <HintTooltip label={label}>
      <IconButton asChild variant="ghost" size="sm" aria-label={label}>
        <Link to={href}>
          <Icon className="size-4" />
        </Link>
      </IconButton>
    </HintTooltip>
  );
}

export function SyncJobsTable({
  jobs,
  canManage,
  runningId,
  pollingJobId = null,
  cancellingId = null,
  onRun,
  onCancel,
  onDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected = false,
  someSelected = false,
}: SyncJobsTableProps) {
  const showSelection = Boolean(onToggleSelect) && canManage;
  const targetTableCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const key = job.target_table.trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [jobs]);
  return (
    <div className="overflow-x-only">
      <table className="min-w-[1080px] w-full text-left text-theme-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
          <tr>
            {showSelection ? (
              <th className={listTableSelectHeadClass}>
                <ListHeaderCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={jobs.length === 0}
                  onCheckedChange={() => onToggleSelectAll?.()}
                />
              </th>
            ) : null}
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">任务</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">源</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">同步方式</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">目标表</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">定时调度</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cron 开关</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">最近运行</th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">出图就绪</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">操作</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-white/[0.02]"
            >
              {showSelection ? (
                <td className={listTableSelectCellClass}>
                  <ListRowCheckbox
                    checked={selectedIds?.has(job.id) ?? false}
                    onCheckedChange={() => onToggleSelect?.(job.id)}
                    ariaLabel={`选择任务 ${job.name}`}
                  />
                </td>
              ) : null}
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <RefreshCw className="size-4" aria-hidden />
                  </div>
                  <span className="font-medium text-gray-800 dark:text-white/90">{job.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="light" color="primary" size="sm">
                    {sourceSummaryLabel(job)}
                  </Badge>
                  <SourceHealthBadge health={job.source_health} />
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant="light" color={job.sync_mode === "incremental" ? "warning" : "light"} size="sm">
                  {syncModeLabel(job.sync_mode)}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-theme-xs text-gray-600 dark:text-gray-300">
                    {job.target_table}
                  </span>
                  {(targetTableCounts.get(job.target_table.trim().toLowerCase()) ?? 0) > 1 ? (
                    <Badge variant="light" color="warning" size="sm">
                      {targetTableCounts.get(job.target_table.trim().toLowerCase())} 历史共表
                    </Badge>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  {job.schedule_cron ? (
                    <>
                      <CalendarClock className="size-4 shrink-0 text-gray-400" aria-hidden />
                      <span className="font-mono text-theme-xs">{job.schedule_cron}</span>
                    </>
                  ) : (
                    <>
                      <Hand className="size-4 shrink-0 text-gray-400" aria-hidden />
                      <span>手动</span>
                    </>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge color={job.enabled ? "success" : "light"} variant="light" size="sm">
                  {job.enabled ? "Cron 已启用" : "Cron 已停用"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <LastRunCell job={job} />
              </td>
              <td className="px-4 py-3">
                <ConsumeReadyCell job={job} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-0.5">
                  <ConsumeActionButton job={job} canManage={canManage} />
                  {canManage ? (
                    <>
                      {(() => {
                        const runInProgress =
                          isSyncRunActive(job.last_run?.status) ||
                          runningId === job.id ||
                          pollingJobId === job.id;
                        const stopping = cancellingId === job.id || job.last_run?.status === "cancelling";
                        const sourceUnavailable = isSourceUnavailable(job.source_health);
                        if (runInProgress) {
                          return (
                            <HintTooltip label={stopping ? "正在停止同步…" : "停止当前同步（阶段边界生效）"}>
                              <IconButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-error-500 hover:text-error-600 dark:text-error-400"
                                aria-label="停止同步"
                                disabled={stopping}
                                loading={stopping}
                                onClick={() => onCancel(job)}
                              >
                                <Square className="size-3.5 fill-current" />
                              </IconButton>
                            </HintTooltip>
                          );
                        }
                        return (
                          <HintTooltip
                            label={
                              sourceUnavailable
                                ? "数据源不可用，无法运行同步"
                                : "手动运行同步（全量将覆盖目标表）"
                            }
                          >
                            <IconButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label="手动运行同步"
                              disabled={sourceUnavailable}
                              onClick={() => onRun(job)}
                            >
                              <Play className="size-4" />
                            </IconButton>
                          </HintTooltip>
                        );
                      })()}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="更多操作"
                          >
                            <MoreHorizontal className="size-4" />
                          </IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/admin/ingestion/sync-jobs/${job.id}/etl-rules`}
                              className="gap-2"
                            >
                              <Settings2 className="size-4" />
                              清洗规则
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/admin/ingestion/sync-jobs/${job.id}/edit`}
                              className="gap-2"
                            >
                              <Pencil className="size-4" />
                              编辑任务
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(job)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            删除任务
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : null}
                  <IconButton asChild variant="ghost" size="sm" aria-label="查看运行历史">
                    <Link to={`/admin/ingestion/sync-jobs/${job.id}/history`}>
                      <History className="size-4" />
                    </Link>
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
