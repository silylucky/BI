import { useCallback, useMemo } from "react";
import { DashboardGrid, type GridInsertAt } from "../DashboardGrid";
import { DashboardLayoutPreview } from "../DashboardLayoutPreview";
import {
  ChartMountProvider,
  CHART_MOUNT_MAX_EDIT,
} from "@/components/charts/ChartMountContext";
import { drillStackRevision } from "@/components/charts/ChartDrillContext";
import type { Linkage, ChartLinkageRuntime } from "../dashboardFilterUtils";
import type { DashboardCanvasEditor } from "../dashboardCanvasMode";
import { pixelWidgetToLayoutWidget } from "../dashboardCanvasMode";
import { PixelCanvas, type PixelRect } from "../pixelCanvas";
import type { DashboardWidgetActions } from "../WidgetContextMenu";
import {
  PaletteDragProvider,
  usePaletteDocumentDrag,
} from "../pixelCanvas/paletteDragContext";
import {
  sortWidgets,
  type DashboardLayout,
  type DashboardLayoutV2,
  type DashboardStyleConfig,
  type LayoutWidget,
  type PixelLayoutWidget,
} from "../layoutUtils";
import {
  pickWidgetDashboardStyle,
  resolveArtboardStyle,
  widgetDashboardStyleFingerprint,
  pickChartPaletteDefaults,
  chartPaletteDefaultsFingerprint,
  canvasArtboardRepaintFingerprint,
} from "../dashboardStyleConfig";
import { resolveDashboardGapRuntimeFromLayout, resolveEffectiveDashboardStyle } from "../stylePipeline";
import { DashboardStyleSurface } from "../DashboardStyleSurface";
import { DataScreenEditViewport } from "../screen/DataScreenEditViewport";
import type { PresentationMode } from "../screen/presentationScale";
import { DATA_SCREEN_EDIT_PRESENTATION_DEFAULT } from "../screen/presentationScale";
import { DashboardWidgetsProvider } from "../DashboardWidgetsContext";
import { widgetFilterExecuteRevision } from "../dashboardWidgetExecuteKey";
import { isGeoMapChartType } from "@/lib/chartViewConfig";
import { readChartDeStyle, readChartGeoStyle } from "@/lib/chartDeStyle";
import type { PaletteInsertType } from "../createLayoutWidget";
import type { PaletteDragPayload } from "@/lib/dashboardDnd";
import type { TabInsertIntent } from "../pixelCanvas/tabInsertResolver";
import {
  DashboardCanvasWidgetRenderer,
  type DashboardWidgetsSetter,
  type RenderDashboardCanvasWidgetOptions,
} from "./DashboardCanvasWidgetRenderer";
import { useVizComponentMap } from "@/hooks/useVizComponentMap";
import { linkedComponentContentRevisionSuffix } from "@/lib/resolveVizComponent";
import { screenVisualContentRevisionSuffix } from "@/lib/screenVisualAssets";

type DashboardEditCanvasProps = {
  mode: "edit" | "view";
  editor: DashboardCanvasEditor;
  layout: DashboardLayout;
  widgets: LayoutWidget[];
  selectedIds: Set<string>;
  linkage: Linkage;
  filterValues: Record<string, string>;
  chartLinkage?: ChartLinkageRuntime | null;
  onChartLinkageClick?: (
    widgetId: string,
    payload: { parameterKey: string; value: string },
  ) => void;
  styleConfig?: DashboardStyleConfig;
  chartRefreshKeys?: Record<string, number>;
  setWidgets: DashboardWidgetsSetter;
  setPixelLayout: (layout: DashboardLayoutV2) => void;
  onSelect: (widgetId: string, additive: boolean) => void;
  onNestedSelect: (widgetId: string, additive: boolean) => void;
  onClearSelection: () => void;
  onDeleteWidget: (widgetId: string) => void;
  onFilterValueChange: (filterId: string, value: string) => void;
  onDropInsert: (type: PaletteInsertType, at: GridInsertAt) => void;
  onPaletteDrop?: (
    type: PaletteDragPayload,
    point: { x: number; y: number },
    sourceEvent?: DragEvent,
  ) => void;
  onTabPaletteDrop?: (tabsWidgetId: string, type: PaletteDragPayload) => void;
  onTabChildUnpark?: (widgetId: string, point: import("../pixelCanvas/geometry").PixelPoint) => void;
  onViewportChange: (viewport: PixelRect) => void;
  tabInsertIntent?: TabInsertIntent | null;
  onTabInsertIntentChange?: (intent: TabInsertIntent | null) => void;
  widgetActions?: DashboardWidgetActions;
  dataScreenPresentationMode?: PresentationMode;
};

