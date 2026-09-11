import { Link } from "react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { RowActions } from "@/components/layout/list-page-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mapApiError } from "@/lib/apiError";
import { describeCron } from "@/lib/scheduleCronWizard";
import {
  formatAttachmentLabels,
  localizeSourceType,
  scheduleSourceHref,
  sourceTypeBadgeColor,
  summarizeRecipients,
} from "@/lib/scheduleSourceMeta";
import {
  SCHEDULE_ACTION_LABELS,
  localizeScheduleStatus,
  scheduleStatusColor,
  useReportScheduleMutations,
  useScheduleExecutions,
  type ReportScheduleRow,
} from "../useReportSchedules";
import { ScheduleHistoryTable } from "./ScheduleHistoryTable";

function ScheduleHistoryPanel({
  schedule,
  readOnly,
}: {
  schedule: ReportScheduleRow;
  readOnly: boolean;
}) {
  const historyQuery = useScheduleExecutions(schedule.id);
  const { executeSchedule, retryExecution } = useReportScheduleMutations();

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          执行历史
        </p>
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={schedule.status !== "scheduled" || executeSchedule.isPending}
            onClick={() => {
              executeSchedule.mutate(schedule.id, {
                onSuccess: () => toast.success("已触发执行"),
                onError: (err) => toast.error(mapApiError(err)),
              });
            }}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            立即执行
          </Button>
        ) : null}
      </div>
      {historyQuery.isLoading ? (
        <p className="text-theme-xs text-gray-500">加载中…</p>
      ) : (
        <ScheduleHistoryTable
          rows={historyQuery.data?.items ?? []}
          readOnly={readOnly}
          retryPending={retryExecution.isPending}
          embedded
          onRetry={(executionId) =>
            retryExecution.mutate(
              { executionId, scheduleId: schedule.id },
              {
                onSuccess: () => toast.success("已提交重试"),
                onError: (err) => toast.error(mapApiError(err)),
              },
            )
          }
        />
      )}
    </div>
  );
}

function ScheduleMoreMenu({
  schedule,
  onDelete,
}: {
  schedule: ReportScheduleRow;
  onDelete: () => void;
}) {
  const { transitionSchedule } = useReportScheduleMutations();
  const hasActions = schedule.allowedActions.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          type="button"
          size="xs"
          variant="ghost"
          className="shrink-0"
          disabled={transitionSchedule.isPending}
          aria-label="调度操作"
          showTooltip={false}
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {schedule.allowedActions.map((action) => (
          <DropdownMenuItem
            key={action}
            onClick={() =>
              transitionSchedule.mutate(
                { id: schedule.id, action },
                {
                  onSuccess: () => toast.success("调度状态已更新"),
                  onError: (err) => toast.error(mapApiError(err)),
                },
              )
            }
          >
            {SCHEDULE_ACTION_LABELS[action] ?? action}
          </DropdownMenuItem>
        ))}
        {hasActions ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" aria-hidden />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ScheduleRowActions({
  schedule,
  sourceHref,
  readOnly,
  onDelete,
}: {
  schedule: ReportScheduleRow;
  sourceHref: string;
  readOnly: boolean;
  onDelete: () => void;
}) {
  if (readOnly) {
    return (
      <RowActions>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" asChild>
          <Link to={sourceHref}>
            <ExternalLink className="size-3.5" aria-hidden />
            查看源
          </Link>
        </Button>
      </RowActions>
    );
  }

  return (
    <RowActions>
      <Button type="button" variant="ghost" size="sm" className="shrink-0 px-2" asChild>
        <Link to={sourceHref}>
          <ExternalLink className="size-3.5" aria-hidden />
          查看源
        </Link>
      </Button>
      <ScheduleMoreMenu schedule={schedule} onDelete={onDelete} />
    </RowActions>
  );
}

