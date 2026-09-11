import { useEffect, useRef } from "react";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { ChartDrillProvider } from "@/components/charts/ChartDrillContext";
import { WidgetChartLegendShell } from "@/components/charts/WidgetChartLegendShell";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { FilterWidget } from "@/components/dashboard/FilterWidget";
import { TextWidget } from "@/components/dashboard/TextWidget";
import { MediaWidget } from "@/components/dashboard/MediaWidget";
import { CustomVizWidget } from "@/components/dashboard/CustomVizWidget";
import type { DashboardStyleConfig, LayoutWidget } from "@/components/dashboard/layoutUtils";
import { WidgetShellLegendProvider } from "@/components/dashboard/pixelCanvas/widgetShellLegendContext";
import { VizComponentChartPreviewShell } from "@/components/dashboard/viz-components/VizComponentChartPreviewShell";
import type { Geo3dRenderTier } from "@/components/charts/engine/three/geo3dRuntime";
import { useElementSize } from "@/hooks/useElementSize";
import { useInViewport } from "@/hooks/useInViewport";
import { useAdminHeavyRenderSuspended } from "@/hooks/useAdminHeavyRenderSuspended";
import { isGeoMapChartType, type ChartViewConfig } from "@/lib/chartViewConfig";
import { cn } from "@/lib/utils";
import { VIZ_COMPONENT_THUMBNAIL_CAPTURE_ATTR } from "@/lib/captureDashboardThumbnail";
import type { DashboardPreviewProfile } from "@/lib/dashboardPreviewProfile";

type VizComponentLivePreviewProps = {
  widget: LayoutWidget;
  /** 组件库编辑预览：customViz 六块/配色继承默认看板主题 */
  dashboardStyle?: DashboardStyleConfig;
  className?: string;
  /** 列表卡片等场景：进视口后再挂载图表 */
  lazy?: boolean;
  /** 弹层打开等场景：暂停 live 查数/渲染，避免 blur 叠多层 canvas 卡死 */
  paused?: boolean;
  geo3dRenderTier?: Geo3dRenderTier;
  /** 列表卡片缩略图：隐藏组件内标题栏 */
  compact?: boolean;
  /** Hub 卡片轻量预览：隐藏 shell 图例/标签等，与看板列表卡片一致 */
  previewProfile?: DashboardPreviewProfile;
  /** 地图下钻栈持久化（编辑页同步 manualDrillStack） */
  onChartConfigChange?: (cfg: ChartViewConfig) => void;
};

export function VizComponentLivePreview({
  widget,
  dashboardStyle,
  className,
  lazy = false,
  paused = false,
  geo3dRenderTier,
  compact = false,
  previewProfile,
  onChartConfigChange,
}: VizComponentLivePreviewProps) {
  const navSuspended = useAdminHeavyRenderSuspended();
  const effectivePreviewProfile: DashboardPreviewProfile =
    previewProfile ?? (compact ? "card" : "default");
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: viewRef, inView } = useInViewport<HTMLDivElement>({
    enabled: lazy && !navSuspended && !paused,
    rootMargin: "80px",
  });
  const { ref: sizeRef, size } = useElementSize<HTMLDivElement>();
  const active = !navSuspended && !paused && (!lazy || inView);

  const setContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node;
    viewRef(node);
    sizeRef(node);
  };

  useEffect(() => {
    if (!active) return undefined;
    setChartAnimationSuppressed(true);
    return () => setChartAnimationSuppressed(false);
  }, [active]);

  const chartWidth = Math.max(size.width, 120);
  const chartHeight = Math.max(size.height, 96);
  const isEditPreview = !compact && !lazy;
  const chartConfig = widget.type === "chart" ? widget.chartConfig : undefined;
  const drillEnabled = Boolean(chartConfig && isGeoMapChartType(chartConfig.chartType));

  return (
    <div
      ref={setContainerRef}
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col",
        isEditPreview && "flex-1",
        className,
      )}
      data-testid="viz-component-live-preview"
      data-live={active ? "true" : "false"}
      {...(isEditPreview ? { [VIZ_COMPONENT_THUMBNAIL_CAPTURE_ATTR]: "" } : {})}
    >
      {widget.type === "chart" && widget.chartConfig ? (
        <VizComponentChartPreviewShell
          widget={widget as LayoutWidget & { chartConfig: NonNullable<typeof widget.chartConfig> }}
          compact={compact}
          flushContent={isEditPreview}
        >
          {(() => {
            const chartNode = (
              <ChartDrillProvider>
                <ChartRenderer
                  embedded
                  config={widget.chartConfig}
                  title={widget.title}
                  widgetId={widget.id}
                  drillEnabled={drillEnabled}
                  queryEnabled={active}
                  renderEnabled={active}
                  dashboardEditMode
                  pixelSize={{ width: chartWidth, height: chartHeight }}
                  geo3dRenderTier={geo3dRenderTier}
                  previewProfile={effectivePreviewProfile}
                  onChartConfigChange={onChartConfigChange}
                />
              </ChartDrillProvider>
            );
            if (effectivePreviewProfile === "card") return chartNode;
            return (
              <WidgetShellLegendProvider>
                <WidgetChartLegendShell clipChart>
                  {chartNode}
                </WidgetChartLegendShell>
              </WidgetShellLegendProvider>
            );
          })()}
        </VizComponentChartPreviewShell>
      ) : null}
      {widget.type === "filter" && widget.filterConfig ? (
        <FilterWidget
          widget={widget as LayoutWidget & { filterConfig: NonNullable<typeof widget.filterConfig> }}
          mode="view"
          shell={compact ? "shape" : "grid"}
          value={widget.filterConfig.defaultValue ?? ""}
          onValueChange={() => undefined}
        />
      ) : null}
      {widget.type === "text" && widget.textConfig ? (
        <TextWidget
          widget={widget as LayoutWidget & { textConfig: NonNullable<typeof widget.textConfig> }}
          mode="view"
          shell={compact ? "shape" : "grid"}
        />
      ) : null}
      {widget.type === "media" && widget.mediaConfig ? (
        <MediaWidget
          widget={widget as LayoutWidget & { mediaConfig: NonNullable<typeof widget.mediaConfig> }}
          mode="view"
          shell={compact ? "shape" : "grid"}
        />
      ) : null}
      {widget.type === "customViz" && widget.customVizConfig && active ? (
        <CustomVizWidget
          widget={widget as LayoutWidget & { customVizConfig: NonNullable<typeof widget.customVizConfig> }}
          mode="view"
          shell={compact ? "shape" : "grid"}
          dashboardStyle={dashboardStyle}
        />
      ) : null}
    </div>
  );
}
