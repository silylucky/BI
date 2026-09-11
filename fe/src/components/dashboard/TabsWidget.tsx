import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { GripVertical, LayoutGrid, PanelsTopLeft, Plus, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/randomId";
import { isPaletteDragEvent, readPaletteDragPayload, type PaletteDragPayload } from "@/lib/dashboardDnd";
import { usePaletteDragActive } from "./pixelCanvas/paletteDragContext";
import { useTabPaletteDropTarget } from "./pixelCanvas/tabPaletteDropTargetContext";
import { usePixelChromeScale } from "./pixelCanvas/PixelCanvasScaleContext";
import type { DashboardWidgetShell } from "./dashboardCanvasMode";
import { WidgetInlineTitle } from "./WidgetInlineTitle";
import type { LayoutWidget, TabsWidgetConfig, DashboardStyleConfig } from "./layoutUtils";
import { TABS_CAROUSEL_MIN_INTERVAL_SEC, getTabChildWidgets } from "./layoutUtils";
import { gridWidgetShellClassName, resolveGridWidgetShell } from "./widgetRailStyleSections";
import { shapeTitlePresentationStyle } from "./dashboardWidgetTypography";

const MAX_PANES = 8;
const DEFAULT_TAB_FONT_PX = 14;

type TabsWidgetProps = {
  widget: LayoutWidget & { tabsConfig: TabsWidgetConfig };
  allWidgets: LayoutWidget[];
  mode: "edit" | "view";
  shell?: DashboardWidgetShell;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  onTabsConfigChange?: (tabsConfig: TabsWidgetConfig) => void;
  onPaletteDrop?: (payload: PaletteDragPayload) => void;
  renderChild: (child: LayoutWidget) => ReactNode;
  dashboardStyle?: DashboardStyleConfig;
  showToolbarDelete?: boolean;
};

function TabsPaneEmptyState({ mode, dragHint }: { mode: "edit" | "view"; dragHint?: boolean }) {
  if (mode === "view") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="text-theme-xs text-gray-400 dark:text-gray-500">此页签暂无内容</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-3">
      <div
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6",
          dragHint
            ? "border-brand-300 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/5"
            : "border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-white/[0.02]",
        )}
      >
        <span className="tabs-widget-empty-icon flex items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          <LayoutGrid className="tabs-widget-empty-icon-svg" aria-hidden />
        </span>
        <div className="space-y-1 text-center">
          <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-200">拖入或插入组件</p>
          <p className="text-theme-xs leading-relaxed text-gray-400 dark:text-gray-500">
            先点选目标页签，再从左侧工具栏添加图表、筛选器等
          </p>
        </div>
      </div>
    </div>
  );
}

