import { memo, useCallback, useMemo, type ReactNode } from "react";
import { DashboardWidget } from "../DashboardWidget";
import {
  pixelWidgetToLayoutWidget,
  type DashboardWidgetShell,
} from "../dashboardCanvasMode";
import {
  buildWidgetFilterParams,
  type ChartLinkageRuntime,
  type Linkage,
} from "../dashboardFilterUtils";
import {
  buildWidgetExecuteKey,
} from "../dashboardWidgetExecuteKey";
import type { DashboardStyleConfig } from "../dashboardStyleConfig";
import {
  resizeWidget,
  type LayoutWidget,
  type PixelLayoutWidget,
} from "../layoutUtils";
import { WidgetErrorBoundary } from "../WidgetErrorBoundary";
import { resolveDashboardChrome } from "../dashboardChromeConfig";
import { resolveComponentGapRuntime } from "../componentGapRuntime";
import { readChartTitleVisible, mergeChartTitleStyle } from "@/lib/chartDeStyle";
import { resolveWidgetEffectiveScheme } from "@/lib/chartSurfaceTheme";
import { normalizeLinkedChartConfigChange } from "@/lib/vizComponentEdit";
import { mergeTitleStyle } from "../dashboardStyleConfig";
import { pixelViewTitleHeightPx } from "../dashboardWidgetTypography";
import { usePixelChromeScale } from "../pixelCanvas/PixelCanvasScaleContext";
import { resolveEmbeddedLayoutFootprint } from "@/components/charts/engine/embeddedContainerSize";
import { resolveWidgetChromeInset } from "../pixelCanvas/shapeVisualInset";
import {
  DashboardWidgetContextMenu,
  type DashboardWidgetActions,
} from "../WidgetContextMenu";
import type { PaletteDragPayload } from "@/lib/dashboardDnd";
import { useDashboardGridPlayer } from "../dashboardGridPlayerContext";
import { usePixelShapePlayer } from "../pixelCanvas/pixelShapePlayerContext";
import { preservePixelCanvasHostScroll } from "../pixelCanvas/preserveCanvasHostScroll";

export type DashboardWidgetsSetter = (
  update: LayoutWidget[] | ((previous: LayoutWidget[]) => LayoutWidget[]),
) => void;

export type RenderDashboardCanvasWidgetOptions = {
  shell?: DashboardWidgetShell;
  gridSize?: { w: number; h: number };
  nested?: boolean;
};

type DashboardCanvasWidgetRendererProps = {
  widget: LayoutWidget | PixelLayoutWidget;
  mode: "edit" | "view";
  selected: boolean;
  gridSize?: { w: number; h: number };
  linkage: Linkage;
  filterValues: Record<string, string>;
  chartLinkage?: ChartLinkageRuntime | null;
  onChartLinkageClick?: (
    widgetId: string,
    payload: { parameterKey: string; value: string },
  ) => void;
  onFilterValueChange: (filterId: string, value: string) => void;
  onSelect: (widgetId: string, additive: boolean) => void;
  onNestedSelect?: (widgetId: string, additive: boolean) => void;
  onDelete: (widgetId: string) => void;
  setWidgets: DashboardWidgetsSetter;
  nested?: boolean;
  shell?: DashboardWidgetShell;
  dashboardStyle?: DashboardStyleConfig;
  chartPaletteDefaults?: ReturnType<
    typeof import("../dashboardStyleConfig").pickChartPaletteDefaults
  >;
  allWidgets?: LayoutWidget[];
  styleRevision?: string;
  chartRefreshKeys?: Record<string, number>;
  onTabPaletteDrop?: (tabsWidgetId: string, type: PaletteDragPayload) => void;
  renderChild?: (
    widget: LayoutWidget,
    options?: RenderDashboardCanvasWidgetOptions,
  ) => ReactNode;
  componentMap?: import("@/lib/resolveVizComponent").VizComponentMap;
  componentsLoading?: boolean;
  /** 关联组件推库成功后刷新 componentMap（否则 resolve 仍读旧 payload） */
  onLinkedPayloadSynced?: () => void | Promise<unknown>;
  widgetActions?: DashboardWidgetActions;
};

function asLayoutWidget(
  widget: LayoutWidget | PixelLayoutWidget,
): LayoutWidget {
  return "width" in widget
    ? pixelWidgetToLayoutWidget(widget)
    : widget;
}

