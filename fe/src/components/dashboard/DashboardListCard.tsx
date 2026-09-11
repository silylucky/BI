import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Eye, ImageIcon, LayoutDashboard, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import {
  HUB_CARD_BODY_CLASS,
  HUB_CARD_BODY_MORE_TRIGGER_CLASS,
  HUB_CARD_FOOTER_CLASS,
  HUB_CARD_PREVIEW_CONTENT_CLASS,
  HUB_CARD_PREVIEW_FRAME_CLASS,
  HUB_CARD_PREVIEW_HOVER_BTN_CLASS,
  HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS,
  HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS,
  HUB_CARD_SHELL_CLASS,
  HUB_CARD_SKELETON_BODY_CLASS,
  HUB_CARD_SKELETON_PREVIEW_CLASS,
  HUB_CARD_SUBTITLE_CLASS,
  HUB_CARD_SUBTITLE_MUTED_CLASS,
  HUB_CARD_TITLE_CLASS,
  hubCardPreviewFrameStyle,
} from "@/components/dashboard/hubCardUi";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthenticatedBlobUrl } from "@/hooks/useAuthenticatedBlobUrl";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ListRowCheckbox } from "@/components/layout/list-batch-delete";
import {
  dataScreenEditPath,
  dataScreenPreviewPath,
  dashboardPreviewPath,
  dashboardSharePath,
  isDataScreenLayout,
  type DashboardSurfaceKind,
} from "@/lib/dataScreenLayout";
import { previewSummaryToLayout, type DashboardPreviewSummary } from "@/lib/dashboardListPreview";
import { shouldShowOfficialDemoBadge } from "@/lib/demoPackage";

export type DashboardListItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  /** 详情接口字段；列表接口使用 previewSummary */
  layoutJson?: DashboardLayout;
  previewSummary?: DashboardPreviewSummary;
  surfaceKind?: "dashboard" | "data-screen";
  widgetCount?: number;
  thumbnailUrl?: string | null;
  updatedAt: string;
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DashboardListCardThumbnailPlaceholder({
  isDataScreen,
  className,
  message = "保存后将生成封面截图",
}: {
  isDataScreen: boolean;
  className?: string;
  message?: string;
}) {
  return (
    <div
      data-testid="dashboard-list-card-thumbnail-placeholder"
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 px-4 text-center",
        isDataScreen ? "bg-slate-950 text-slate-500" : "bg-gray-50 text-gray-400 dark:bg-gray-900/60",
        className,
      )}
    >
      <ImageIcon className="size-8 opacity-40" aria-hidden />
      <p className="text-theme-xs">{message}</p>
    </div>
  );
}

function DashboardListCardStaticPreview({
  thumbnailUrl,
  isDataScreen,
  className,
}: {
  thumbnailUrl?: string | null;
  isDataScreen: boolean;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedPath = thumbnailUrl?.trim() || null;
  const { url: blobUrl, loading, error: fetchFailed } = useAuthenticatedBlobUrl(resolvedPath);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedPath]);
  const loadingThumbnail = Boolean(resolvedPath) && loading;

  if (loadingThumbnail) {
    return <Skeleton className={cn("h-full w-full rounded-none", className)} data-testid="dashboard-list-card-thumbnail-loading" />;
  }

  if (blobUrl && !imgFailed) {
    return (
      <img
        src={blobUrl}
        alt=""
        data-testid="dashboard-list-card-thumbnail"
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-top",
          isDataScreen ? "bg-slate-950" : "bg-gray-50 dark:bg-gray-900/60",
          className,
        )}
        decoding="async"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <DashboardListCardThumbnailPlaceholder
      isDataScreen={isDataScreen}
      className={className}
      message={imgFailed || fetchFailed ? "封面截图加载失败，请重新保存" : "保存后将生成封面截图"}
    />
  );
}

