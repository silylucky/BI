import type { PixelRect } from "./geometry";

export type PixelShapePreviewSync = (rect: PixelRect) => void;

export type PixelShapePreviewApplyOptions = {
  /** 交互中的组件由 applyDisplay 驱动，禁止节流预览回写造成尺寸回弹 */
  skipWidgetIds?: ReadonlySet<string> | string;
};

function shouldSkipPreviewWidget(
  widgetId: string,
  options?: PixelShapePreviewApplyOptions,
): boolean {
  const skip = options?.skipWidgetIds;
  if (!skip) return false;
  if (typeof skip === "string") return skip === widgetId;
  return skip.has(widgetId);
}

export function createPixelShapePreviewRegistry() {
  const syncById = new Map<string, PixelShapePreviewSync>();

  return {
    register(widgetId: string, sync: PixelShapePreviewSync) {
      syncById.set(widgetId, sync);
      return () => {
        syncById.delete(widgetId);
      };
    },
    applyAll(positions: Map<string, PixelRect>, options?: PixelShapePreviewApplyOptions) {
      for (const [widgetId, rect] of positions) {
        if (shouldSkipPreviewWidget(widgetId, options)) continue;
        syncById.get(widgetId)?.(rect);
      }
    },
    applyOne(widgetId: string, rect: PixelRect) {
      syncById.get(widgetId)?.(rect);
    },
    reset(
      widgets: Array<{ id: string } & PixelRect>,
      options?: PixelShapePreviewApplyOptions,
    ) {
      for (const widget of widgets) {
        if (shouldSkipPreviewWidget(widget.id, options)) continue;
        const { id, x, y, width, height } = widget;
        syncById.get(id)?.({ x, y, width, height });
      }
    },
  };
}
