import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WIDGET_COLSPAN,
  DEFAULT_WIDGET_ROWSPAN,
  isPaletteDragEvent,
  paletteDropSize,
  readPaletteDragPayload,
  type PaletteDragPayload,
} from "@/lib/dashboardDnd";
import { DashboardCanvasEmpty } from "./DashboardCanvasEmpty";
import {
  DashboardRglCanvas,
  DASHBOARD_GRID_MARGIN,
  PALETTE_DROP_ITEM_ID,
} from "./dashboardGridRgl";
import type { DashboardStyleConfig } from "./layoutUtils";
import { resolveWidgetGap } from "./dashboardStyleConfig";
import {
  auxiliaryGridPatternStyle,
  resolveDashboardAlignmentSnap,
  resolveDashboardChrome,
} from "./dashboardChromeConfig";
import { getTopLevelWidgets, sortWidgets } from "./layoutUtils";
import { gridLayoutToWidgets, widgetsToGridLayout } from "./gridLayoutAdapter";
import { normalizeGridLayout } from "./gridSnapUtils";
import { DashboardGridPlayerProvider } from "./dashboardGridPlayerContext";
import { ChartMountInteractionBridge } from "@/components/charts/ChartMountInteractionBridge";

const EMPTY_CANVAS_MIN_HEIGHT = 480;

export type DashboardGridMode = "edit" | "view";

export type GridInsertAt = {
  gridX: number;
  gridY: number;
  colSpan: number;
  rowSpan: number;
  /** RGL onDrop 落点，信任栅格引擎坐标 */
  exact?: boolean;
};

type DashboardGridProps = {
  mode: DashboardGridMode;
  widgets: LayoutWidget[];
  renderWidget: (widget: LayoutWidget, grid?: { w: number; h: number }) => ReactNode;
  onInsertChart?: (type: PaletteDragPayload, at: GridInsertAt) => void;
  onLayoutChange?: (widgets: LayoutWidget[]) => void;
  selectedIds?: Set<string>;
  onClearSelection?: () => void;
  className?: string;
  styleConfig?: DashboardStyleConfig;
};

function layoutKey(items: Layout): string {
  return items.map((item) => `${item.i}:${item.x}:${item.y}:${item.w}:${item.h}`).join("|");
}

function stripDropPlaceholder(layout: Layout): Layout {
  return layout.filter((item) => item.i !== PALETTE_DROP_ITEM_ID);
}

const defaultDroppingItem: LayoutItem = {
  i: PALETTE_DROP_ITEM_ID,
  x: 0,
  y: 0,
  w: DEFAULT_WIDGET_COLSPAN,
  h: DEFAULT_WIDGET_ROWSPAN,
};

