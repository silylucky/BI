import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { GeoMapPlaceholderChart } from "@/components/charts/adapters/GeoMapPlaceholderChart";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { useChartMountGate } from "@/components/charts/ChartMountContext";
import {
  resolveChartMountPriority,
  useDashboardGridPlayingWidgetId,
} from "@/components/dashboard/dashboardGridPlayerContext";
import { useInViewport } from "@/hooks/useInViewport";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { isGeoMapChartType } from "@/lib/chartViewConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IconButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";
import type { PaletteDragPayload } from "@/lib/dashboardDnd";
import type { DashboardWidgetShell } from "./dashboardCanvasMode";
import { FilterWidget } from "./FilterWidget";
import { TextWidget } from "./TextWidget";
import { MediaWidget } from "./MediaWidget";
import { CustomVizWidget } from "./CustomVizWidget";
import { TabsWidget } from "./TabsWidget";
import { TabNestedDragRail } from "./TabNestedDragRail";
import type {
  FilterWidgetConfig,
  LayoutWidget,
  MediaWidgetConfig,
  CustomVizWidgetConfig,
  TabsWidgetConfig,
  TextWidgetConfig,
  DashboardStyleConfig,
} from "./layoutUtils";
import { mergeTitleStyle, pickChartPaletteDefaults, resolveWidgetShellPaintColor, chartPaletteDefaultsFingerprint } from "./dashboardStyleConfig";
import { resolveDashboardChrome } from "./dashboardChromeConfig";
import { parseDeRefreshIntervalSec, readChartDeDisplay, resolveChartQueryLimit } from "@/lib/chartDeDisplay";
import { resolveWidgetEffectiveScheme } from "@/lib/chartSurfaceTheme";
import { mergeChartTitleStyle, mergeShapeInnerPresentation, readChartRemark, readChartTitleVisible, resolveChartContentShellStyle } from "@/lib/chartDeStyle";
import { WidgetShellLegendProvider } from "./pixelCanvas/widgetShellLegendContext";
import { WidgetChartLegendShell } from "@/components/charts/WidgetChartLegendShell";
import {
  WidgetShellBackgroundLayers,
  WidgetShellFrameLayers,
} from "@/components/dashboard/WidgetShellPresentationLayers";
import { isWidgetConfigReady } from "./createLayoutWidget";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import { pixelDragRailHeightPx, pixelViewTitleHeightPx, dwCaption } from "./dashboardWidgetTypography";
import { usePixelChromeScale } from "./pixelCanvas/PixelCanvasScaleContext";
import { widgetChartIcon, WIDGET_CHART_LABELS } from "./widgetIcons";
import { resolveLayoutWidget, type VizComponentMap } from "@/lib/resolveVizComponent";
import { isLinkedComponentRef, isValidComponentUuid } from "@/lib/vizComponents";
import {
  type DashboardPreviewProfile,
  isCardPreviewProfile,
  resolveCardPreviewQueryLimit,
} from "@/lib/dashboardPreviewProfile";
import {
  resolveEditPaintMaxEdge,
  shouldDeferEditLivePaint,
} from "@/lib/dashboardEditChartPerf";

function useWidgetAutoRefreshExecuteKey(
  chartConfig: ChartViewConfig | undefined,
  baseKey: string | undefined,
  enabled = true,
): string | undefined {
  const refreshSec = useMemo(() => {
    if (!enabled || !chartConfig) return null;
    return parseDeRefreshIntervalSec(readChartDeDisplay(chartConfig).refreshMode);
  }, [chartConfig, enabled]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!refreshSec || refreshSec < 5) return undefined;
    const timer = window.setInterval(() => setTick((n) => n + 1), refreshSec * 1000);
    return () => window.clearInterval(timer);
  }, [refreshSec]);

  if (tick === 0) return baseKey;
  return `${baseKey ?? "chart"}:refresh:${tick}`;
}

