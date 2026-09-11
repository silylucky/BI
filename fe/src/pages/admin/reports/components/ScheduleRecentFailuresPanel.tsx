import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/formatDateTime";
import { localizeApiMessage, mapApiError } from "@/lib/apiError";
import {
  localizeExecutionStatus,
  type ReportScheduleRow,
  type ScheduleExecutionRow,
  useReportScheduleMutations,
} from "../useReportSchedules";

type Props = {
  schedules?: ReportScheduleRow[];
  onSelectSchedule?: (scheduleId: string) => void;
  onRetry?: (executionId: string, scheduleId: string) => void;
  retryPending?: boolean;
  retryPendingExecutionId?: string;
};

function resolveSourceLabel(row: ScheduleExecutionRow, schedules?: ReportScheduleRow[]): string | null {
  const fromSchedule = schedules?.find((s) => s.id === row.scheduleId);
  return fromSchedule?.sourceLabel ?? fromSchedule?.name ?? null;
}

export function ScheduleRecentFailuresPanel({
  schedules,
  onSelectSchedule,
  onRetry,
  retryPending,
  retryPendingExecutionId,
}: Props) {
  const { dismissFailure, dismissAllFailures } = useReportScheduleMutations();
  const failuresQuery = useQuery({
    queryKey: ["reports", "schedules", "recent-failures"],
    queryFn: () =>
      apiFetch<{ items: ScheduleExecutionRow[]; total: number }>(
        "/api/v1/reports/schedules/executions/recent-failures?limit=10",
      ),
  });

  if (failuresQuery.isLoading) return null;

  if (failuresQuery.isError) {
    return (
      <PageErrorBanner
        message={mapApiError(failuresQuery.error)}
        onRetry={() => void failuresQuery.refetch()}
      />
    );
  }

  const items = failuresQuery.data?.items ?? [];
  if (items.length === 0) return null;

  const dismissOne = (executionId: string) => {
    dismissFailure.mutate(executionId, {
      onSuccess: () => toast.success("已从列表移除"),
      onError: (err) => toast.error(mapApiError(err)),
    });
  };

  const dismissAll = () => {
    dismissAllFailures.mutate(
      items.map((row) => row.executionId),
      {
        onSuccess: () => toast.success("已全部忽略"),
        onError: (err) => toast.error(mapApiError(err)),
      },
    );
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-500/30 dark:bg-amber-500/5">
      <Collapsible defaultOpen={false} className="group">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <CollapsibleTrigger
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left",
              "hover:bg-amber-100/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500/40",
              "dark:hover:bg-amber-500/10",
            )}
            data-testid="schedule-recent-failures-toggle"
          >
            <ChevronRight
              className="size-4 shrink-0 text-amber-600 transition-transform group-data-[state=open]:rotate-90 dark:text-amber-400"
              aria-hidden
            />
            <CardTitle className="flex items-center gap-2 text-title-sm">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
              近期失败 / 降级投递（{items.length}）
            </CardTitle>
          </CollapsibleTrigger>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            disabled={dismissAllFailures.isPending}
            onClick={(event) => {
              event.stopPropagation();
              dismissAll();
            }}
          >
            {dismissAllFailures.isPending ? "处理中…" : "全部忽略"}
          </Button>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2">
        {items.map((row) => {
          const sourceLabel = resolveSourceLabel(row, schedules);
          const isRetrying = retryPending && retryPendingExecutionId === row.executionId;
          const isDismissing =
            dismissFailure.isPending && dismissFailure.variables === row.executionId;
          return (
            <div
              key={row.executionId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white/80 px-3 py-2 text-theme-xs dark:border-amber-500/20 dark:bg-white/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {localizeExecutionStatus(row.status)}
                  <span className="ml-2 font-normal text-gray-500">{formatDateTime(row.executedAt)}</span>
                </p>
                {sourceLabel ? (
                  <p className="mt-0.5 text-gray-600 dark:text-gray-400">来源：{sourceLabel}</p>
                ) : null}
                {row.errorMessage ? (
                  <p className="mt-0.5 line-clamp-2 text-gray-500">{localizeApiMessage(row.errorMessage)}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {onSelectSchedule ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => onSelectSchedule(row.scheduleId)}>
                    查看调度
                  </Button>
                ) : null}
                {onRetry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRetrying}
                    onClick={() => onRetry(row.executionId, row.scheduleId)}
                  >
                    {isRetrying ? "重试中…" : "重试"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isDismissing}
                  onClick={() => dismissOne(row.executionId)}
                >
                  {isDismissing ? "忽略中…" : "忽略"}
                </Button>
              </div>
            </div>
          );
        })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