export function DashboardListCard({
  dashboard,
  canEdit,
  canShare,
  onDelete,
  selected,
  onToggleSelect,
  className,
  routeBase = "/admin/dashboards",
  previewSurfaceKind,
}: {
  dashboard: DashboardListItem;
  canEdit: boolean;
  canShare?: boolean;
  onDelete?: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  className?: string;
  /** 列表入口：看板或数据大屏 */
  routeBase?: string;
  /** 列表页固定预览比例，避免单条数据 surface 识别不一致导致卡片错位 */
  previewSurfaceKind?: DashboardSurfaceKind;
}) {
  const shareAllowed = canShare ?? canEdit;
  const layoutForPreview =
    dashboard.layoutJson ?? previewSummaryToLayout(dashboard.previewSummary);
  const widgetCount =
    dashboard.widgetCount ?? layoutForPreview?.widgets?.length ?? 0;
  const isScreen =
    previewSurfaceKind === "data-screen" ||
    dashboard.surfaceKind === "data-screen" ||
    isDataScreenLayout(layoutForPreview);
  const previewKind: DashboardSurfaceKind = previewSurfaceKind ?? (isScreen ? "data-screen" : "dashboard");
  const viewPath = isScreen ? dataScreenPreviewPath(dashboard.id) : dashboardPreviewPath(dashboard.id);
  const editPath = isScreen ? dataScreenEditPath(dashboard.id) : `${routeBase}/${dashboard.id}/edit`;
  const sharePath = dashboardSharePath(dashboard.id, isScreen);
  const primaryPath = canEdit ? editPath : viewPath;
  const showOfficialDemoBadge = shouldShowOfficialDemoBadge({
    slug: dashboard.slug,
    name: dashboard.name,
    layoutJson: layoutForPreview,
  });

  return (
    <article className={cn(HUB_CARD_SHELL_CLASS, className)}>
      <div
        className={HUB_CARD_PREVIEW_FRAME_CLASS}
        style={hubCardPreviewFrameStyle(previewKind)}
      >
        {onToggleSelect ? (
          <div className="absolute left-2 top-2 z-20 rounded-md bg-white/90 p-0.5 shadow-sm dark:bg-gray-900/90">
            <ListRowCheckbox
              checked={Boolean(selected)}
              onCheckedChange={() => onToggleSelect()}
              ariaLabel={`选择看板 ${dashboard.name}`}
            />
          </div>
        ) : null}
        <div className={HUB_CARD_PREVIEW_CONTENT_CLASS}>
          <DashboardListCardStaticPreview
            thumbnailUrl={dashboard.thumbnailUrl}
            isDataScreen={previewKind === "data-screen"}
            className="h-full"
          />
        </div>
        <div className={HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS}>
          <Button asChild variant="primary" size="sm" className={HUB_CARD_PREVIEW_HOVER_BTN_CLASS}>
            <Link to={primaryPath}>{canEdit ? "编辑" : "查看"}</Link>
          </Button>
          {canEdit ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className={`${HUB_CARD_PREVIEW_HOVER_BTN_CLASS} ${HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS}`}
            >
              <Link to={viewPath}>预览</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className={HUB_CARD_BODY_CLASS}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link
              to={primaryPath}
              className={HUB_CARD_TITLE_CLASS}
            >
              {dashboard.name}
            </Link>
            {dashboard.description ? (
              <TruncateHint
                title={dashboard.description}
                as="p"
                className={HUB_CARD_SUBTITLE_CLASS}
              >
                {dashboard.description}
              </TruncateHint>
            ) : (
              <p className={HUB_CARD_SUBTITLE_MUTED_CLASS}>
                {dashboard.slug}
              </p>
            )}
          </div>
        </div>

        <div className={HUB_CARD_FOOTER_CLASS}>
          {showOfficialDemoBadge ? (
            <Badge variant="light" color="primary" size="sm">
              官方示例
            </Badge>
          ) : null}
          <Badge variant="light" color="light" size="sm">
            {widgetCount} 个组件
          </Badge>
          <span className="min-w-0 flex-1 truncate text-theme-xs text-gray-400 dark:text-gray-500">
            更新于 {formatUpdatedAt(dashboard.updatedAt)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="ghost"
                size="xs"
                showTooltip={false}
                aria-label={`${dashboard.name} 更多操作`}
                className={HUB_CARD_BODY_MORE_TRIGGER_CLASS}
              >
                <MoreHorizontal className="size-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link to={viewPath} className="gap-2">
                  <Eye className="size-4" />
                  查看
                </Link>
              </DropdownMenuItem>
              {canEdit ? (
                <DropdownMenuItem asChild>
                  <Link to={editPath} className="gap-2">
                    <Pencil className="size-4" />
                    编辑
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {shareAllowed ? (
                <DropdownMenuItem asChild>
                  <Link to={sharePath} className="gap-2">
                    <Share2 className="size-4" />
                    分享
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canEdit && onDelete ? (
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-4" aria-hidden />
                  删除
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

export function DashboardListCardSkeleton() {
  return (
    <div className={cn(HUB_CARD_SHELL_CLASS, "shadow-none")}>
      <div className={HUB_CARD_SKELETON_PREVIEW_CLASS} />
      <div className={HUB_CARD_SKELETON_BODY_CLASS}>
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-white/[0.06]" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-white/[0.04]" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-white/[0.04]" />
      </div>
    </div>
  );
}

export function DashboardListEmptyIcon() {
  return <LayoutDashboard className="size-7" aria-hidden />;
}
