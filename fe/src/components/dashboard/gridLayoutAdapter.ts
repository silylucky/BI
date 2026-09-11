import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import type { LayoutWidget } from "./layoutUtils";
import { sortWidgets } from "./layoutUtils";
import { GRID_COLS, findFirstFreeSlot, layoutItemsCollide } from "./gridSnapUtils";

/** 行高（px）；较小步进便于纵向无极微调 */
export const GRID_ROW_HEIGHT = 32;
export const GRID_MARGIN_Y = 12;
const MIN_CHART_ROWS = 2;
/** Must stay aligned with backend LayoutWidget.rowSpan <= 24. */
export const MAX_CHART_ROWS = 24;

/** 栅格行数 → 像素高度（含行间距） */
export function gridSpanToPixelHeight(rowSpan: number): number {
  const rows = Math.max(1, Math.round(rowSpan));
  return rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_MARGIN_Y;
}

/** widget 标题栏 + 内边距占用（px） */
export const WIDGET_BODY_CHROME_PX = 60;

export function estimateWidgetBodyHeight(rowSpan: number): number {
  return Math.max(48, gridSpanToPixelHeight(rowSpan) - WIDGET_BODY_CHROME_PX);
}

function clampColSpan(w: number): number {
  return Math.min(12, Math.max(1, Math.round(w)));
}

function clampRowSpan(h: number): number {
  return Math.min(MAX_CHART_ROWS, Math.max(MIN_CHART_ROWS, Math.round(h)));
}

function itemsCollide(
  a: Pick<LayoutItem, "x" | "y" | "w" | "h">,
  b: Pick<LayoutItem, "x" | "y" | "w" | "h">,
): boolean {
  return layoutItemsCollide(a, b);
}

function layoutHasOverlap(layout: LayoutItem[]): boolean {
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      if (itemsCollide(layout[i], layout[j])) return true;
    }
  }
  return false;
}

function gridItemFromWidget(w: LayoutWidget): LayoutItem {
  return {
    i: w.id,
    x: w.gridX ?? 0,
    y: w.gridY ?? 0,
    w: clampColSpan(w.colSpan),
    h: clampRowSpan(w.rowSpan),
    minW: 1,
    maxW: 12,
    minH: MIN_CHART_ROWS,
    maxH: MAX_CHART_ROWS,
  };
}

function packFlowLayout(widgets: LayoutWidget[]): LayoutItem[] {
  const sorted = sortWidgets(widgets);
  let x = 0;
  let y = 0;
  let rowMaxH = 0;
  const out: LayoutItem[] = [];
  for (const w of sorted) {
    const span = clampColSpan(w.colSpan);
    const h = clampRowSpan(w.rowSpan);
    if (x + span > 12) {
      x = 0;
      y += rowMaxH;
      rowMaxH = 0;
    }
    out.push({
      i: w.id,
      x,
      y,
      w: span,
      h,
      minW: 1,
      maxW: 12,
      minH: MIN_CHART_ROWS,
      maxH: MAX_CHART_ROWS,
    });
    x += span;
    rowMaxH = Math.max(rowMaxH, h);
    if (x >= 12) {
      x = 0;
      y += rowMaxH;
      rowMaxH = 0;
    }
  }
  return out;
}

export function widgetsToGridLayout(widgets: LayoutWidget[]): Layout {
  const sorted = sortWidgets(widgets);
  if (!sorted.length) return [];

  const allPositioned = sorted.every((w) => w.gridX != null && w.gridY != null);
  if (allPositioned) {
    const items = sorted.map((w) => ({
      ...gridItemFromWidget(w),
      x: w.gridX!,
      y: w.gridY!,
    }));
    if (!layoutHasOverlap(items)) return items;
  }
  return packFlowLayout(sorted);
}

export function gridLayoutToWidgets(layout: Layout, widgets: LayoutWidget[]): LayoutWidget[] {
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  return sorted.map((item, order) => {
    const base = byId.get(item.i);
    if (!base) throw new Error(`Unknown widget ${item.i}`);
    return {
      ...base,
      colSpan: clampColSpan(item.w),
      rowSpan: clampRowSpan(item.h),
      gridX: item.x,
      gridY: item.y,
      order,
    };
  });
}

/** 修复重叠/缺坐标的历史布局 */
export function normalizeWidgetLayout(widgets: LayoutWidget[]): LayoutWidget[] {
  if (!widgets.length) return widgets;
  return gridLayoutToWidgets(widgetsToGridLayout(widgets), widgets);
}

/** 为新组件计算第一个可用空位（同行优先，对标 DataEase 流式排布） */
export function placeNewWidget(widgets: LayoutWidget[], widget: LayoutWidget): LayoutWidget {
  const w = clampColSpan(widget.colSpan);
  const h = clampRowSpan(widget.rowSpan);
  const layout = widgetsToGridLayout(widgets);
  const { x, y } = findFirstFreeSlot(layout, w, h);
  return {
    ...widget,
    colSpan: w,
    rowSpan: h,
    gridX: x,
    gridY: y,
  };
}

export function placeWidgetExact(
  widget: LayoutWidget,
  at: { gridX: number; gridY: number; colSpan: number; rowSpan: number },
): LayoutWidget {
  return {
    ...widget,
    gridX: Math.max(0, Math.round(at.gridX)),
    gridY: Math.max(0, Math.round(at.gridY)),
    colSpan: clampColSpan(at.colSpan),
    rowSpan: clampRowSpan(at.rowSpan),
  };
}

/** 调色板点击（非拖放）：水平居中栅格，纵向从首行起找空位 */
export function placeWidgetAtGridCenter(
  widgets: LayoutWidget[],
  widget: LayoutWidget,
): LayoutWidget {
  const w = clampColSpan(widget.colSpan);
  const centerX = Math.floor((GRID_COLS - w) / 2);
  return placeWidgetAt(widgets, widget, centerX, 0);
}

/** 拖放落点：优先使用指针位置，冲突时向下顺延 */
export function placeWidgetAt(
  widgets: LayoutWidget[],
  widget: LayoutWidget,
  preferredX: number,
  preferredY: number,
): LayoutWidget {
  const w = clampColSpan(widget.colSpan);
  const h = clampRowSpan(widget.rowSpan);
  const layout = widgetsToGridLayout(widgets);
  const prefX = Math.min(GRID_COLS - w, Math.max(0, Math.round(preferredX)));
  const prefY = Math.max(0, Math.round(preferredY));
  const { x, y } = findFirstFreeSlot(layout, w, h, { x: prefX, y: prefY });

  return {
    ...widget,
    colSpan: w,
    rowSpan: h,
    gridX: x,
    gridY: y,
  };
}