function TabsPaletteDropOverlay({
  activePaneTitle,
  highlighted,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  activePaneTitle: string;
  highlighted: boolean;
  onDragEnter: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}) {
  return (
    <div
      className={cn(
        "tabs-widget-drop-layer absolute inset-0 z-[80] flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors",
        highlighted
          ? "border-brand-500 bg-brand-50/85 dark:border-brand-400 dark:bg-brand-500/15"
          : "border-brand-400/80 bg-brand-50/55 dark:border-brand-500/50 dark:bg-brand-500/8",
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="tabs-widget-drop-icon flex items-center justify-center rounded-lg bg-brand-100 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400">
        <LayoutGrid className="tabs-widget-drop-icon-svg" aria-hidden />
      </span>
      <p className="text-theme-sm font-medium text-brand-600 dark:text-brand-400">
        释放以加入「{activePaneTitle}」
      </p>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">可先切换页签再拖入</p>
    </div>
  );
}

export function TabsWidget({
  widget,
  allWidgets,
  mode,
  shell = "grid",
  selected = false,
  onSelect,
  onDelete,
  onTitleChange,
  onTabsConfigChange,
  onPaletteDrop,
  renderChild,
  dashboardStyle,
  showToolbarDelete = true,
}: TabsWidgetProps) {
  const cfg = widget.tabsConfig;
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const head = cfg.headStyle ?? {};
  const chromeScale = usePixelChromeScale();
  const isShape = shell === "shape";
  const gridShell = resolveGridWidgetShell(widget, dashboardStyle);
  const paletteDragActive = usePaletteDragActive();
  const tabDropTargetId = useTabPaletteDropTarget();
  const isTabDropTarget = tabDropTargetId === widget.id;
  const [paletteOver, setPaletteOver] = useState(false);
  const activePane = cfg.panes.find((p) => p.id === cfg.activePaneId) ?? cfg.panes[0];
  const children = activePane ? getTabChildWidgets(allWidgets, widget.id, activePane.id) : [];

  useEffect(() => {
    const carousel = cfg.carousel;
    if (mode === "edit" || !carousel?.enabled || cfg.panes.length < 2 || !onTabsConfigChange) {
      return;
    }
    const intervalMs = Math.max(TABS_CAROUSEL_MIN_INTERVAL_SEC, carousel.intervalSec) * 1000;
    const timer = window.setInterval(() => {
      const current = cfgRef.current;
      const index = current.panes.findIndex((pane) => pane.id === current.activePaneId);
      const nextIndex = index < 0 ? 0 : (index + 1) % current.panes.length;
      onTabsConfigChange({
        ...current,
        activePaneId: current.panes[nextIndex]!.id,
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [cfg.carousel?.enabled, cfg.carousel?.intervalSec, cfg.panes.length, mode, onTabsConfigChange]);

  const tabLabelStyle: CSSProperties = isShape
    ? shapeTitlePresentationStyle({ fontSize: head.fontSize ?? DEFAULT_TAB_FONT_PX }, chromeScale)
    : { fontSize: head.fontSize ?? DEFAULT_TAB_FONT_PX };

  const setActivePane = (paneId: string) => {
    if (paneId === cfg.activePaneId) return;
    onTabsConfigChange?.({ ...cfg, activePaneId: paneId });
  };

  const swallowWidgetPointer = (event: { stopPropagation: () => void; preventDefault?: () => void }) => {
    event.stopPropagation();
    event.preventDefault?.();
  };

  const addPane = () => {
    if (cfg.panes.length >= MAX_PANES) return;
    const id = randomId();
    onTabsConfigChange?.({
      ...cfg,
      panes: [...cfg.panes, { id, title: `页签 ${cfg.panes.length + 1}`, childWidgetIds: [] }],
      activePaneId: id,
    });
  };

  const canAcceptPalette = mode === "edit" && Boolean(onPaletteDrop);

  const handlePaletteDragOver = (event: DragEvent) => {
    if (!canAcceptPalette || !isPaletteDragEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setPaletteOver(true);
  };

  const handlePaletteDragLeave = (event: DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setPaletteOver(false);
  };

  const handlePaletteDrop = (event: DragEvent) => {
    if (!canAcceptPalette) return;
    const payload = readPaletteDragPayload(event);
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    setPaletteOver(false);
    onPaletteDrop!(payload);
  };

  const showPaletteDropLayer =
    canAcceptPalette &&
    paletteDragActive &&
    children.length === 0 &&
    (paletteOver || isTabDropTarget);

  const showCompactDropHint =
    canAcceptPalette &&
    paletteDragActive &&
    children.length > 0 &&
    (paletteOver || isTabDropTarget);

  return (
    <div
      data-tabs-widget-id={widget.id}
      className={cn(
        "tabs-widget-root flex h-full min-h-0 flex-col overflow-hidden",
        !isShape && gridWidgetShellClassName(true, selected),
        canAcceptPalette && paletteDragActive && (paletteOver || isTabDropTarget) && "ring-2 ring-inset ring-brand-400/60 dark:ring-brand-500/50",
      )}
      style={!isShape ? gridShell.style : undefined}
      onDragEnter={canAcceptPalette ? handlePaletteDragOver : undefined}
      onDragOver={canAcceptPalette ? handlePaletteDragOver : undefined}
      onDragLeave={canAcceptPalette ? handlePaletteDragLeave : undefined}
      onDrop={canAcceptPalette ? handlePaletteDrop : undefined}
      onPointerDown={swallowWidgetPointer}
    >
      {mode === "edit" && !isShape ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
          <div
            className="dashboard-drag-handle flex shrink-0 cursor-grab items-center active:cursor-grabbing"
            role="group"
            aria-label="拖动以移动组件"
          >
            <GripVertical className="size-4 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden />
          </div>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-theme-xs dark:bg-white/5">
            <PanelsTopLeft className="size-4" aria-hidden />
          </span>
          <WidgetInlineTitle
            value={widget.title}
            editable={Boolean(onTitleChange)}
            onChange={onTitleChange ? (next) => onTitleChange(widget.id, next) : undefined}
            ariaLabel="Tab 容器标题"
            testId={`widget-inline-title-${widget.id}`}
          />
          {onDelete && showToolbarDelete ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              className="dashboard-no-drag size-8 shrink-0 text-gray-400 hover:text-error-600"
              aria-label="删除组件"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(widget.id);
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          ) : null}
        </div>
      ) : null}

      <div className="dashboard-no-drag relative flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "tabs-widget-head relative flex shrink-0 items-start gap-1 border-b border-gray-100 px-2 dark:border-gray-800",
            isShape ? "pt-1.5" : "pt-2",
          )}
          style={head.barBackground ? { backgroundColor: head.barBackground } : undefined}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto" role="tablist" aria-label="页签">
            {cfg.panes.map((pane) => {
              const active = pane.id === cfg.activePaneId;
              const childCount = getTabChildWidgets(allWidgets, widget.id, pane.id).length;
              return (
                <button
                  key={pane.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "tabs-widget-tab relative max-w-[9rem] shrink-0 truncate rounded-t-lg px-3 py-2 font-medium transition-colors",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                    active
                      ? "bg-brand-50 text-brand-600 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500 dark:bg-brand-500/15 dark:text-brand-400 dark:after:bg-brand-400"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
                  )}
                  style={{
                    ...tabLabelStyle,
                    ...(active && head.activeColor
                      ? { color: head.activeColor }
                      : !active && head.inactiveColor
                        ? { color: head.inactiveColor }
                        : undefined),
                  }}
                  onPointerDown={swallowWidgetPointer}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePane(pane.id);
                  }}
                >
                  <span className="truncate">{pane.title}</span>
                  {childCount > 0 ? (
                    <span className="tabs-widget-tab-count ml-1 tabular-nums opacity-70">({childCount})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {mode === "edit" && cfg.panes.length < MAX_PANES ? (
            <button
              type="button"
              className="tabs-widget-add-btn mb-0.5 ml-auto inline-flex shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:hover:bg-white/5 dark:hover:text-brand-400"
              aria-label="添加页签"
              onPointerDown={swallowWidgetPointer}
              onClick={(e) => {
                e.stopPropagation();
                addPane();
              }}
            >
              <Plus className="tabs-widget-add-icon" aria-hidden />
            </button>
          ) : null}
        </div>

        <div
          className={cn(
            "dashboard-scroll relative flex min-h-0 flex-1 flex-col p-2",
            isShape ? "overflow-hidden" : "overflow-auto",
          )}
          role="tabpanel"
          aria-label={activePane?.title ?? "页签内容"}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (mode === "edit" && !paletteDragActive && !selected) {
              event.preventDefault();
              onSelect?.();
            }
          }}
        >
          <div
            className={cn(
              "relative flex min-h-0 flex-1 flex-col",
              children.length === 0 && "min-h-[4rem]",
            )}
          >
            {children.length === 0 ? (
              <TabsPaneEmptyState mode={mode} dragHint={paletteDragActive} />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className={cn(
                      "min-h-0",
                      isShape ? "flex h-full min-h-[10rem] flex-1 flex-col" : "shrink-0 min-h-[72px]",
                    )}
                    data-tab-child-widget
                  >
                    {renderChild(child)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {showCompactDropHint ? (
            <div
              className="pointer-events-none absolute inset-x-2 bottom-2 z-[80] rounded-md border border-dashed border-brand-400/90 bg-brand-50/90 px-2 py-1 text-center shadow-theme-xs dark:border-brand-500/50 dark:bg-brand-500/15"
              aria-hidden
            >
              <p className="text-theme-xs font-medium text-brand-600 dark:text-brand-400">
                释放以加入「{activePane?.title ?? "当前页签"}」
              </p>
            </div>
          ) : null}
          {showPaletteDropLayer ? (
            <TabsPaletteDropOverlay
              activePaneTitle={activePane?.title ?? "当前页签"}
              highlighted={paletteOver || isTabDropTarget}
              onDragEnter={handlePaletteDragOver}
              onDragOver={handlePaletteDragOver}
              onDragLeave={handlePaletteDragLeave}
              onDrop={handlePaletteDrop}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
