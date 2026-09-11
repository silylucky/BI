import type { PaletteDragPayload } from "@/lib/dashboardDnd";
import { findTabsHostAtPoint, getTopLevelPixelWidgets, type DashboardLayoutV2 } from "../layoutUtils";
import {
  allowsPixelWidgetOverlap,
  resolvePixelLayoutWithActiveRect,
  widgetRect,
  type CollisionLayoutOptions,
} from "./collisionLayout";
import {
  buildPaletteDropPreviewWidget,
  PALETTE_DROP_PREVIEW_WIDGET_ID,
  resolvePaletteDropPreviewRect,
} from "./createPixelWidget";
import type { PixelPoint, PixelRect } from "./geometry";

export type PaletteDropCollisionPreview = {
  positions: Map<string, PixelRect>;
  nextLayout: DashboardLayoutV2;
  previewRect: PixelRect;
};

/** 工具栏拖入时对标组件拖动：用幽灵块跑碰撞，推挤邻块预览 */
export function resolvePaletteDropCollisionPreview(
  layout: DashboardLayoutV2,
  point: PixelPoint,
  payload: PaletteDragPayload,
  options: CollisionLayoutOptions = {},
  tabDropBufferPx = 0,
): PaletteDropCollisionPreview | null {
  if (allowsPixelWidgetOverlap(layout)) return null;
  if (findTabsHostAtPoint(layout.widgets, point, tabDropBufferPx)) return null;

  const previewRect = resolvePaletteDropPreviewRect(point, payload, layout.canvas);
  const ghost = buildPaletteDropPreviewWidget(
    payload,
    previewRect,
    getTopLevelPixelWidgets(layout.widgets).length,
  );
  const layoutWithGhost: DashboardLayoutV2 = {
    ...layout,
    widgets: [...layout.widgets, ghost],
  };
  const nextLayout = resolvePixelLayoutWithActiveRect(
    layoutWithGhost,
    PALETTE_DROP_PREVIEW_WIDGET_ID,
    previewRect,
    options,
  );
  const positions = new Map(
    getTopLevelPixelWidgets(nextLayout.widgets)
      .filter((item) => item.id !== PALETTE_DROP_PREVIEW_WIDGET_ID)
      .map((item) => [item.id, widgetRect(item)] as const),
  );
  return { positions, nextLayout, previewRect };
}