export function DashboardGrid({
  mode,
  widgets,
  renderWidget,
  onInsertChart,
  onLayoutChange,
  selectedIds,
  onClearSelection,
  className,
  styleConfig,
}: DashboardGridProps) {
  const componentGapPx = resolveWidgetGap(styleConfig ?? {});
  const chrome = resolveDashboardChrome(styleConfig);
  const alignmentSnap = resolveDashboardAlignmentSnap(styleConfig);
  const showAuxGrid = mode === "edit" && chrome.showAuxiliaryGrid;
  const gridMargin: [number, number] = DASHBOARD_GRID_MARGIN;
  const sorted = sortWidgets(widgets);
  const topLevel = useMemo(() => getTopLevelWidgets(sorted), [sorted]);
  const derivedLayout = useMemo(() => widgetsToGridLayout(topLevel), [topLevel]);
  const derivedLayoutKey = useMemo(() => layoutKey(derivedLayout), [derivedLayout]);
  const [layout, setLayout] = useState<Layout>(derivedLayout);
  const [droppingItem, setDroppingItem] = useState<LayoutItem>(defaultDroppingItem);
  const interactingRef = useRef(false);
  const sortedRef = useRef(sorted);
  const topLevelRef = useRef(topLevel);
  const layoutKeyRef = useRef(derivedLayoutKey);
  const [paletteDragOver, setPaletteDragOver] = useState(false);
  const [gridPlayingWidgetId, setGridPlayingWidgetId] = useState<string | null>(null);
  const viewLayout = useMemo(() => normalizeGridLayout(derivedLayout), [derivedLayout]);
  sortedRef.current = sorted;
  topLevelRef.current = topLevel;

  const layoutById = useMemo(() => new Map(layout.map((item) => [item.i, item])), [layout]);

  useEffect(() => {
    if (interactingRef.current) return;
    if (layoutKeyRef.current === derivedLayoutKey) return;
    layoutKeyRef.current = derivedLayoutKey;
    setLayout(derivedLayout);
  }, [derivedLayout, derivedLayoutKey]);

  const persistLayout = useCallback(
    (next: Layout, snap = false) => {
      const cleaned = stripDropPlaceholder(next);
      const currentTop = topLevelRef.current;
      if (!onLayoutChange || cleaned.length !== currentTop.length) return;
      const resolved = snap ? normalizeGridLayout(cleaned) : cleaned;
      layoutKeyRef.current = layoutKey(resolved);
      setLayout(resolved);
      const updatedTop = gridLayoutToWidgets(resolved, currentTop);
      const topIds = new Set(updatedTop.map((w) => w.id));
      const nested = sortedRef.current.filter((w) => w.parentTabsId && !topIds.has(w.id));
      onLayoutChange(sortWidgets([...updatedTop, ...nested]));
    },
    [onLayoutChange],
  );

  const applyLiveLayout = useCallback((next: Layout) => {
    setLayout(stripDropPlaceholder(next));
  }, []);

  const finishInteraction = useCallback((next: Layout, snap = false) => {
    persistLayout(next, snap);
    interactingRef.current = false;
    setGridPlayingWidgetId(null);
  }, [persistLayout]);

  const handleDropDragOver = useCallback((e: React.DragEvent) => {
    if (!isPaletteDragEvent(e)) return false;
    e.preventDefault();
    setPaletteDragOver(true);
    const payload = readPaletteDragPayload(e.nativeEvent);
    if (!payload) return false;
    const size = paletteDropSize(payload);
    setDroppingItem({ i: PALETTE_DROP_ITEM_ID, x: 0, y: 0, w: size.w, h: size.h });
    return size;
  }, []);

  const handleDrop = useCallback(
    (nextLayout: Layout, item: LayoutItem | undefined, e: Event) => {
      setPaletteDragOver(false);
      if (!onInsertChart || !item) return;
      const payload = readPaletteDragPayload(e);
      if (!payload) return;
      const cleaned = stripDropPlaceholder(nextLayout);
      layoutKeyRef.current = layoutKey(cleaned);
      setLayout(cleaned);
      interactingRef.current = false;
      onInsertChart(payload, {
        gridX: item.x,
        gridY: item.y,
        colSpan: item.w,
        rowSpan: item.h,
        exact: true,
      });
    },
    [onInsertChart],
  );

  const gridChildren = topLevel.map((widget) => {
    const gridItem = layoutById.get(widget.id);
    return (
      <div
        key={widget.id}
        className={cn(
          "grid-widget-cell dashboard-shape-gap-shell h-full min-w-0",
          componentGapPx === 0 && "dashboard-widget-surface",
          selectedIds?.has(widget.id) && "grid-widget-selected",
        )}
      >
        {renderWidget(
          widget,
          gridItem ? { w: gridItem.w, h: gridItem.h } : undefined,
        )}
      </div>
    );
  });

  if (mode === "edit" && onLayoutChange) {
    const isEmpty = topLevel.length === 0;
    const scheme = styleConfig?.colorScheme ?? "light";
    return (
      <div
        className={cn(
          "dashboard-scroll dashboard-grid-edit relative min-h-[420px] w-full flex-1 overflow-y-auto",
          paletteDragOver && "dashboard-canvas-drop-active",
          className,
        )}
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return;
          onClearSelection?.();
        }}
      >
        {showAuxGrid ? (
          <div
            className="dashboard-edit-aux-grid pointer-events-none absolute inset-0 z-0"
            style={auxiliaryGridPatternStyle(scheme, alignmentSnap.gridCellPx)}
            data-testid="dashboard-grid-aux-grid"
            aria-hidden
          />
        ) : null}
        {isEmpty ? <DashboardCanvasEmpty dragActive={paletteDragOver} /> : null}
        <DashboardGridPlayerProvider playingWidgetId={gridPlayingWidgetId}>
        <ChartMountInteractionBridge frozen={Boolean(gridPlayingWidgetId)} />
        <DashboardRglCanvas
          className={cn("layout relative z-[1]", isEmpty && "dashboard-grid-empty")}
          style={isEmpty ? { minHeight: EMPTY_CANVAS_MIN_HEIGHT } : undefined}
          layout={layout}
          editable
          margin={gridMargin}
          isDroppable={Boolean(onInsertChart)}
          droppingItem={droppingItem}
          onDropDragOver={handleDropDragOver}
          onDrop={handleDrop}
          onDragStart={(widgetId) => {
            interactingRef.current = true;
            setGridPlayingWidgetId(widgetId);
          }}
          onDragStop={(nextLayout) => finishInteraction(nextLayout, true)}
          onResizeStart={(widgetId) => {
            interactingRef.current = true;
            setGridPlayingWidgetId(widgetId);
          }}
          onResizeStop={(nextLayout) => finishInteraction(nextLayout, true)}
          onLayoutChange={(next) => {
            if (!interactingRef.current) return;
            applyLiveLayout(next);
          }}
        >
          {gridChildren}
        </DashboardRglCanvas>
        </DashboardGridPlayerProvider>
      </div>
    );
  }

  if (topLevel.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-white/[0.02]",
          className,
        )}
      >
        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">暂无组件</p>
        <p className="max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
          此看板尚未添加图表，请进入编辑模式配置。
        </p>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-grid-view relative w-full", className)}>
      <DashboardRglCanvas className="layout" layout={viewLayout} editable={false} margin={gridMargin}>
        {gridChildren}
      </DashboardRglCanvas>
    </div>
  );
}
