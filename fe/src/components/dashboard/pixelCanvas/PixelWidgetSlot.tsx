import { memo, type ReactNode } from "react";
import type { PixelLayoutWidget } from "../layoutUtils";

type PixelWidgetSlotProps = {
  widget: PixelLayoutWidget;
  renderWidget: (widget: PixelLayoutWidget) => ReactNode;
  contentRevision: string;
};

/** 位置 (x,y) 变化不触发子树重渲染，减轻拖拽/推挤预览时图表重绘 */
function widgetBodyEqual(prev: PixelLayoutWidget, next: PixelLayoutWidget): boolean {
  if (prev.id !== next.id || prev.type !== next.type || prev.title !== next.title) {
    return false;
  }
  if (prev.width !== next.width || prev.height !== next.height || prev.order !== next.order) {
    return false;
  }
  if (prev.hidden !== next.hidden || prev.locked !== next.locked) return false;
  if (prev.chartConfig !== next.chartConfig) return false;
  if (prev.textConfig !== next.textConfig) return false;
  if (prev.tabsConfig !== next.tabsConfig) return false;
  if (prev.filterConfig !== next.filterConfig) return false;
  if (prev.mediaConfig !== next.mediaConfig) return false;
  if (prev.customVizConfig !== next.customVizConfig) return false;
  return true;
}

export const PixelWidgetSlot = memo(function PixelWidgetSlot({
  widget,
  renderWidget,
}: PixelWidgetSlotProps) {
  return <>{renderWidget(widget)}</>;
}, (prev, next) =>
  prev.contentRevision === next.contentRevision &&
  widgetBodyEqual(prev.widget, next.widget));
