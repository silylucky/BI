import { useCallback, useEffect, useState } from "react";
import { LayoutPanelTop, Share2 } from "lucide-react";
import { DashboardBoardShareBody } from "@/components/dashboard/DashboardBoardShareBody";
import { DataScreenSharePanel } from "@/components/dashboard/screen/DataScreenSharePanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { normalizeDashboardDetail } from "@/lib/resolveDashboardLayoutJson";
import { isDataScreenLayout } from "@/lib/dataScreenLayout";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { PanelEmptyState } from "@/components/ui/panel-empty-state";
import { Button } from "@/components/ui/button";
import { SHARE_DIALOG_BODY_CLASS, SHARE_DIALOG_CONTENT_CLASS, SHARE_DIALOG_HEADER_CLASS } from "@/components/dashboard/sharePageUi";

type DashboardDetail = {
  id: string;
  name: string;
  layoutJson: DashboardLayout;
};

export type DashboardShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  isScreen?: boolean;
  /** 编辑页已加载时可传入，避免重复请求 */
  initialDetail?: Pick<DashboardDetail, "name" | "layoutJson">;
};

function ShareDialogSkeleton() {
  return <Skeleton className="h-48 w-full rounded-xl" />;
}

export function DashboardShareDialog({
  open,
  onOpenChange,
  dashboardId,
  isScreen: isScreenProp,
  initialDetail,
}: DashboardShareDialogProps) {
  const [detail, setDetail] = useState<DashboardDetail | null>(
    initialDetail
      ? { id: dashboardId, name: initialDetail.name, layoutJson: initialDetail.layoutJson }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = normalizeDashboardDetail(
        await apiFetch<DashboardDetail>(`/api/v1/dashboards/${dashboardId}`),
      );
      setDetail(data);
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    if (!open) return;
    if (initialDetail) {
      setDetail({
        id: dashboardId,
        name: initialDetail.name,
        layoutJson: initialDetail.layoutJson,
      });
      setError(null);
      setLoading(false);
      return;
    }
    void load();
  }, [open, initialDetail, dashboardId, load]);

  const layout = detail?.layoutJson;
  const isScreen =
    isScreenProp ?? (layout ? isDataScreenLayout(layout) : false);
  const widgets = layout?.widgets ?? [];
  const title = detail?.name
    ? `${detail.name} · 分享`
    : isScreen
      ? "大屏分享"
      : "仪表板分享";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHARE_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={SHARE_DIALOG_HEADER_CLASS}>
          <div className="flex items-start gap-3.5 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <Share2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-title-sm">{title}</DialogTitle>
              <DialogDescription className="text-theme-sm leading-relaxed">
                {isScreen
                  ? "生成公开链接与 iframe 嵌入地址。定时 PDF 请在看板/大屏编辑页使用「定时推送」。"
                  : "生成公开链接与组件嵌入地址。定时 PDF 请在看板编辑页使用「定时推送」。"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={SHARE_DIALOG_BODY_CLASS}>
          {error ? (
            <PageErrorBanner message={error} onRetry={() => void load()} className="mb-3" />
          ) : null}
          {loading ? <ShareDialogSkeleton /> : null}

          {!loading && widgets.length === 0 && detail ? (
            <PanelEmptyState
              variant="framed"
              size="sm"
              icon={<LayoutPanelTop className="size-5" aria-hidden />}
              title={isScreen ? "大屏暂无组件" : "看板暂无组件"}
              description={
                isScreen
                  ? "请先在编辑器中添加图表或素材，再生成分享链接。"
                  : "请先在编辑器中添加图表组件，再生成分享链接。"
              }
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  关闭
                </Button>
              }
            />
          ) : null}

          {!loading && detail && widgets.length > 0 ? (
            isScreen ? (
              <DataScreenSharePanel
                dashboardId={dashboardId}
                name={detail.name}
                layout={detail.layoutJson}
              />
            ) : (
              <DashboardBoardShareBody
                dashboardId={dashboardId}
                name={detail.name}
                layout={detail.layoutJson}
                widgets={widgets}
              />
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
