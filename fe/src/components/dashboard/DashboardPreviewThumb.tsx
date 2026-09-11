import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDataScreenLayout } from "@/lib/dataScreenLayout";
import { DashboardPreviewWidgetMock } from "./preview/DashboardPreviewWidgetMock";
import type { DashboardLayout, DashboardLayoutV2 } from "./layoutUtils";

/** 列表卡片预览区固定比例（与 Skeleton 一致，避免 canvas 动态高度牵动整行） */
export {
  DASHBOARD_LIST_CARD_ASPECT_RATIO,
  HUB_CARD_ASPECT_RATIO,
} from "@/components/dashboard/hubCardUi";

/** 独立缩略图容器纵横比：v2 跟随 canvas，v1 保持 16:10。列表卡片请用 DASHBOARD_LIST_CARD_ASPECT_RATIO。 */
export function dashboardPreviewAspectRatio(layoutJson?: DashboardLayout): string {
  if (layoutJson?.version === 2) {
    const { width, height } = layoutJson.canvas;
    return `${width} / ${height}`;
  }
  return "16 / 10";
}

function widgetChartType(widget: { chartConfig?: { chartType?: string } }): string | undefined {
  return widget.chartConfig?.chartType;
}

export function DashboardPreviewThumb({
  layoutJson,
  className,
  embedded = false,
  isDataScreen,
}: {
  layoutJson?: DashboardLayout;
  className?: string;
  /** 列表卡片等外层已设 aspect-ratio 时为 true */
  embedded?: boolean;
  /** 显式大屏样式；缺省时从 layoutJson.styleConfig 推断 */
  isDataScreen?: boolean;
}) {
  const screen = isDataScreen ?? isDataScreenLayout(layoutJson);
  const emptyBg = screen ? "bg-slate-950" : "bg-gray-50 dark:bg-gray-900/60";
  const canvasBg = screen
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
    : "bg-gradient-to-br from-gray-100 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900/80 dark:to-gray-950";

  if (!layoutJson || layoutJson.widgets.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center", emptyBg, className)}>
        <LayoutDashboard
          className={cn("size-10", screen ? "text-slate-600" : "text-gray-300 dark:text-gray-600")}
          aria-hidden
        />
      </div>
    );
  }

  if (layoutJson.version === 2) {
    const canvasLayout = layoutJson as DashboardLayoutV2;
    const widgets = [...canvasLayout.widgets].sort((a, b) => a.order - b.order);
    return (
      <div
        data-testid="dashboard-preview-thumb"
        className={cn("relative h-full overflow-hidden p-2", canvasBg, className)}
        style={embedded ? undefined : { aspectRatio: dashboardPreviewAspectRatio(canvasLayout) }}
      >
        <div className="relative h-full w-full">
          {widgets.slice(0, 12).map((widget) => (
            <div
              key={widget.id}
              data-testid={`dashboard-preview-widget-${widget.id}`}
              className="absolute"
              style={{
                left: `${(widget.x / canvasLayout.canvas.width) * 100}%`,
                top: `${(widget.y / canvasLayout.canvas.height) * 100}%`,
                width: `${(widget.width / canvasLayout.canvas.width) * 100}%`,
                height: `${(widget.height / canvasLayout.canvas.height) * 100}%`,
              }}
            >
              <DashboardPreviewWidgetMock
                id={widget.id}
                widgetType={widget.type}
                chartType={widgetChartType(widget)}
                title={widget.title}
                isDataScreen={screen}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const widgets = [...layoutJson.widgets].sort((a, b) => a.order - b.order);
  return (
    <div
      data-testid="dashboard-preview-thumb"
      className={cn("grid h-full auto-rows-[minmax(2.5rem,1fr)] grid-cols-12 gap-1.5 p-2", canvasBg, className)}
    >
      {widgets.slice(0, 8).map((widget) => (
        <div
          key={widget.id}
          data-testid={`dashboard-preview-widget-${widget.id}`}
          className="min-h-8"
          style={{
            gridColumn: `span ${Math.min(widget.colSpan ?? 6, 12)}`,
            gridRow: `span ${Math.min(widget.rowSpan ?? 2, 4)}`,
          }}
        >
          <DashboardPreviewWidgetMock
            id={widget.id}
            widgetType={widget.type}
            chartType={widgetChartType(widget)}
            title={widget.title}
            isDataScreen={screen}
          />
        </div>
      ))}
    </div>
  );
}
