import { useMemo } from "react";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardWidget } from "./DashboardWidget";
import {
  buildWidgetFilterParams,
  type ChartLinkageRuntime,
  type Linkage,
} from "./dashboardFilterUtils";
import { useChartLinkageState } from "./useChartLinkageState";
import { pixelWidgetToLayoutWidget, type DashboardWidgetShell } from "./dashboardCanvasMode";
import { PixelCanvas } from "./pixelCanvas";
import {
  canvasArtboardRepaintFingerprint,
  pickWidgetDashboardStyle,
  resolveArtboardStyle,
  widgetDashboardStyleFingerprint,
  type DashboardStyleConfig,
  type ScaleMode,
} from "./dashboardStyleConfig";
import {
  preparePixelLayoutForDisplay,
  resolveDashboardGapRuntimeFromLayout,
  resolveEffectiveDashboardStyle,
} from "./stylePipeline";
import { DashboardStyleSurface } from "./DashboardStyleSurface";
import { DashboardWidgetsProvider } from "./DashboardWidgetsContext";
import { widgetFilterExecuteRevision } from "./dashboardWidgetExecuteKey";
import { ChartDrillProvider } from "@/components/charts/ChartDrillContext";
import { drillStackRevision } from "@/components/charts/ChartDrillContext";
import { readChartDeStyle, readChartGeoStyle } from "@/lib/chartDeStyle";
import { isGeoMapChartType } from "@/lib/chartViewConfig";
import {
  ChartMountProvider,
  CHART_MOUNT_MAX_VIEW,
} from "@/components/charts/ChartMountContext";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { useVizComponentMap } from "@/hooks/useVizComponentMap";
import { resolveLayoutWidget, linkedComponentContentRevisionSuffix } from "@/lib/resolveVizComponent";
import { screenVisualContentRevisionSuffix } from "@/lib/screenVisualAssets";
import type { DashboardPreviewProfile } from "@/lib/dashboardPreviewProfile";
import { isCardPreviewProfile } from "@/lib/dashboardPreviewProfile";

type DashboardLayoutPreviewProps = {
  layout: DashboardLayout;
  /** 编辑态实时样式；缺省回退 layout.styleConfig（经 bootstrap 归一化） */
  styleConfig?: DashboardStyleConfig;
  linkage?: Linkage | null;
  filterValues?: Record<string, string>;
  chartLinkage?: ChartLinkageRuntime | null;
  onChartLinkageClick?: (
    widgetId: string,
    payload: { parameterKey: string; value: string },
  ) => void;
  onFilterValueChange?: (filterId: string, value: string) => void;
  scaleMode?: ScaleMode;
  /** 大屏投放：固定设计尺寸，由外层 CanvasScaleViewport 独占缩放 */
  fixedDesignViewport?: boolean;
  /** 大屏预览整页图表刷新计数 */
  globalChartRefreshKey?: number;
  className?: string;
  /** 列表卡片等密集场景：降低单卡图表并发挂载 */
  mountMaxConcurrent?: number;
  /** 3D 地图渲染分级 */
  geo3dRenderTier?: Geo3dRenderTier;
  /** 列表卡片等轻量真实预览档位 */
  previewProfile?: DashboardPreviewProfile;
};

