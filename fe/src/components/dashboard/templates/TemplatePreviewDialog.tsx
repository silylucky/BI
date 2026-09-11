import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CloseButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { TemplateLayoutLivePreview } from "@/components/dashboard/templates/TemplateLayoutLivePreview";
import { TemplateStaticThumbnailPreview } from "@/components/dashboard/templates/TemplateStaticThumbnailPreview";
import { prepareLayoutForListPreview } from "@/components/dashboard/stylePipeline";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import {
  fetchTemplateDetail,
  type DashboardTemplateListItem,
} from "@/lib/dashboardTemplates";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import {
  bindTemplateDemoDatasource,
  layoutRequiresDemoCharts,
  resolveTemplateDemoDatasourceId,
} from "@/lib/templateDemoData";
import { queryKeys } from "@/lib/queryKeys";
import {
  categoryLabel,
  resolveTemplateThumbnail,
  surfaceLabel,
  visibilityLabel,
} from "@/components/dashboard/templates/templateLabels";

type TemplatePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DashboardTemplateListItem | null;
};

export function TemplatePreviewDialog({ open, onOpenChange, item }: TemplatePreviewDialogProps) {
  const templateId = item?.id;

  const detailQuery = useQuery({
    queryKey: queryKeys.dashboardTemplates.detail(templateId ?? ""),
    queryFn: () => fetchTemplateDetail(templateId!),
    enabled: open && Boolean(templateId),
    staleTime: 60_000,
  });

  const datasourcesQuery = useQuery({
    queryKey: queryKeys.datasources.list({}),
    queryFn: () =>
      apiFetch<{ items: { id: string; name: string; code: string; database?: string }[] }>(
        "/api/v1/datasources",
      ),
    enabled: open,
    staleTime: 120_000,
  });

  const layout = useMemo(() => {
    const raw = detailQuery.data?.layoutJson as DashboardLayout | undefined;
    if (!raw) return undefined;
    const demoId = resolveTemplateDemoDatasourceId(datasourcesQuery.data?.items ?? []);
    const bound = bindTemplateDemoDatasource(raw, demoId);
    return prepareLayoutForListPreview(bound);
  }, [detailQuery.data, datasourcesQuery.data]);

  const loading = detailQuery.isLoading || datasourcesQuery.isLoading;
  const demoDatasourceId = resolveTemplateDemoDatasourceId(datasourcesQuery.data?.items ?? []);
  const demoDatasourceMissing =
    !loading &&
    Boolean(layout) &&
    layoutRequiresDemoCharts(layout!) &&
    !demoDatasourceId;

  const isScreen = item?.surfaceKind === "data-screen";
  const colorScheme = layout?.styleConfig?.colorScheme ?? "light";
  const thumbnailSrc = item
    ? resolveTemplateThumbnail(item.templateKey, item.thumbnailRef)
    : null;
  /** 有演示库时优先 live 出图；仅缺数据源时回退静态示意图 */
  const useStaticDashboardPreview =
    !isScreen && Boolean(thumbnailSrc) && demoDatasourceMissing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="flex h-[min(96vh,1080px)] w-[min(98vw,1680px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-theme-lg sm:max-w-[min(98vw,1680px)] dark:border-gray-800"
        data-testid="template-preview-dialog"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800 sm:gap-3 sm:px-4">
          <DialogTitle className="flex min-w-0 max-w-[min(32%,280px)] shrink-0 items-center gap-2 text-theme-sm font-semibold text-gray-900 dark:text-white">
            <Eye className="size-4 shrink-0 text-brand-500" aria-hidden />
            <span className="truncate">{item?.name ?? "模板预览"}</span>
          </DialogTitle>
          {item?.description ? (
            <p className="hidden min-w-0 flex-1 truncate text-theme-xs text-gray-500 sm:block dark:text-gray-400">
              {item.description}
            </p>
          ) : null}
          {item ? (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Badge variant="light" color="light" size="sm">
                {surfaceLabel(item.surfaceKind)}
              </Badge>
              <Badge variant="light" color="light" size="sm">
                {categoryLabel(item.categoryKey)}
              </Badge>
              {visibilityLabel(item.visibility) ? (
                <Badge variant="light" color="light" size="sm">
                  {visibilityLabel(item.visibility)}
                </Badge>
              ) : null}
            </div>
          ) : null}
          <DialogClose asChild>
            <CloseButton
              size="xs"
              aria-label="关闭"
              showTooltip={false}
              className="-mr-1 shrink-0"
            />
          </DialogClose>
        </header>

        <div
          className={
            isScreen
              ? "relative min-h-0 flex-1 overflow-hidden bg-slate-950"
              : "dashboard-canvas-surface min-h-0 flex-1 overflow-auto p-1"
          }
          data-dashboard-color-scheme={isScreen ? "dark" : colorScheme}
        >
          {loading && !useStaticDashboardPreview ? (
            <Skeleton className="min-h-[420px] w-full rounded-lg" />
          ) : detailQuery.isError && !useStaticDashboardPreview ? (
            <div className="flex min-h-[420px] items-center justify-center p-6">
              <PageErrorBanner
                message={mapApiError(detailQuery.error)}
                onRetry={() => void detailQuery.refetch()}
              />
            </div>
          ) : useStaticDashboardPreview && thumbnailSrc ? (
            <TemplateStaticThumbnailPreview src={thumbnailSrc} />
          ) : layout ? (
            <TemplateLayoutLivePreview
              layout={layout}
              surfaceKind={item?.surfaceKind ?? "dashboard"}
              variant="dialog"
              geo3dRenderTier="embed"
              demoDatasourceMissing={demoDatasourceMissing}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