function widgetContentEqual(
  prev: LayoutWidget | PixelLayoutWidget,
  next: LayoutWidget | PixelLayoutWidget,
): boolean {
  const a = asLayoutWidget(prev);
  const b = asLayoutWidget(next);
  if (a.id !== b.id || a.type !== b.type || a.title !== b.title) return false;
  if (a.chartConfig !== b.chartConfig) return false;
  if (a.componentRef !== b.componentRef) return false;
  if (a.textConfig !== b.textConfig) return false;
  if (a.tabsConfig !== b.tabsConfig) return false;
  if (a.filterConfig !== b.filterConfig) return false;
  if (a.mediaConfig !== b.mediaConfig) return false;
  if (a.customVizConfig !== b.customVizConfig) return false;
  if ("width" in prev && "width" in next) {
    if (prev.width !== next.width || prev.height !== next.height) return false;
  }
  return true;
}

function rendererPropsEqual(
  prev: DashboardCanvasWidgetRendererProps,
  next: DashboardCanvasWidgetRendererProps,
): boolean {
  if (prev.mode !== next.mode || prev.shell !== next.shell || prev.nested !== next.nested) {
    return false;
  }
  if (prev.selected !== next.selected) return false;
  if (prev.styleRevision !== next.styleRevision) return false;
  if (prev.dashboardStyle !== next.dashboardStyle) return false;
  if (prev.chartPaletteDefaults !== next.chartPaletteDefaults) return false;
  if (prev.componentMap !== next.componentMap) return false;
  if (prev.widgetActions !== next.widgetActions) return false;
  if (prev.componentsLoading !== next.componentsLoading) return false;
  if (prev.allWidgets !== next.allWidgets) return false;
  if (prev.chartRefreshKeys !== next.chartRefreshKeys) return false;
  if (!widgetContentEqual(prev.widget, next.widget)) return false;
  if (prev.gridSize?.w !== next.gridSize?.w || prev.gridSize?.h !== next.gridSize?.h) {
    return false;
  }
  return true;
}

