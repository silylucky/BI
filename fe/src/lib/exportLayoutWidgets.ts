import type {
  DashboardLayout,
  LayoutWidget,
  PixelLayoutWidget,
} from "@/components/dashboard/layoutUtils";
import { getTopLevelWidgets } from "@/components/dashboard/layoutUtils";
import { pixelWidgetToLayoutWidget } from "@/components/dashboard/dashboardCanvasMode";

const ENLARGED_GRID_ROW_SPAN = 16;
const ENLARGED_PIXEL_MIN_HEIGHT = 880;

export function listExportWidgets(layout: DashboardLayout): LayoutWidget[] {
  if (layout.version === 2) {
    return layout.widgets.map((widget) => pixelWidgetToLayoutWidget(widget));
  }
  return getTopLevelWidgets(layout.widgets);
}

export function widgetDisplayTitle(widget: LayoutWidget): string {
  const title = widget.title?.trim();
  if (title) return title;
  if (widget.type === "chart") return "图表";
  if (widget.type === "filter") return "筛选器";
  if (widget.type === "text") return "文本";
  if (widget.type === "tabs") return "标签页";
  return widget.type;
}

export function layoutWithSingleWidget(
  layout: DashboardLayout,
  widget: LayoutWidget,
): DashboardLayout {
  if (layout.version === 2) {
    const pixel = layout.widgets.find((item) => item.id === widget.id);
    return pixel ? { ...layout, widgets: [pixel] } : { ...layout, widgets: [] };
  }
  return { ...layout, widgets: [widget] };
}

function enlargedPixelWidget(pixel: PixelLayoutWidget, canvasWidth: number): PixelLayoutWidget {
  const height = Math.max(ENLARGED_PIXEL_MIN_HEIGHT, Math.round(canvasWidth * 0.62));
  return {
    ...pixel,
    x: 0,
    y: 0,
    width: canvasWidth,
    height,
  };
}

/** 单组件放大布局：占满画布宽度与高度，便于阅读图表数据。 */
export function layoutWithEnlargedWidget(
  layout: DashboardLayout,
  widget: LayoutWidget,
): DashboardLayout {
  if (layout.version === 2) {
    const pixel = layout.widgets.find((item) => item.id === widget.id);
    if (!pixel) return { ...layout, widgets: [] };
    const canvasWidth = layout.canvas?.width ?? 1440;
    const enlarged = enlargedPixelWidget(pixel, canvasWidth);
    return {
      ...layout,
      canvas: { width: canvasWidth, height: enlarged.height },
      widgets: [enlarged],
    };
  }
  return {
    ...layout,
    widgets: [{
      ...widget,
      gridX: 0,
      gridY: 0,
      colSpan: 12,
      rowSpan: ENLARGED_GRID_ROW_SPAN,
    }],
  };
}
