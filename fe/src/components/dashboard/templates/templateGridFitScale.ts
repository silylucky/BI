import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { getTopLevelWidgets } from "@/components/dashboard/layoutUtils";
import { GRID_ROW_HEIGHT } from "@/components/dashboard/gridLayoutAdapter";

/** 估算 v1 栅格画布自然高度（px），供初始 scale 与单测 */
export function estimateV1GridCanvasHeight(widgets: LayoutWidget[]): number {
  const topLevel = getTopLevelWidgets(widgets);
  if (topLevel.length === 0) return 120;

  let maxBottom = 0;
  for (const widget of topLevel) {
    const y = widget.gridY ?? 0;
    const h = widget.rowSpan ?? 2;
    maxBottom = Math.max(maxBottom, y + h);
  }
  if (maxBottom <= 0) return 120;
  return maxBottom * GRID_ROW_HEIGHT;
}

export type TemplateGridFitMode = "card" | "dialog";

type ResolveTemplateGridFitScaleOptions = {
  mode?: TemplateGridFitMode;
  maxScale?: number;
  availableWidth?: number;
  contentWidth?: number;
};

export function resolveTemplateGridFitScale(
  availableHeight: number,
  contentHeight: number,
  options: ResolveTemplateGridFitScaleOptions = {},
): number {
  const { mode = "card", maxScale = 1.75, availableWidth, contentWidth } = options;
  if (availableHeight <= 0 || contentHeight <= 0) return 1;

  let scale = availableHeight / contentHeight;
  if (
    availableWidth != null &&
    availableWidth > 0 &&
    contentWidth != null &&
    contentWidth > 0
  ) {
    scale = Math.min(scale, availableWidth / contentWidth);
  }

  if (mode === "dialog") {
    return Math.min(maxScale, Math.max(0.65, scale));
  }
  return Math.min(1, scale);
}
