import type { ReactNode } from "react";
import {
  mergeChartTitleStyle,
  mergeShapeInnerPresentation,
  readChartRemark,
  readChartTitleVisible,
  resolveChartContentShellStyle,
} from "@/lib/chartDeStyle";
import { resolveWidgetEffectiveScheme } from "@/lib/chartSurfaceTheme";
import { cn } from "@/lib/utils";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import {
  WidgetShellBackgroundLayers,
  WidgetShellFrameLayers,
} from "@/components/dashboard/WidgetShellPresentationLayers";
import { gridWidgetShellClassName } from "@/components/dashboard/widgetRailStyleSections";
import { widgetChartIcon, WIDGET_CHART_LABELS } from "@/components/dashboard/widgetIcons";

type VizComponentChartPreviewShellProps = {
  widget: LayoutWidget & { chartConfig: ChartViewConfig };
  children: ReactNode;
  /** 列表卡片缩略图：隐藏组件内标题栏，避免与卡片正文重复 */
  compact?: boolean;
  /** 编辑预览：内容区贴边，避免 p-2 挤压图表可视区域 */
  flushContent?: boolean;
};

/** 组件库编辑预览：栅格看板 view 态外壳（含装饰边框 overlay），与 DashboardWidget 一致 */
export function VizComponentChartPreviewShell({
  widget,
  children,
  compact = false,
  flushContent = false,
}: VizComponentChartPreviewShellProps) {
  const chartConfig = widget.chartConfig;
  const scheme = resolveWidgetEffectiveScheme(undefined);
  const shellResolved = resolveChartContentShellStyle(undefined, chartConfig, scheme);
  const { shell, content } = mergeShapeInnerPresentation({
    outer: shellResolved.outer,
    inner: shellResolved.inner,
    innerBackgroundLayer: shellResolved.innerBackgroundLayer,
    innerFrameLayer: shellResolved.innerFrameLayer,
  });
  const titleVisible = readChartTitleVisible(chartConfig, undefined);
  const titleStyle = mergeChartTitleStyle(undefined, chartConfig, scheme);
  const chartRemark = readChartRemark(chartConfig);
  const chartType = chartConfig.chartType;
  const Icon = widgetChartIcon(chartType);
  const typeLabel = WIDGET_CHART_LABELS[chartType] ?? chartType;
  const shellStyle = compact
    ? {
        ...shell.style,
        borderWidth: 0,
        borderStyle: "none",
        borderColor: "transparent",
        backgroundColor: "transparent",
        boxShadow: "none",
      }
    : shell.style;

  return (
    <div
      className={cn(
        gridWidgetShellClassName(!compact, false),
        !compact && "relative dark:bg-white/[0.03]",
      )}
      style={shellStyle}
      data-testid="viz-component-chart-shell"
    >
      {!compact ? <WidgetShellBackgroundLayers layers={shell} prefix="viz-chart-shell" /> : null}
      {!compact && titleVisible ? (
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
      {!compact && chartRemark.show ? (
        <p
          className="dw-hint relative z-[1] shrink-0 border-b border-gray-100 px-3 py-1.5 text-gray-500 dark:border-gray-800 dark:text-gray-400"
          data-testid={`viz-preview-chart-remark-${widget.id}`}
        >
          {chartRemark.text}
        </p>
      ) : null}
      <div
        className={cn(
          "relative z-[1] flex min-h-0 flex-1 flex-col",
          !compact && !flushContent && "p-2",
        )}
        style={content.style}
      >
        <WidgetShellBackgroundLayers layers={content} prefix="viz-chart-content" />
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
        <WidgetShellFrameLayers layers={content} prefix="viz-chart-content" />
      </div>
      {!compact ? (
        <WidgetShellFrameLayers layers={shell} prefix="viz-chart-shell" zClassName="z-[3]" />
      ) : null}
    </div>
  );
}