function ScheduleDataRow({
  schedule,
  sourceLabel,
  readOnly,
  expanded,
  onToggle,
  onDelete,
}: {
  schedule: ReportScheduleRow;
  sourceLabel: string;
  readOnly: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const sourceHref = scheduleSourceHref(schedule);

  return (
    <>
      <TableRow
        data-schedule-row={schedule.id}
        className="border-gray-100 hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-white/[0.02]"
      >
        <TableCell>
          <Badge variant="light" color={sourceTypeBadgeColor(schedule.sourceType)} size="sm">
            {localizeSourceType(schedule.sourceType)}
          </Badge>
        </TableCell>
        <TableCell>
          <button
            type="button"
            className="inline-flex max-w-[220px] items-center gap-1.5 text-left text-theme-sm font-medium text-gray-800 transition-colors hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 text-gray-400" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-gray-400" aria-hidden />
            )}
            <TruncateHint title={sourceLabel}>
              <span className="truncate">{sourceLabel}</span>
            </TruncateHint>
          </button>
        </TableCell>
        <TableCell className="text-theme-sm text-gray-600 dark:text-gray-400">
          {describeCron(schedule.cron)}
        </TableCell>
        <TableCell className="max-w-[180px] text-theme-xs text-gray-600 dark:text-gray-400">
          <TruncateHint title={summarizeRecipients(schedule.recipients)}>
            <span className="truncate">{summarizeRecipients(schedule.recipients)}</span>
          </TruncateHint>
        </TableCell>
        <TableCell className="text-theme-xs text-gray-600 dark:text-gray-400">
          {formatAttachmentLabels(schedule.attachmentFormats)}
        </TableCell>
        <TableCell>
          <Badge variant="light" color={scheduleStatusColor(schedule.status)} size="sm">
            {localizeScheduleStatus(schedule.status)}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap p-0 pr-3">
          <ScheduleRowActions
            schedule={schedule}
            sourceHref={sourceHref}
            readOnly={readOnly}
            onDelete={onDelete}
          />
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="p-0">
            <ScheduleHistoryPanel schedule={schedule} readOnly={readOnly} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

type ScheduleListTableProps = {
  items: ReportScheduleRow[];
  nameByNodeId: Map<string, string>;
  nameByPackKey?: Map<string, string>;
  readOnly: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
};

export function resolveScheduleSourceLabel(
  schedule: ReportScheduleRow,
  nameByNodeId: Map<string, string>,
  nameByPackKey: Map<string, string> = new Map(),
): string {
  if (schedule.sourceType === "standard") {
    const key = schedule.sourceKey ?? "";
    return schedule.sourceLabel ?? nameByPackKey.get(key) ?? (key || "标准分析");
  }
  return (
    schedule.sourceLabel ??
    nameByNodeId.get(schedule.catalogNodeId ?? schedule.sourceId ?? "") ??
    (schedule.sourceType === "dashboard"
      ? "看板定时报告"
      : schedule.sourceType === "data_screen"
        ? "大屏定时报告"
        : "报表模板")
  );
}

export function ScheduleListTable({
  items,
  nameByNodeId,
  nameByPackKey,
  readOnly,
  expandedId,
  onToggleExpand,
}: ScheduleListTableProps) {
  const [pendingDelete, setPendingDelete] = useState<ReportScheduleRow | null>(null);
  const { deleteSchedule } = useReportScheduleMutations();

  return (
    <div className="overflow-x-only">
      <Table size="comfortable" wrapperClassName="min-w-[960px] border-0 shadow-none">
        <TableHeader className="bg-gray-50/80 dark:bg-white/[0.02]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium text-gray-600 dark:text-gray-400">源类型</TableHead>
            <TableHead className="font-medium text-gray-600 dark:text-gray-400">调度源</TableHead>
            <TableHead className="font-medium text-gray-600 dark:text-gray-400">频率</TableHead>
            <TableHead className="font-medium text-gray-600 dark:text-gray-400">接收人</TableHead>
            <TableHead className="font-medium text-gray-600 dark:text-gray-400">附件</TableHead>
            <TableHead className="font-medium text-gray-600 dark:text-gray-400">状态</TableHead>
            <TableHead className="w-[1%] whitespace-nowrap pr-3 text-right font-medium text-gray-600 dark:text-gray-400">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((schedule) => (
            <ScheduleDataRow
              key={schedule.id}
              schedule={schedule}
              sourceLabel={resolveScheduleSourceLabel(schedule, nameByNodeId, nameByPackKey)}
              readOnly={readOnly}
              expanded={expandedId === schedule.id}
              onToggle={() => onToggleExpand(schedule.id)}
              onDelete={() => setPendingDelete(schedule)}
            />
          ))}
        </TableBody>
      </Table>
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条定时报告？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将停止定时执行，并从列表中移除。执行历史一并清理，不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSchedule.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSchedule.isPending}
              onClick={() => {
                if (!pendingDelete) return;
                deleteSchedule.mutate(pendingDelete.id, {
                  onSuccess: () => {
                    setPendingDelete(null);
                    toast.success("已删除");
                  },
                  onError: (err) => toast.error(mapApiError(err)),
                });
              }}
            >
              {deleteSchedule.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
