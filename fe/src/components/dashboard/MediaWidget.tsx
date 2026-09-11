import { useState } from "react";
import { ExternalLink, Globe, GripVertical, ImageIcon, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isScreenWebpageWidget } from "@/lib/screenVisualAssets";
import { isWebpageMediaUrl } from "@/lib/webpageMedia";
import { TabNestedDragRail } from "./TabNestedDragRail";
import type { DashboardWidgetShell } from "./dashboardCanvasMode";
import { WidgetInlineTitle } from "./WidgetInlineTitle";
import type { LayoutWidget, MediaWidgetConfig, DashboardStyleConfig } from "./layoutUtils";
import { mediaAlignToObjectPosition, normalizeMediaConfig } from "./layoutUtils";
import { gridWidgetShellClassName, GridWidgetShellFrame, resolveGridWidgetShell } from "./widgetRailStyleSections";

type MediaWidgetProps = {
  widget: LayoutWidget & { mediaConfig: MediaWidgetConfig };
  mode: "edit" | "view";
  shell?: DashboardWidgetShell;
  nested?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  dashboardStyle?: DashboardStyleConfig;
  showToolbarDelete?: boolean;
};

export function MediaWidget({
  widget,
  mode,
  shell = "grid",
  nested = false,
  selected = false,
  onSelect,
  onDelete,
  onTitleChange,
  dashboardStyle,
  showToolbarDelete = true,
}: MediaWidgetProps) {
  const cfg = normalizeMediaConfig(widget.mediaConfig);
  const [broken, setBroken] = useState(false);
  const isWebpage = isScreenWebpageWidget(widget) || cfg.kind === "webpage";
  const showImage = !isWebpage && cfg.url.trim() && !broken;
  const showWebpage = isWebpage && isWebpageMediaUrl(cfg.url);
  const showGridChrome = shell === "grid";
  const gridShell = resolveGridWidgetShell(widget, dashboardStyle);
  const inShapeShell = shell === "shape";
  const linkUrl = cfg.linkUrl?.trim();
  const isViewLink = mode === "view" && Boolean(linkUrl);

  const imageNode = showImage ? (
    <img
      src={cfg.url}
      alt={cfg.alt || widget.title}
      className="size-full max-h-full max-w-full"
      style={{
        objectFit: cfg.fit,
        objectPosition: mediaAlignToObjectPosition(cfg.align),
        opacity: cfg.opacity ?? 1,
        borderRadius: cfg.borderRadius ? `${cfg.borderRadius}px` : undefined,
      }}
      onError={() => setBroken(true)}
    />
  ) : isWebpage ? (
  showWebpage ? (
    <iframe
      title={widget.title || "网页"}
      src={cfg.url.trim()}
      className="size-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{
        opacity: cfg.opacity ?? 1,
        borderRadius: cfg.borderRadius ? `${cfg.borderRadius}px` : undefined,
      }}
    />
  ) : (
    <div className="flex flex-col items-center gap-2 text-center text-gray-400">
      <Globe className="size-10 opacity-40" aria-hidden />
      <p className="text-theme-xs">
        {cfg.url.trim() ? "请输入有效的 http/https 网页地址" : "在右侧配置网页地址"}
      </p>
    </div>
  )
  ) : (
    <div className="flex flex-col items-center gap-2 text-center text-gray-400">
      <ImageIcon className="size-10 opacity-40" aria-hidden />
      <p className="text-theme-xs">{cfg.url ? "图片加载失败" : "在右侧配置图片"}</p>
    </div>
  );

  const content = isViewLink ? (
    <a
      href={linkUrl}
      target={cfg.linkNewTab ? "_blank" : undefined}
      rel={cfg.linkNewTab ? "noopener noreferrer" : undefined}
      className="group/link relative flex size-full min-h-0 items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {imageNode}
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/45 p-1 text-white opacity-0 transition-opacity group-hover/link:opacity-100">
        <ExternalLink className="size-3.5" aria-hidden />
      </span>
    </a>
  ) : (
    imageNode
  );

  const body = (
    <div
      role={mode === "edit" ? "button" : undefined}
      tabIndex={mode === "edit" ? 0 : undefined}
      onClick={
        mode === "edit"
          ? (event) => {
              event.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
      onPointerDown={mode === "edit" ? (event) => event.stopPropagation() : undefined}
      className={cn(
        "dashboard-no-drag relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2",
        mode === "edit" && "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02]",
        nested && mode === "edit" && "pl-7",
      )}
      style={{
        backgroundColor: cfg.background?.trim() || undefined,
      }}
    >
      {content}
    </div>
  );

  if (inShapeShell) {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {nested && mode === "edit" ? (
          <TabNestedDragRail widgetId={widget.id} className="h-full w-7" />
        ) : null}
        {body}
      </div>
    );
  }

  return (
    <GridWidgetShellFrame
      shell={gridShell}
      widgetId={widget.id}
      className={gridWidgetShellClassName(showGridChrome, Boolean(selected))}
    >
      {showGridChrome && mode === "edit" ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
          <div
            className="dashboard-drag-handle flex shrink-0 cursor-grab items-center active:cursor-grabbing"
            role="group"
            aria-label="拖动以移动组件"
          >
            <GripVertical className="size-3.5 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden />
          </div>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-theme-xs dark:bg-white/5">
            {isWebpage ? (
              <Globe className="size-3.5" aria-hidden />
            ) : (
              <ImageIcon className="size-3.5" aria-hidden />
            )}
          </span>
          <WidgetInlineTitle
            value={widget.title}
            editable={Boolean(onTitleChange)}
            onChange={onTitleChange ? (next) => onTitleChange(widget.id, next) : undefined}
            ariaLabel="媒体标题"
            testId={`widget-inline-title-${widget.id}`}
          />
          {onDelete && showToolbarDelete ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              className="dashboard-no-drag size-7 shrink-0 text-gray-400 hover:text-error-600"
              aria-label="删除组件"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(widget.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          ) : null}
        </div>
      ) : null}
      {body}
    </GridWidgetShellFrame>
  );
}