export function DashboardLayoutPreview({
  layout,
  styleConfig: styleConfigOverride,
  linkage = null,
  filterValues = {},
  chartLinkage: chartLinkageProp,
  onChartLinkageClick: onChartLinkageClickProp,
  onFilterValueChange,
  scaleMode,
  fixedDesignViewport = false,
  globalChartRefreshKey = 0,
  className,
  mountMaxConcurrent = CHART_MOUNT_MAX_VIEW,
  geo3dRenderTier = "embed",
  previewProfile = "default",
}: DashboardLayoutPreviewProps) {
  const cardPreview = isCardPreviewProfile(previewProfile);
  const styleConfig = useMemo(
    () => resolveEffectiveDashboardStyle(layout, styleConfigOverride),
    [layout, styleConfigOverride],
  );
  const displayLayout = useMemo(
    () =>
      layout.version === 2
        ? preparePixelLayoutForDisplay(layout, styleConfig)
        : layout,
    [layout, styleConfig],
  );
  const widgetDashboardStyle = useMemo(
    () => pickWidgetDashboardStyle(styleConfig),
    [widgetDashboardStyleFingerprint(styleConfig)],
  );
  const widgets =
    displayLayout.version === 1
      ? displayLayout.widgets
      : displayLayout.widgets.map(pixelWidgetToLayoutWidget);
  const internalLinkage = useChartLinkageState(widgets);
  const chartLinkage: ChartLinkageRuntime | null =
    chartLinkageProp !== undefined ? chartLinkageProp : internalLinkage.chartLinkageRuntime;
  const onChartLinkageClick =
    onChartLinkageClickProp ?? internalLinkage.handleChartLinkageClick;
  const { componentMap, isLoading: componentsLoading } = useVizComponentMap(widgets);
  const styleRevision = widgetDashboardStyleFingerprint(styleConfig);
  const artboardStyleKey = canvasArtboardRepaintFingerprint(styleConfig);
  const effectiveLinkage: Linkage = linkage ?? {
    filters: [],
    linkageRules: [],
  };

  const renderWidget = (
    widget: LayoutWidget,
    grid?: { w: number; h: number },
    shell: DashboardWidgetShell = "grid",
  ) => {
    const displayWidget = componentMap ? resolveLayoutWidget(widget, componentMap) : widget;
    const renderNested = (child: LayoutWidget) =>
      renderWidget(child, { w: child.colSpan, h: child.rowSpan }, "shape");
    return (
      <WidgetErrorBoundary widgetTitle={displayWidget.title}>
        <DashboardWidget
          widget={displayWidget}
          mode="view"
          shell={shell}
          gridSize={grid}
          allWidgets={displayWidget.type === "tabs" ? widgets : undefined}
          renderNestedWidget={renderNested}
          filterParameters={
            displayWidget.type === "chart"
              ? buildWidgetFilterParams(
                  displayWidget.id,
                  effectiveLinkage,
                  filterValues,
                  chartLinkage,
                )
              : undefined
          }
          executeKey={widgetFilterExecuteRevision(
            displayWidget.id,
            effectiveLinkage,
            filterValues,
            undefined,
            globalChartRefreshKey,
            chartLinkage,
          )}
          filterValue={
            displayWidget.filterConfig
              ? filterValues[displayWidget.filterConfig.filterId]
              : undefined
          }
          onFilterValueChange={onFilterValueChange}
          onChartLinkageClick={
            cardPreview
              ? undefined
              : onChartLinkageClick
                ? (payload) => onChartLinkageClick(displayWidget.id, payload)
                : undefined
          }
          onTitleChange={() => {}}
          dashboardStyle={widgetDashboardStyle}
          geo3dRenderTier={geo3dRenderTier}
          previewProfile={previewProfile}
          componentMap={componentMap}
          componentsLoading={componentsLoading}
        />
      </WidgetErrorBoundary>
    );
  };

  if (displayLayout.version === 2) {
    const widgetContentRevision = (widget: PixelLayoutWidget) => {
      const base = widgetFilterExecuteRevision(
        widget.id,
        effectiveLinkage,
        filterValues,
        undefined,
        globalChartRefreshKey,
        chartLinkage,
      );
      const layoutWidget = pixelWidgetToLayoutWidget(widget);
      const linkedRev = linkedComponentContentRevisionSuffix(
        layoutWidget,
        componentMap,
        componentsLoading,
      );
      if (linkedRev) return `${base}${linkedRev}`;
      const screenVisualRev = screenVisualContentRevisionSuffix(layoutWidget);
      if (screenVisualRev) return `${base}${screenVisualRev}`;
      if (
        layoutWidget.type === "chart" &&
        layoutWidget.chartConfig &&
        isGeoMapChartType(layoutWidget.chartConfig.chartType)
      ) {
        const manualStack =
          readChartGeoStyle(readChartDeStyle(layoutWidget.chartConfig)).manualDrillStack ?? [];
        const drillRev = drillStackRevision(manualStack);
        if (drillRev) return `${base}:geo-drill:${drillRev}`;
      }
      return base;
    };

    return (
      <ChartMountProvider maxConcurrent={mountMaxConcurrent}>
      <DashboardWidgetsProvider widgets={widgets}>
      <ChartDrillProvider>
      <DashboardStyleSurface
        styleConfig={styleConfig}
        componentGapPx={resolveDashboardGapRuntimeFromLayout(displayLayout, styleConfigOverride).shellPaddingPx}
        className={className}
      >
        <PixelCanvas
          mode="view"
          layout={displayLayout}
          styleConfig={styleConfig}
          scaleMode={fixedDesignViewport ? "canvas" : (scaleMode ?? "canvas")}
          designViewportLocked={fixedDesignViewport}
          className="h-full min-h-0"
          renderWidget={(widget: PixelLayoutWidget) =>
            renderWidget(pixelWidgetToLayoutWidget(widget), undefined, "shape")
          }
          widgetContentRevision={widgetContentRevision}
        />
      </DashboardStyleSurface>
      </ChartDrillProvider>
      </DashboardWidgetsProvider>
      </ChartMountProvider>
    );
  }

  return (
    <ChartMountProvider maxConcurrent={mountMaxConcurrent}>
    <DashboardWidgetsProvider widgets={widgets}>
    <ChartDrillProvider>
    <DashboardStyleSurface
      styleConfig={styleConfig}
      componentGapPx={resolveDashboardGapRuntimeFromLayout(layout, styleConfigOverride).shellPaddingPx}
      className={className}
    >
      <div className="relative h-full min-h-0">
        <div
          key={artboardStyleKey}
          data-testid="dashboard-canvas-backdrop"
          className="pointer-events-none absolute inset-0 z-0"
          style={resolveArtboardStyle(styleConfig)}
          aria-hidden
        />
        <DashboardGrid
          mode="view"
          widgets={layout.widgets}
          styleConfig={styleConfig}
          className="relative z-[1] h-full min-h-0"
          renderWidget={renderWidget}
        />
      </div>
    </DashboardStyleSurface>
    </ChartDrillProvider>
    </DashboardWidgetsProvider>
    </ChartMountProvider>
  );
}