type DashboardWidgetProps = {
  widget: LayoutWidget;
  mode: "edit" | "view";
  shell?: DashboardWidgetShell;
  selected?: boolean;
  /** 编辑态栅格实时尺寸（拖/缩放中） */
  gridSize?: { w: number; h: number };
  /** 像素画布逻辑尺寸（shape 壳层下图表尺寸估算） */
  pixelSize?: { width: number; height: number };
  onSelect?: (event: MouseEvent) => void;
  onDelete?: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onChartConfigChange?: (id: string, config: ChartViewConfig) => void;
  onChartLinkageClick?: (payload: { parameterKey: string; value: string }) => void;
  filterParameters?: Record<string, string>;
  executeKey?: string;
  filterValue?: string;
  onFilterValueChange?: (filterId: string, value: string) => void;
  allWidgets?: LayoutWidget[];
  renderNestedWidget?: (widget: LayoutWidget) => ReactNode;
  onTabsConfigChange?: (id: string, tabsConfig: TabsWidgetConfig) => void;
  onTabPaletteDrop?: (payload: PaletteDragPayload) => void;
  onTextConfigChange?: (id: string, config: TextWidgetConfig) => void;
  dashboardStyle?: DashboardStyleConfig;
  chartPaletteDefaults?: ReturnType<typeof pickChartPaletteDefaults>;
  /** DataEase isPlayer：交互中暂停 React 尺寸 props，由 DOM 百分比跟手 */
  suspendLiveResize?: boolean;
  /** Tab 内嵌子组件：与顶层 shape 同壳层，左侧拖出把手回画布 */
  nested?: boolean;
  /** 3D 地图渲染分级：列表 thumbnail / 看板 embed / 全屏预览 full */
  geo3dRenderTier?: Geo3dRenderTier;
  previewProfile?: DashboardPreviewProfile;
  componentMap?: VizComponentMap;
  /** 关联组件 batch-resolve 进行中（仅未拿到 payload 时用于 loading） */
  componentsLoading?: boolean;
  /** 顶栏删除按钮；右键菜单开启时由外层关闭 */
  showToolbarDelete?: boolean;
};

function linkedWidgetPayloadReady(widget: LayoutWidget): boolean {
  switch (widget.type) {
    case "chart":
      return Boolean(widget.chartConfig);
    case "filter":
      return Boolean(widget.filterConfig);
    case "text":
      return Boolean(widget.textConfig);
    case "media":
      return Boolean(widget.mediaConfig);
    case "customViz":
      return Boolean(widget.customVizConfig?.artifactId);
    default:
      return false;
  }
}

