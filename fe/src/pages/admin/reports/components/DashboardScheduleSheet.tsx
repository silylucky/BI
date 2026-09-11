import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SCHEDULE_DIALOG_BODY_CLASS,
  SCHEDULE_DIALOG_CONTENT_CLASS,
  SCHEDULE_DIALOG_HEADER_CLASS,
} from "@/components/dashboard/sharePageUi";
import { DashboardSchedulePanel } from "./DashboardSchedulePanel";
import {
  SCHEDULE_DELIVERY_HEALTH_KEY,
  SCHEDULE_EXPORT_HEALTH_KEY,
} from "./ScheduleExportHealthAlert";

type DashboardScheduleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceType: "dashboard" | "data_screen";
  sourceName: string;
  widgetCount?: number;
  readOnly?: boolean;
};

export function DashboardScheduleSheet({
  open,
  onOpenChange,
  sourceId,
  sourceType,
  sourceName,
  widgetCount,
  readOnly,
}: DashboardScheduleSheetProps) {
  const queryClient = useQueryClient();
  const label = sourceType === "data_screen" ? "大屏" : "看板";

  useEffect(() => {
    if (!open) return;
    void queryClient.invalidateQueries({ queryKey: SCHEDULE_EXPORT_HEALTH_KEY });
    void queryClient.invalidateQueries({ queryKey: SCHEDULE_DELIVERY_HEALTH_KEY });
  }, [open, queryClient]);

  /** 定时推送为长表单：禁止点击遮罩/外部误关，仅右上角关闭或显式取消 */
  const preventShellDismiss = (event: Event) => {
    event.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={SCHEDULE_DIALOG_CONTENT_CLASS}
        onPointerDownOutside={preventShellDismiss}
        onInteractOutside={preventShellDismiss}
        onFocusOutside={preventShellDismiss}
      >
        <DialogHeader className={SCHEDULE_DIALOG_HEADER_CLASS}>
          <div className="flex items-start gap-3.5 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <Clock className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-title-sm">定时推送</DialogTitle>
              <DialogDescription className="text-theme-sm leading-relaxed">
                为「{sourceName}」{label}配置定时 PDF 邮件推送。复用已保存的查询与筛选，无需重复选数据源。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className={SCHEDULE_DIALOG_BODY_CLASS}>
          <DashboardSchedulePanel
            sourceId={sourceId}
            sourceType={sourceType}
            sourceName={sourceName}
            widgetCount={widgetCount}
            readOnly={readOnly}
            embedded
            precheckActive={open}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