export const DashboardCanvasWidgetRenderer = memo(function DashboardCanvasWidgetRenderer({
  widget: sourceWidget,
  mode,
  selected,
  gridSize,
  linkage,
  filterValues,
  chartLinkage = null,
  onChartLinkageClick,
  onFilterValueChange,
  onSelect,
  onNestedSelect = onSelect,
  onDelete,
  setWidgets,
  nested = false,
  shell = "grid",
  dashboardStyle,
  chartPaletteDefaults,
  allWidgets,
  styleRevision: _styleRevision,
  chartRefreshKeys,
  onTabPaletteDrop,
  renderChild,
  componentMap,
  componentsLoading = false,
  onLinkedPayloadSynced,
  widgetActions,
}: DashboardCanvasWidgetRendererProps) {
  const widget = asLayoutWidget(sourceWidget);
  const isShapePlaying = usePixelShapePlayer();
  const isGridPlaying = useDashboardGridPlayer(widget.id);
  const hasPixelFootprint =
    "width" in sourceWidget &&
    !nested &&
    sourceWidget.width > 0 &&
    sourceWidget.height > 0;
  const pixelWidth = "width" in sourceWidget ? sourceWidget.width : 0;
  const pixelHeight = "height" in sourceWidget ? sourceWidget.height : 0;
  const chromeScale = usePixelChromeScale();
  const gapRuntime = resolveComponentGapRuntime(dashboardStyle ?? {}, {
    pixel: shell === "shape",
  });
  const chromeInset = resolveWidgetChromeInset(dashboardStyle?.widgetStyle);
  const effectiveScheme = resolveWidgetEffectiveScheme(dashboardStyle);
  const widgetTitleStyle =
    widget.type === "chart" && widget.chartConfig
      ? mergeChartTitleStyle(dashboardStyle?.titleStyle, widget.chartConfig, effectiveScheme)
      : mergeTitleStyle(dashboardStyle?.titleStyle);
  const titleChromePx =
    shell === "shape" &&
    widget.type === "chart" &&
    widget.chartConfig &&
    readChartTitleVisible(widget.chartConfig, dashboardStyle?.titleStyle)
      ? pixelViewTitleHeightPx(chromeScale, widgetTitleStyle)
      : 0;
  const pixelSize = useMemo(
    () =>
      hasPixelFootprint
        ? resolveEmbeddedLayoutFootprint(
            { width: pixelWidth, height: pixelHeight },
            {
              gapPx: gapRuntime.shellPaddingPx,
              chromeInset,
              titleChromePx,
            },
          )
        : undefined,
    [
      hasPixelFootprint,
      pixelWidth,
      pixelHeight,
      gapRuntime.shellPaddingPx,
      chromeInset.top,
      chromeInset.right,
      chromeInset.bottom,
      chromeInset.left,
      titleChromePx,
    ],
  );
  const effectiveGridSize =
    gridSize ??
    (nested ? { w: widget.colSpan, h: widget.rowSpan } : undefined);
  const filterParameters = useMemo(
    () =>
      widget.type === "chart" || widget.type === "customViz"
        ? buildWidgetFilterParams(widget.id, linkage, filterValues, chartLinkage)
        : undefined,
    [widget.id, widget.type, linkage, filterValues, chartLinkage],
  );
  const executeKey = useMemo(
    () => buildWidgetExecuteKey(filterParameters, chartRefreshKeys?.[widget.id] ?? 0),
    [filterParameters, chartRefreshKeys, widget.id],
  );

  const updateWidget = useCallback(
    (widgetId: string, patch: Partial<LayoutWidget>) => {
      setWidgets((previous) =>
        previous.map((item) =>
          item.id === widgetId ? { ...item, ...patch } : item,
        ),
      );
    },
    [setWidgets],
  );

  const selectWidget = nested ? onNestedSelect : onSelect;

  const handleSelect = useCallback(
    (event: { shiftKey: boolean }) => {
      preservePixelCanvasHostScroll(() => selectWidget(widget.id, event.shiftKey));
    },
    [selectWidget, widget.id],
  );

  const handleTitleChange = useCallback(
    (widgetId: string, title: string) => {
      setWidgets((previous) => resizeWidget(previous, widgetId, { title }));
    },
    [setWidgets],
  );

  const handleChartConfigChange = useCallback(
    (widgetId: string, chartConfig: LayoutWidget["chartConfig"]) => {
      if (!chartConfig) return;
      const normalized = normalizeLinkedChartConfigChange(widget, chartConfig);
      updateWidget(widgetId, { chartConfig: normalized });
    },
    [updateWidget, widget],
  );

  const handleTabsConfigChange = useCallback(
    (widgetId: string, tabsConfig: NonNullable<LayoutWidget["tabsConfig"]>) => {
      updateWidget(widgetId, { tabsConfig });
    },
    [updateWidget],
  );

  const handleTextConfigChange = useCallback(
    (widgetId: string, textConfig: NonNullable<LayoutWidget["textConfig"]>) => {
      updateWidget(widgetId, { textConfig });
    },
    [updateWidget],
  );

  const renderNested = useCallback(
    (child: LayoutWidget) =>
      renderChild?.(child, { nested: true, shell: "shape" }) ?? null,
    [renderChild],
  );

  const handleTabPaletteDrop = useCallback(
    (payload: PaletteDragPayload) => {
      onTabPaletteDrop?.(widget.id, payload);
    },
    [onTabPaletteDrop, widget.id],
  );

  const chrome = resolveDashboardChrome(dashboardStyle);
  const isDataScreenSurface = widgetActions?.surface === "data-screen";
  const showWidgetContextMenu =
    mode === "edit" &&
    Boolean(widgetActions) &&
    chrome.showFloatingActions &&
    ((shell === "grid" && !nested) || (isDataScreenSurface && nested));

  const widgetBody = (
    <DashboardWidget
      widget={widget}
      mode={mode}
      shell={shell}
      nested={nested}
      selected={selected}
      gridSize={effectiveGridSize}
      pixelSize={pixelSize}
      allWidgets={widget.type === "tabs" ? allWidgets : undefined}
      renderNestedWidget={nested ? undefined : renderNested}
      filterParameters={filterParameters}
      executeKey={executeKey}
      filterValue={
        widget.filterConfig
          ? filterValues[widget.filterConfig.filterId]
          : undefined
      }
      onFilterValueChange={onFilterValueChange}
      onSelect={handleSelect}
      onDelete={mode === "edit" ? onDelete : undefined}
      onTitleChange={handleTitleChange}
      onChartConfigChange={handleChartConfigChange}
      onChartLinkageClick={
        onChartLinkageClick
          ? (payload) => onChartLinkageClick(widget.id, payload)
          : undefined
      }
      onTabsConfigChange={nested ? undefined : handleTabsConfigChange}
      onTabPaletteDrop={nested || mode !== "edit" ? undefined : handleTabPaletteDrop}
      onTextConfigChange={handleTextConfigChange}
      dashboardStyle={dashboardStyle}
      chartPaletteDefaults={chartPaletteDefaults}
      suspendLiveResize={isShapePlaying || isGridPlaying}
      componentMap={componentMap}
      componentsLoading={componentsLoading}
      showToolbarDelete={!showWidgetContextMenu}
    />
  );

  return (
    <WidgetErrorBoundary
      widgetTitle={widget.title}
      onDelete={mode === "edit" ? () => onDelete(widget.id) : undefined}
    >
      {showWidgetContextMenu && widgetActions ? (
        <DashboardWidgetContextMenu
          widget={widget}
          actions={widgetActions}
          colorScheme={dashboardStyle?.colorScheme ?? "light"}
          selected={selected}
          onSelect={selectWidget}
          className="flex h-full min-h-0 min-w-0 flex-col"
        >
          {widgetBody}
        </DashboardWidgetContextMenu>
      ) : (
        widgetBody
      )}
    </WidgetErrorBoundary>
  );
}, rendererPropsEqual);
