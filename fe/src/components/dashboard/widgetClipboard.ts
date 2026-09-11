import type { LayoutWidget, PixelLayoutWidget } from "./layoutUtils";

export type WidgetClipboardEntry = {
  widget: LayoutWidget;
  sourcePixel?: PixelLayoutWidget;
};
