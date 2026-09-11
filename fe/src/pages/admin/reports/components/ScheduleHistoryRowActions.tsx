import { AlertCircle, Download, RotateCcw } from "lucide-react";
import { RowActions } from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
import { rowHasDeliveryDetail } from "@/lib/scheduleDeliveryDetail";
import { canRetryExecution, type ScheduleExecutionRow } from "../useReportSchedules";

type HistoryRowActionsProps = {
  row: ScheduleExecutionRow;
  compact?: boolean;
  readOnly?: boolean;
  downloading: boolean;
  downloadingSlot?: string | null;
  retrying: boolean;
  onDownload: (slot?: "full_page" | "per_widget") => void;
  onDetail: () => void;
  onRetry?: () => void;
};

export function HistoryRowActions({
  row,
  compact,
  readOnly,
  downloading,
  downloadingSlot,
  retrying,
  onDownload,
  onDetail,
  onRetry,
}: HistoryRowActionsProps) {
  const hasError = Boolean(row.errorMessage);
  const showDetail = hasError || rowHasDeliveryDetail(row.deliverySteps);
  const canDownload = row.artifactRef?.startsWith("storage://");
  const hasPerWidget = (row.secondaryArtifacts?.length ?? 0) > 0;
  const showRetry = !readOnly && canRetryExecution(row.status) && onRetry;
  const iconBtn = compact ? "size-8 shrink-0" : "h-8 shrink-0 px-2 text-theme-xs";

  return (
    <RowActions>
      {canDownload ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size={compact ? "icon" : "sm"}
            className={iconBtn}
            tooltip={compact ? (downloading && !downloadingSlot ? "下载中…" : "下载可视化报告") : undefined}
            disabled={downloading}
            onClick={() => onDownload("full_page")}
          >
            <Download className="size-3.5" aria-hidden />
            {compact ? (
              <span className="sr-only">下载</span>
            ) : downloading && downloadingSlot === "full_page" ? (
              "下载中…"
            ) : (
              "下载"
            )}
          </Button>
          {hasPerWidget ? (
            <Button
              type="button"
              variant="ghost"
              size={compact ? "icon" : "sm"}
              className={iconBtn}
              tooltip={compact ? (downloading ? "下载中…" : "下载按组件分页") : undefined}
              disabled={downloading}
              onClick={() => onDownload("per_widget")}
            >
              <Download className="size-3.5" aria-hidden />
              {compact ? (
                <span className="sr-only">按组件分页</span>
              ) : downloading && downloadingSlot === "per_widget" ? (
                "下载中…"
              ) : (
                "按组件分页"
              )}
            </Button>
          ) : null}
        </>
      ) : null}
      {showDetail ? (
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={iconBtn}
          tooltip={compact ? (hasError ? "查看错误详情" : "查看投递详情") : undefined}
          onClick={onDetail}
        >
          {compact ? (
            <>
              <AlertCircle className="size-3.5" aria-hidden />
              <span className="sr-only">详情</span>
            </>
          ) : (
            "详情"
          )}
        </Button>
      ) : null}
      {showRetry ? (
        <Button
          type="button"
          variant="outline"
          size={compact ? "xs" : "sm"}
          className={compact ? "h-8 shrink-0 px-2.5" : "h-8 shrink-0"}
          disabled={retrying}
          onClick={onRetry}
        >
          {compact ? <RotateCcw className="size-3.5" aria-hidden /> : null}
          {retrying ? "重试中…" : "重试"}
        </Button>
      ) : null}
    </RowActions>
  );
}