function WidgetLinkedComponentState({
  invalidRef,
  missing,
}: {
  invalidRef?: boolean;
  missing?: boolean;
}) {
  if (invalidRef) {
    return (
      <div className="flex h-full min-h-[64px] flex-col items-center justify-center gap-1 px-3 text-center text-theme-xs text-gray-500 dark:text-gray-400">
        <span>组件引用无效</span>
        <span className="text-theme-xs text-gray-400 dark:text-gray-500">请在右侧解除关联后重新选择</span>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="flex h-full min-h-[64px] flex-col items-center justify-center gap-1 px-3 text-center text-theme-xs text-gray-500 dark:text-gray-400">
        <span>组件库配置不可用</span>
        <span className="text-theme-xs text-gray-400 dark:text-gray-500">
          组件已下架、无访问权限或未发布
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[64px] items-center justify-center px-3 text-theme-xs text-gray-500 dark:text-gray-400">
      正在加载组件库配置…
    </div>
  );
}

function WidgetPendingPreview({
  widget,
  dashboardStyle,
}: {
  widget: LayoutWidget;
  dashboardStyle?: DashboardStyleConfig;
}) {
  const chartType = widget.chartConfig?.chartType ?? "bar";
  const Icon = widgetChartIcon(chartType);
  const typeLabel = WIDGET_CHART_LABELS[chartType] ?? chartType;
  const shellColor = resolveWidgetShellPaintColor(dashboardStyle);
  const effectiveScheme = resolveWidgetEffectiveScheme(dashboardStyle);
  const mapIsDark = effectiveScheme === "dark";

  if (isGeoMapChartType(chartType)) {
    return (
      <div className="relative flex h-full min-h-[64px] flex-col overflow-hidden">
        <GeoMapPlaceholderChart fill hint="" isDark={mapIsDark} />
        <p className={cn("dw-hint pointer-events-none absolute inset-x-0 bottom-8 text-center")}>
          请配置数据源与查询
        </p>
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-wrap items-center justify-center gap-1.5 px-2">
          <Badge variant="light" color="light" size="sm">
            {typeLabel}
          </Badge>
          <Badge variant="light" color="warning" size="sm">
            待配置
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-pending-preview flex h-full min-h-[64px] flex-col items-center justify-center gap-2 px-3 py-3">
      <span className="widget-pending-preview-icon flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Badge variant="light" color="light" size="sm">
          {typeLabel}
        </Badge>
        <Badge variant="light" color="warning" size="sm">
          待配置
        </Badge>
      </div>
      <p className={cn("text-center", dwCaption)}>
        在右侧配置数据源与查询
      </p>
    </div>
  );
}

type DashboardChartMountGateProps = {
  widgetId: string;
  selected: boolean;
  mode: "edit" | "view";
  shell: DashboardWidgetShell;
  children: (gate: {
    queryEnabled: boolean;
    renderEnabled: boolean;
    mountGateStatus?: "queue" | "offscreen";
    onMountReady: () => void;
    viewportRef: (node: HTMLDivElement | null) => void;
  }) => ReactNode;
};

/** 图表查数/渲染挂载调度 + 大屏平移时屏外暂停 */
function DashboardChartMountGate({
  widgetId,
  selected,
  mode,
  shell,
  children,
}: DashboardChartMountGateProps) {
  const viewportRoot =
    shell === "grid" ? ".dashboard-grid-edit" : "[data-canvas-scale-viewport]";
  const { ref: viewportRef, inView } = useInViewport<HTMLDivElement>({
    rootSelector: viewportRoot,
    enabled: mode === "edit",
  });
  const gridPlayingWidgetId = useDashboardGridPlayingWidgetId();
  const priority = resolveChartMountPriority(
    widgetId,
    selected,
    shell,
    gridPlayingWidgetId,
  );
  const { canQuery, canRender, onMountReady } = useChartMountGate(widgetId, {
    priority,
    inView: mode === "edit" ? inView : true,
  });

  const mountGateStatus: "queue" | "offscreen" | undefined =
    mode !== "edit"
      ? undefined
      : !inView
        ? "offscreen"
        : !canRender || !canQuery
          ? "queue"
          : undefined;

  return (
    <>
      {children({
        queryEnabled: canQuery,
        renderEnabled: canRender,
        mountGateStatus,
        onMountReady,
        viewportRef,
      })}
    </>
  );
}

export function DashboardWidget({
  widget,
  mode,
  shell = "grid",
  selected = false,
  gridSize,
  pixelSize,
  onSelect,
  onDelete,
  onTitleChange,
  onChartConfigChange,
  onChartLinkageClick,
  filterParameters,
  executeKey,
  filterValue,
  onFilterValueChange,
  allWidgets,
  renderNestedWidget,
  onTabsConfigChange,
  onTabPaletteDrop,
  onTextConfigChange,
  dashboardStyle,
  chartPaletteDefaults: chartPaletteDefaultsProp,
  suspendLiveResize = false,
  nested = false,
  geo3dRenderTier = "embed",
  previewProfile = "default",
  componentMap,
  componentsLoading = false,
  showToolbarDelete = true,
}: DashboardWidgetProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const chromeScale = usePixelChromeScale();
  const isCardPreview = isCardPreviewProfile(previewProfile);
  const resolvedWidget = useMemo(
    () => (componentMap ? resolveLayoutWidget(widget, componentMap) : widget),
    [widget, componentMap],
  );
  const linkedRef = isLinkedComponentRef(widget.componentRef) ? widget.componentRef : null;
  const linkedPayloadReady = linkedWidgetPayloadReady(resolvedWidget);
  const showLinkedLoading =
    Boolean(linkedRef) && Boolean(componentMap) && !linkedPayloadReady && componentsLoading;
  const showLinkedMissing =
    Boolean(linkedRef) &&
    Boolean(componentMap) &&
    !linkedPayloadReady &&
    !componentsLoading;
  const chartPaletteDefaults = useMemo(
    () => chartPaletteDefaultsProp ?? pickChartPaletteDefaults(dashboardStyle),
    [chartPaletteDefaultsProp, chartPaletteDefaultsFingerprint(dashboardStyle)],
  );
  const editPaintMaxEdge = resolveEditPaintMaxEdge(mode === "edit", selected);
  const deferEditLivePaint = shouldDeferEditLivePaint(mode === "edit", selected);
  const chartCfg = resolvedWidget.type === "chart" ? resolvedWidget.chartConfig : undefined;
  const widgetExecuteKey = useWidgetAutoRefreshExecuteKey(
    chartCfg,
    executeKey,
    !isCardPreview,
  );

  if (showLinkedLoading || showLinkedMissing) {
    return (
      <WidgetLinkedComponentState
        invalidRef={showLinkedMissing && linkedRef && !isValidComponentUuid(linkedRef.componentId)}
        missing={showLinkedMissing && linkedRef && isValidComponentUuid(linkedRef.componentId)}
      />
    );
  }

  if (resolvedWidget.type === "filter" && resolvedWidget.filterConfig) {
    return (
      <FilterWidget
        widget={resolvedWidget as LayoutWidget & { filterConfig: FilterWidgetConfig }}
        mode={mode}
        shell={shell}
        nested={nested}
        selected={selected}
        value={filterValue ?? widget.filterConfig.defaultValue ?? ""}
        onValueChange={(filterId, value) => onFilterValueChange?.(filterId, value)}
        onSelect={() => onSelect?.({ shiftKey: false } as MouseEvent)}
        onTitleChange={onTitleChange}
        onDelete={onDelete}
        dashboardStyle={dashboardStyle}
        showToolbarDelete={showToolbarDelete}
      />
    );
  }

  if (resolvedWidget.type === "text" && resolvedWidget.textConfig) {
    return (
      <TextWidget
        widget={resolvedWidget as LayoutWidget & { textConfig: TextWidgetConfig }}
        mode={mode}
        shell={shell}
        nested={nested}
        selected={selected}
        onSelect={() => onSelect?.({ shiftKey: false } as MouseEvent)}
        onTitleChange={onTitleChange}
        onDelete={onDelete}
        onTextConfigChange={onTextConfigChange}
        dashboardStyle={dashboardStyle}
        showToolbarDelete={showToolbarDelete}
      />
    );
  }

  if (resolvedWidget.type === "media" && resolvedWidget.mediaConfig) {
    return (
      <MediaWidget
        widget={resolvedWidget as LayoutWidget & { mediaConfig: MediaWidgetConfig }}
        mode={mode}
        shell={shell}
        nested={nested}
        selected={selected}
        onSelect={() => onSelect?.({ shiftKey: false } as MouseEvent)}
        onTitleChange={onTitleChange}
        onDelete={onDelete}
        dashboardStyle={dashboardStyle}
        showToolbarDelete={showToolbarDelete}
      />
    );
  }

  if (resolvedWidget.type === "customViz" && resolvedWidget.customVizConfig) {
    return (
      <CustomVizWidget
        widget={resolvedWidget as LayoutWidget & { customVizConfig: CustomVizWidgetConfig }}
        mode={mode}
        shell={shell}
        nested={nested}
        selected={selected}
        onSelect={() => onSelect?.({ shiftKey: false } as MouseEvent)}
        onTitleChange={onTitleChange}
        onDelete={onDelete}
        dashboardStyle={dashboardStyle}
        showToolbarDelete={showToolbarDelete}
        filterParameters={filterParameters}
        executeKey={widgetExecuteKey}
      />
    );
  }

  if (resolvedWidget.type === "tabs" && resolvedWidget.tabsConfig) {
    return (
      <TabsWidget
        widget={resolvedWidget as LayoutWidget & { tabsConfig: TabsWidgetConfig }}
        allWidgets={allWidgets ?? []}
        mode={mode}
        shell={shell}
        selected={selected}
        onSelect={() => onSelect?.({ shiftKey: false } as MouseEvent)}
        onTitleChange={onTitleChange}
        onDelete={onDelete}
        onTabsConfigChange={(cfg) => onTabsConfigChange?.(widget.id, cfg)}
        onPaletteDrop={onTabPaletteDrop}
        renderChild={(child) => renderNestedWidget?.(child) ?? null}
        dashboardStyle={dashboardStyle}
        showToolbarDelete={showToolbarDelete}
      />
    );
  }

  if (resolvedWidget.type !== "chart") {
    return null;
  }

  const chartType = resolvedWidget.chartConfig?.chartType ?? "bar";
  const Icon = widgetChartIcon(chartType);
  const typeLabel = WIDGET_CHART_LABELS[chartType] ?? chartType;
  const configReady = isWidgetConfigReady(resolvedWidget.chartConfig);
  const inShapeShell = shell === "shape";
  const sizeW = gridSize?.w ?? resolvedWidget.colSpan;
  const sizeH = gridSize?.h ?? resolvedWidget.rowSpan;
  const sizeLabel =
    inShapeShell && pixelSize
      ? `${Math.round(pixelSize.width)}×${Math.round(pixelSize.height)}`
      : `${sizeW}×${sizeH}`;
  const chartTitleVisibleInShell =
    inShapeShell &&
    resolvedWidget.chartConfig &&
    readChartTitleVisible(resolvedWidget.chartConfig, dashboardStyle?.titleStyle);
  const effectiveScheme = resolveWidgetEffectiveScheme(dashboardStyle);
  const titleStyle =
    resolvedWidget.chartConfig
      ? mergeChartTitleStyle(
          dashboardStyle?.titleStyle,
          resolvedWidget.chartConfig,
          effectiveScheme,
        )
      : mergeTitleStyle(dashboardStyle?.titleStyle);
  const titleChromePx = chartTitleVisibleInShell
    ? pixelViewTitleHeightPx(chromeScale, titleStyle)
    : 0;
  const dragRailPx =
    inShapeShell && mode === "edit" && selected ? pixelDragRailHeightPx(chromeScale) : 0;
  const shapeContentChromePx = titleChromePx + dragRailPx;
  const shellResolved = resolvedWidget.chartConfig
    ? resolveChartContentShellStyle(
        dashboardStyle?.widgetStyle,
        resolvedWidget.chartConfig,
        effectiveScheme,
      )
    : null;
  const gridShellPresentation = shellResolved
    ? mergeShapeInnerPresentation({
        outer: shellResolved.outer,
        inner: shellResolved.inner,
        innerBackgroundLayer: shellResolved.innerBackgroundLayer,
        innerFrameLayer: shellResolved.innerFrameLayer,
      })
    : null;
  const shellColor = resolveWidgetShellPaintColor(dashboardStyle);
  const chrome = resolveDashboardChrome(dashboardStyle);
  const chartTitleVisible =
    inShapeShell && chartTitleVisibleInShell && mode === "view";
  const queryLimit = resolvedWidget.chartConfig
    ? isCardPreview
      ? resolveCardPreviewQueryLimit(
          resolveChartQueryLimit(resolvedWidget.chartConfig, dashboardStyle ?? {}),
        )
      : resolveChartQueryLimit(resolvedWidget.chartConfig, dashboardStyle ?? {})
    : 100;
  const chartRemark = resolvedWidget.chartConfig ? readChartRemark(resolvedWidget.chartConfig) : { show: false, text: "" };
  const readyChartConfig = resolvedWidget.chartConfig;

  const chartBody =
    mode === "edit" && !configReady ? (
      <WidgetPendingPreview widget={resolvedWidget} dashboardStyle={dashboardStyle} />
    ) : readyChartConfig ? (
      <DashboardChartMountGate widgetId={widget.id} selected={selected} mode={mode} shell={shell}>
        {({ queryEnabled, renderEnabled, mountGateStatus, onMountReady, viewportRef }) => (
          <div ref={viewportRef} className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <ChartRenderer
              embedded
              gridSpan={gridSize}
              pixelSize={pixelSize}
              contentChromePx={inShapeShell ? shapeContentChromePx : 0}
              config={readyChartConfig}
              title={widget.title}
              widgetId={widget.id}
              drillEnabled={
                !isCardPreview &&
                (mode === "view" ||
                  (mode === "edit" && isGeoMapChartType(readyChartConfig.chartType)))
              }
              filterParameters={filterParameters}
              executeKey={widgetExecuteKey}
              queryLimit={queryLimit}
              paletteId={dashboardStyle?.paletteId}
              paletteColors={dashboardStyle?.paletteColors}
              dashboardColorDefaults={chartPaletteDefaults}
              numberFormat={dashboardStyle?.numberFormat}
              colorScheme={dashboardStyle?.colorScheme ?? "light"}
              widgetShellColor={shellColor}
              showLoadingHint={!isCardPreview && chrome.showChartLoadingHint}
              suspendLiveResize={suspendLiveResize || deferEditLivePaint}
              dashboardEditMode={mode === "edit"}
              queryEnabled={queryEnabled}
              renderEnabled={renderEnabled}
              mountGateStatus={mountGateStatus}
              onMountReady={onMountReady}
              geo3dRenderTier={geo3dRenderTier}
              geo3dAnimationActive={!isCardPreview && (mode !== "edit" || selected)}
              paintMaxEdge={editPaintMaxEdge}
              previewProfile={previewProfile}
              onChartConfigChange={
                onChartConfigChange
                  ? (config) => onChartConfigChange(widget.id, config)
                  : undefined
              }
              onChartLinkageClick={
                !isCardPreview && mode === "view" && onChartLinkageClick
                  ? onChartLinkageClick
                  : undefined
              }
            />
          </div>
        )}
      </DashboardChartMountGate>
    ) : null;

  if (inShapeShell) {
    return (
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden",
        )}
      >
        {nested && mode === "edit" ? (
          <TabNestedDragRail widgetId={widget.id} className="h-full w-7" />
        ) : null}
        <div
          role={mode === "edit" ? "button" : undefined}
          tabIndex={mode === "edit" ? 0 : undefined}
          onClick={
            mode === "edit"
              ? (e) => {
                  e.stopPropagation();
                  onSelect?.(e);
                }
              : undefined
          }
          onKeyDown={
            mode === "edit"
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.({ shiftKey: e.shiftKey } as MouseEvent);
                  }
                }
              : undefined
          }
          className={cn(
            "dashboard-no-drag flex h-full min-h-0 min-w-0 flex-1 flex-col",
            mode === "edit" && "cursor-pointer",
            nested && mode === "edit" && "pl-7",
          )}
        >
          {chartBody}
        </div>
        {onDelete && showToolbarDelete ? (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除组件</AlertDialogTitle>
                <AlertDialogDescription>
                  确定删除「{widget.title}」？删除后需保存布局才会生效。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete(widget.id);
                    setConfirmOpen(false);
                  }}
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-theme-xs transition-[border-color,box-shadow] dark:bg-white/[0.03]",
        selected && "dashboard-widget-selected",
        selected
          ? "border-gray-400 shadow-theme-sm ring-1 ring-gray-300/70 dark:border-gray-600 dark:ring-gray-600/40"
          : "border-gray-200 dark:border-gray-800",
        gridShellPresentation?.shell.style.backgroundColor ? undefined : "bg-white",
      )}
      style={gridShellPresentation?.shell.style}
    >
      {gridShellPresentation ? (
        <WidgetShellBackgroundLayers layers={gridShellPresentation.shell} prefix={`grid-${widget.id}`} />
      ) : null}
      {mode === "edit" && chrome.showChartActionButtons ? (
        <div className="relative z-[1] flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.04]">
          <HintTooltip label="拖动以移动组件">
            <div
              className="dashboard-drag-handle flex shrink-0 cursor-grab items-center active:cursor-grabbing"
              role="group"
              aria-label="拖动以移动组件"
            >
              <GripVertical
                className="size-3.5 shrink-0 text-gray-300 dark:text-gray-600"
                aria-hidden
              />
            </div>
          </HintTooltip>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-gray-500 shadow-theme-xs dark:bg-white/5 dark:text-gray-400">
            <Icon className="size-3.5" aria-hidden />
          </span>
          <WidgetInlineTitle
            value={widget.title}
            editable
            onChange={(next) => onTitleChange(widget.id, next)}
            titleStyle={titleStyle}
            testId={`widget-inline-title-${widget.id}`}
          />
          <span className="dashboard-no-drag hidden shrink-0 text-theme-xs tabular-nums text-gray-400 sm:inline">
            {sizeLabel}
          </span>
          {onDelete && showToolbarDelete ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              className="dashboard-no-drag size-7 shrink-0 text-gray-400 hover:text-error-600 dark:hover:text-error-400"
              aria-label="删除组件"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="size-3.5" />
            </IconButton>
          ) : null}
        </div>
      ) : readChartTitleVisible(resolvedWidget.chartConfig, dashboardStyle?.titleStyle) ? (
        <div className="relative z-[1] flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400">
            <Icon className="size-3.5" aria-hidden />
          </span>
          <h4
            className="min-w-0 flex-1 truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90"
            style={titleStyle}
          >
            {widget.title}
          </h4>
          <span className="shrink-0 text-theme-sm text-gray-400">{typeLabel}</span>
        </div>
      ) : null}
      {chartRemark.show ? (
        <p
          className={cn(
            "dw-hint relative z-[1] shrink-0 border-b border-gray-100 px-3 py-1.5 text-gray-500 dark:border-gray-800 dark:text-gray-400",
          )}
          data-testid={`grid-chart-remark-${widget.id}`}
        >
          {chartRemark.text}
        </p>
      ) : null}

      <div
        role={mode === "edit" ? "button" : undefined}
        tabIndex={mode === "edit" ? 0 : undefined}
        onClick={
          mode === "edit"
            ? (e) => {
                e.stopPropagation();
                onSelect?.(e);
              }
            : undefined
        }
        onKeyDown={
          mode === "edit"
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.({ shiftKey: e.shiftKey } as MouseEvent);
                }
              }
            : undefined
        }
        className={cn(
          "dashboard-no-drag flex min-h-0 flex-1 flex-col",
          mode === "edit" && "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02]",
        )}
      >
        {chartBody ? (
          <div
            className="relative flex min-h-0 flex-1 flex-col p-2"
            style={gridShellPresentation?.content.style}
          >
            {gridShellPresentation ? (
              <WidgetShellBackgroundLayers
                layers={gridShellPresentation.content}
                prefix={`grid-content-${widget.id}`}
              />
            ) : null}
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
              <WidgetShellLegendProvider>
                <WidgetChartLegendShell clipChart>
                  {chartBody}
                </WidgetChartLegendShell>
              </WidgetShellLegendProvider>
            </div>
            {gridShellPresentation ? (
              <WidgetShellFrameLayers
                layers={gridShellPresentation.content}
                prefix={`grid-content-${widget.id}`}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {gridShellPresentation ? (
        <WidgetShellFrameLayers
          layers={gridShellPresentation.shell}
          prefix={`grid-shell-${widget.id}`}
          zClassName="z-[3]"
        />
      ) : null}

      {onDelete && showToolbarDelete ? (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除组件</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除「{widget.title}」？删除后需保存布局才会生效。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(widget.id);
                  setConfirmOpen(false);
                }}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
