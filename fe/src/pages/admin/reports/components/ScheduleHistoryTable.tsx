import { useState } from "react";
import { AlertCircle, History } from "lucide-react";
import { fetchAuthenticatedBlob } from "@/lib/apiUpload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { HistoryRowActions } from "./ScheduleHistoryRowActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatDateTime";
import { localizeApiMessage } from "@/lib/apiError";
import {
  executionStatusColor,
  localizeExecutionStatus,
  type ScheduleExecutionRow,
} from "../useReportSchedules";
import { executionErrorHeadline } from "../scheduleHistoryPresentation";
import { localizeArtifactKind } from "@/lib/scheduleArtifactMeta";
import { summarizeDeliveryRecipients } from "@/lib/scheduleSourceMeta";
import { formatDeliveryStepLines } from "@/lib/scheduleDeliveryDetail";

type ScheduleHistoryTableProps = {
  rows: ScheduleExecutionRow[];
  readOnly?: boolean;
  onRetry?: (executionId: string) => void;
  retryPending?: boolean;
  retryPendingExecutionId?: string;
  compact?: boolean;
  /** 嵌套在展开面板内：去掉外层卡片边框 */
  embedded?: boolean;
};

export function ScheduleHistoryTable({
  rows,
  readOnly,
  onRetry,
  retryPending,
  retryPendingExecutionId,
  compact,
  embedded = false,
}: ScheduleHistoryTableProps) {
  const [detailRow, setDetailRow] = useState<ScheduleExecutionRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingSlot, setDownloadingSlot] = useState<"full_page" | "per_widget" | null>(null);

  const handleDownload = async (
    executionId: string,
    slot?: "full_page" | "per_widget",
  ) => {
    setDownloadingId(executionId);
    setDownloadingSlot(slot ?? "full_page");
    try {
      const query = slot === "per_widget" ? "?slot=per_widget" : "";
      const blob = await fetchAuthenticatedBlob(
        `/api/v1/reports/schedules/executions/${executionId}/artifact/download${query}`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `schedule-${executionId}-可视化报告.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
      setDownloadingSlot(null);
    }
  };

  if (rows.length === 0) {
    return (
      <PanelEmptyState
        layout="inline"
        size="sm"
        variant="framed"
        tone="neutral"
        icon={<History className="size-5" aria-hidden />}
        title="暂无执行记录"
        description="激活定时任务或点击「立即试发」后，投递记录将显示于此。"
        className={compact ? "min-h-[140px]" : "min-h-[180px]"}
      />
    );
  }

  const renderActions = (row: ScheduleExecutionRow) => (
    <HistoryRowActions
      row={row}
      compact={compact}
      readOnly={readOnly}
      downloading={downloadingId === row.executionId}
      downloadingSlot={downloadingId === row.executionId ? downloadingSlot : null}
      retrying={Boolean(retryPending && retryPendingExecutionId === row.executionId)}
      onDownload={(slot) => void handleDownload(row.executionId, slot)}
      onDetail={() => setDetailRow(row)}
      onRetry={onRetry ? () => onRetry(row.executionId) : undefined}
    />
  );

  return (
    <>
      {compact ? (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const recipients = summarizeDeliveryRecipients(row.deliverySteps);
            const artifact = localizeArtifactKind(row.artifactKind);
            const hasError = Boolean(row.errorMessage);
            return (
              <li
                key={row.executionId}
                className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="light" color={executionStatusColor(row.status)} size="sm">
                        {localizeExecutionStatus(row.status)}
                      </Badge>
                      {artifact ? (
                        <Badge variant="light" color="light" size="sm">
                          {artifact}
                        </Badge>
                      ) : null}
                      <span className="text-theme-xs tabular-nums text-gray-400">
                        {formatDateTime(row.executedAt)}
                      </span>
                    </div>
                    <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      收件 {recipients || "—"}
                    </p>
                    {hasError ? (
                      <div className="space-y-1">
                        <p className="flex items-start gap-1.5 text-theme-xs leading-5 text-error-600 dark:text-error-400">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0">
                            {executionErrorHeadline(row.errorMessage ?? "")}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {renderActions(row)}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          className={
            embedded
              ? "overflow-x-only rounded-lg border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900/40"
              : "overflow-x-only rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
          }
        >
          <Table size="compact" wrapperClassName="min-w-[620px] border-0 shadow-none">
            <TableHeader>
              <TableRow className="border-gray-100 dark:border-gray-800">
                <TableHead className="px-3 py-2">状态</TableHead>
                <TableHead className="px-3 py-2">实际收件</TableHead>
                <TableHead className="px-3 py-2">产物</TableHead>
                <TableHead className="px-3 py-2">执行时间</TableHead>
                <TableHead className="px-3 py-2">说明</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap px-3 py-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const hasError = Boolean(row.errorMessage);
                const recipients = summarizeDeliveryRecipients(row.deliverySteps);
                return (
                  <TableRow key={row.executionId} className="border-gray-50 dark:border-gray-800/60">
                    <TableCell className="px-3 py-2">
                      <Badge variant="light" color={executionStatusColor(row.status)} size="sm">
                        {localizeExecutionStatus(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] px-3 py-2 text-gray-600 dark:text-gray-400">
                      <TruncateHint title={recipients}>
                        <span className="truncate">{recipients}</span>
                      </TruncateHint>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {localizeArtifactKind(row.artifactKind) ? (
                        <Badge variant="light" color="light" size="sm">
                          {localizeArtifactKind(row.artifactKind)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-2 text-gray-600 dark:text-gray-400">
                      {formatDateTime(row.executedAt)}
                    </TableCell>
                    <TableCell className="max-w-[220px] px-3 py-2 text-theme-xs text-gray-600 dark:text-gray-400">
                      {hasError ? (
                        <div className="space-y-1">
                          <TruncateHint title={localizeApiMessage(row.errorMessage)}>
                            <span className="line-clamp-1 text-error-600 dark:text-error-400">
                              {executionErrorHeadline(row.errorMessage ?? "")}
                            </span>
                          </TruncateHint>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 py-2">{renderActions(row)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(detailRow)} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailRow?.errorMessage ? "执行失败详情" : "投递详情"}
            </DialogTitle>
            <DialogDescription>
              {detailRow ? formatDateTime(detailRow.executedAt) : null}
            </DialogDescription>
          </DialogHeader>
          {detailRow?.errorMessage ? (
            <div className="space-y-3">
              <p className="text-theme-sm text-gray-800 dark:text-gray-200">
                {executionErrorHeadline(detailRow.errorMessage)}
              </p>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-theme-xs leading-5 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                {localizeApiMessage(detailRow.errorMessage)}
              </pre>
            </div>
          ) : formatDeliveryStepLines(detailRow?.deliverySteps).length ? (
            <ul className="space-y-3">
              {formatDeliveryStepLines(detailRow?.deliverySteps).map((item) => (
                <li key={item.title} className="space-y-1">
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">
                    {item.title}
                  </p>
                  <p className="text-theme-sm leading-6 text-gray-600 dark:text-gray-400">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-theme-sm text-gray-600 dark:text-gray-400">无详细投递信息</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailRow(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