export function DashboardEditCanvas({
  mode,
  editor,
  layout,
  widgets,
  selectedIds,
  linkage,
  filterValues,
  chartLinkage = null,
  onChartLinkageClick,
  styleConfig = {},
  chartRefreshKeys,
  setWidgets,
  setPixelLayout,
  onSelect,
  onNestedSelect,
  onClearSelection,
  onDeleteWidget,
  onFilterValueChange,
  onDropInsert,
  onPaletteDrop,
  onTabPaletteDrop,
  onTabChildUnpark,
  onViewportChange,
  tabInsertIntent = null,
  onTabInsertIntentChange,
  widgetActions,
  dataScreenPresentationMode = DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
}: DashboardEditCanvasProps) {
  const { componentMap, refetch: refetchComponents, isLoading: componentsLoading } = useVizComponentMap(widgets);
  const effectiveStyle = useMemo(
    () => resolveEffectiveDashboardStyle(layout, styleConfig),
    // 布局几何变更不应触发样式 bootstrap；依赖 styleConfig 内容
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout.styleConfig 仅作 liveStyle 缺省回退
    [styleConfig, layout.styleConfig],
  );
  const artboardStyleKey = canvasArtboardRepaintFingerprint(effectiveStyle);
  const widgetDashboardStyle = useMemo(
    () => pickWidgetDashboardStyle(effectiveStyle),
    [widgetDashboardStyleFingerprint(effectiveStyle)],
  );
  const styleRevision = widgetDashboardStyleFingerprint(effectiveStyle);
  const chartPaletteDefaults = useMemo(
    () => pickChartPaletteDefaults(widgetDashboardStyle),
    [chartPaletteDefaultsFingerprint(widgetDashboardStyle)],
  );
  const paletteDragActive = usePaletteDocumentDrag(
    mode === "edit" && Boolean(onPaletteDrop || onTabPaletteDrop),
  );

  const renderCanvasWidget = useCallback(
    (
      widget: LayoutWidget | PixelLayoutWidget,
      options?: RenderDashboardCanvasWidgetOptions,
    ) => {
      const layoutWidget = "width" in widget ? pixelWidgetToLayoutWidget(widget) : widget;
      return (
        <DashboardCanvasWidgetRenderer
          key={layoutWidget.id}
          widget={widget}
          mode="edit"
          selected={selectedIds.has(layoutWidget.id)}
          shell={options?.shell}
          gridSize={options?.gridSize}
          nested={options?.nested}
          linkage={linkage}
          filterValues={filterValues}
          chartLinkage={chartLinkage}
          onChartLinkageClick={onChartLinkageClick}
          onFilterValueChange={onFilterValueChange}
          onSelect={onSelect}
          onNestedSelect={onNestedSelect}
          onDelete={onDeleteWidget}
          setWidgets={setWidgets}
          renderChild={renderCanvasWidget}
          dashboardStyle={widgetDashboardStyle}
          chartPaletteDefaults={chartPaletteDefaults}
          allWidgets={layoutWidget.type === "tabs" ? widgets : undefined}
          styleRevision={styleRevision}
          chartRefreshKeys={chartRefreshKeys}
          onTabPaletteDrop={onTabPaletteDrop}
          componentMap={componentMap}
          componentsLoading={componentsLoading}
          onLinkedPayloadSynced={refetchComponents}
          widgetActions={widgetActions}
        />
      );
    },
    [
      selectedIds,
      linkage,
      filterValues,
      chartLinkage,
      onChartLinkageClick,
      onFilterValueChange,
      onSelect,
      onNestedSelect,
      onDeleteWidget,
      setWidgets,
      widgetDashboardStyle,
      chartPaletteDefaults,
      widgets,
      styleRevision,
      chartRefreshKeys,
      onTabPaletteDrop,
      componentMap,
      componentsLoading,
      refetchComponents,
      widgetActions,
    ],
  );

  const renderPixelWidget = useCallback(
    (widget: PixelLayoutWidget) => renderCanvasWidget(widget, { shell: "shape" }),
    [renderCanvasWidget],
  );

  const widgetContentRevision = useCallback(
    (widget: PixelLayoutWidget) => {
      const base = widgetFilterExecuteRevision(
        widget.id,
        linkage,
        filterValues,
        chartRefreshKeys,
        0,
        chartLinkage,
      );
      if (widget.type === "chart" && widget.chartConfig && isGeoMapChartType(widget.chartConfig.chartType)) {
        const manualStack =
          readChartGeoStyle(readChartDeStyle(widget.chartConfig)).manualDrillStack ?? [];
        const drillRev = drillStackRevision(manualStack);
        if (drillRev) return `${base}:geo-drill:${drillRev}`;
      }
      if (widget.type === "tabs" && widget.tabsConfig) {
        const childCount = widget.tabsConfig.panes.reduce(
          (sum, pane) => sum + pane.childWidgetIds.length,
          0,
        );
        return `${base}:${childCount}`;
      }
      const linkedRev = linkedComponentContentRevisionSuffix(
        pixelWidgetToLayoutWidget(widget),
        componentMap,
        componentsLoading,
      );
      if (linkedRev) return `${base}${linkedRev}`;
      if (widget.type === "customViz" && widget.customVizConfig) {
        const cfg = widget.customVizConfig;
        return `${base}:cv:${JSON.stringify({
          style: cfg.style ?? null,
          displayStyle: cfg.displayStyle ?? null,
          widgetStyle: cfg.widgetStyle ?? null,
          binding: cfg.dataBinding ?? null,
        })}`;
      }
      const screenVisualRev = screenVisualContentRevisionSuffix(
        pixelWidgetToLayoutWidget(widget),
      );
      if (screenVisualRev) return `${base}${screenVisualRev}`;
      return base;
    },
    [linkage, filterValues, chartRefreshKeys, chartLinkage, componentMap, componentsLoading],
  );

  if (mode === "view" || editor === "pixel-readonly") {
    return (
      <DashboardLayoutPreview
        layout={layout}
        styleConfig={effectiveStyle}
        linkage={linkage}
        filterValues={filterValues}
        chartLinkage={chartLinkage}
        onChartLinkageClick={mode === "view" ? onChartLinkageClick : undefined}
        onFilterValueChange={mode === "view" ? onFilterValueChange : undefined}
        className="h-full min-h-0 w-full"
      />
    );
  }

  const isDataScreenEdit =
    layout.version === 2 && effectiveStyle.surfaceKind === "data-screen";

  const pixelCanvas = (
    <PixelCanvas
      mode="edit"
      layout={layout as DashboardLayoutV2}
      styleConfig={effectiveStyle}
      designViewportLocked={isDataScreenEdit}
      viewportFit={isDataScreenEdit ? "data-screen" : undefined}
      selectedIds={selectedIds}
      onSelect={onSelect}
      onClearSelection={onClearSelection}
      onLayoutChange={setPixelLayout}
      onViewportChange={onViewportChange}
      onPaletteDrop={onPaletteDrop}
      onTabPaletteDrop={onTabPaletteDrop}
      onTabChildUnpark={onTabChildUnpark}
      onTabInsertIntentChange={onTabInsertIntentChange}
      widgetActions={widgetActions}
      renderWidget={renderPixelWidget}
      widgetContentRevision={widgetContentRevision}
      className={isDataScreenEdit ? "h-full w-full" : undefined}
    />
  );

  return (
    <ChartMountProvider maxConcurrent={CHART_MOUNT_MAX_EDIT}>
    <DashboardWidgetsProvider widgets={widgets}>
      <PaletteDragProvider
        active={paletteDragActive}
        tabInsertIntent={tabInsertIntent}
        onTabInsertIntentChange={onTabInsertIntentChange ?? (() => {})}
      >
      <DashboardStyleSurface
        styleConfig={effectiveStyle}
        componentGapPx={
          resolveDashboardGapRuntimeFromLayout(layout, styleConfig).shellPaddingPx
        }
        className="h-full min-h-0"
      >
        {layout.version === 2 ? (
          isDataScreenEdit ? (
            <DataScreenEditViewport
              canvasWidth={layout.canvas.width}
              canvasHeight={layout.canvas.height}
              presentationMode={dataScreenPresentationMode}
              className="h-full min-h-0 w-full"
              onBlankPointerDown={onClearSelection}
            >
              {pixelCanvas}
            </DataScreenEditViewport>
          ) : (
            pixelCanvas
          )
        ) : (
          <div className="relative h-full min-h-0" data-dashboard-thumbnail-capture="">
            <div
              key={artboardStyleKey}
              data-testid="dashboard-canvas-backdrop"
              className="pointer-events-none absolute inset-0 z-0"
              style={resolveArtboardStyle(effectiveStyle)}
              aria-hidden
            />
            <DashboardGrid
              mode="edit"
              widgets={widgets}
              styleConfig={effectiveStyle}
              selectedIds={selectedIds}
              onClearSelection={onClearSelection}
              onInsertChart={onDropInsert}
              onLayoutChange={(next) => setWidgets(sortWidgets(next))}
              renderWidget={(widget, gridSize) => renderCanvasWidget(widget, { gridSize })}
              className="relative z-[1] h-full min-h-0"
            />
          </div>
        )}
      </DashboardStyleSurface>
      </PaletteDragProvider>
    </DashboardWidgetsProvider>
    </ChartMountProvider>
  );
}
