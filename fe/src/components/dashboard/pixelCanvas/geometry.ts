export type PixelPoint = { x: number; y: number };
export type PixelRect = PixelPoint & { width: number; height: number };
export type PixelCanvasBounds = { width: number; height: number };
export type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export type PixelInteractionKind = "move" | ResizeDirection;

export const RESIZE_DIRECTIONS: ResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

export const RESIZE_LABELS: Record<ResizeDirection, string> = {
  n: "上",
  ne: "右上",
  e: "右",
  se: "右下",
  s: "下",
  sw: "左下",
  w: "左",
  nw: "左上",
};

export const RESIZE_CURSORS: Record<ResizeDirection, string> = {
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  nw: "nwse-resize",
};

const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundedRect(x: number, y: number, width: number, height: number): PixelRect {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** 将组件矩形收进画布：先缩尺寸再平移，避免缩小画布后越界 */
export function clampPixelRectToCanvas(
  rect: PixelRect,
  canvas: PixelCanvasBounds,
): PixelRect {
  const safeW = Math.max(1, canvas.width);
  const safeH = Math.max(1, canvas.height);
  let { x, y, width, height } = rect;

  width = Math.min(width, safeW);
  height = Math.min(height, safeH);
  width = Math.max(width, Math.min(MIN_WIDTH, safeW));
  height = Math.max(height, Math.min(MIN_HEIGHT, safeH));

  x = clamp(x, 0, Math.max(0, safeW - width));
  y = clamp(y, 0, Math.max(0, safeH - height));

  return roundedRect(x, y, width, height);
}

export function screenDeltaToCanvas(delta: PixelPoint, scale: number): PixelPoint {
  const safeScale = scale > 0 ? scale : 1;
  return {
    x: delta.x / safeScale,
    y: delta.y / safeScale,
  };
}

export type ScaledCanvasMetrics = {
  scale: number;
  contentWidth: number;
  contentHeight: number;
  /** Stage `left` inside pixel-canvas-content */
  stageLeft: number;
  /** Center content block when letterboxed (component scale mode) */
  centerContent: boolean;
  /** 缩放触底后内容宽于宿主，需横向滚动 */
  scrollX: boolean;
};

/** DE 画板规范高度；缩放比例按设计尺寸而非内容撑开后的高度 */
export const CANVAS_SCALE_DESIGN_HEIGHT = 900;

/** 编辑态画布最小缩放，避免窄栏挤压时组件标题/操作条与图表严重叠压 */
export const PIXEL_CANVAS_EDIT_MIN_SCALE = 0.5;

const SCALE_HEIGHT_FLOOR = 320;

/** 对标 DE `canvasStyleData.height`：碰撞撑高后的 canvas.height 不参与缩放分母 */
export function resolveScaleDesignHeight(canvasHeight: number): number {
  return Math.max(SCALE_HEIGHT_FLOOR, Math.min(canvasHeight, CANVAS_SCALE_DESIGN_HEIGHT));
}

/** 吸收亚像素缝；canvas 模式贴满可用宽，component 模式在误差内贴满 */
export function snapScaledContentWidth(
  scaledWidth: number,
  availableWidth: number,
  scaleMode: "canvas" | "component",
): number {
  const safeAvailable = Math.max(0, availableWidth);
  if (scaleMode === "canvas") {
    return Math.round(safeAvailable);
  }
  const gap = safeAvailable - scaledWidth;
  if (gap >= 0 && gap < 2) {
    return Math.round(safeAvailable);
  }
  return Math.min(Math.ceil(scaledWidth), Math.round(safeAvailable));
}

export function scaledCanvasMetrics(
  hostWidth: number,
  hostHeight: number,
  canvasWidth: number,
  designCanvasHeight: number,
  contentCanvasHeight: number,
  gutter = 0,
  scaleMode: "canvas" | "component" = "canvas",
  minScale = 0,
): ScaledCanvasMetrics {
  const availableWidth = Math.max(0, hostWidth - gutter);
  const availableHeight = Math.max(0, hostHeight);
  const safeCanvasWidth = canvasWidth > 0 ? canvasWidth : 1;
  const safeDesignHeight = designCanvasHeight > 0 ? designCanvasHeight : 1;
  const safeContentHeight = Math.max(contentCanvasHeight, safeDesignHeight);
  const scaleX = availableWidth / safeCanvasWidth;
  const scaleY = availableHeight / safeDesignHeight;
  const rawScale = scaleMode === "component" ? Math.min(scaleX, scaleY) : scaleX;
  const scale =
    minScale > 0 && rawScale < minScale ? minScale : rawScale;
  const scrollX = scaleMode === "canvas" && minScale > 0 && rawScale < minScale;
  const scaledWidth = safeCanvasWidth * scale;
  const scaledContentHeight = safeContentHeight * scale;
  const contentWidth = scrollX
    ? Math.ceil(scaledWidth)
    : snapScaledContentWidth(scaledWidth, availableWidth, scaleMode);

  if (scaleMode === "component") {
    return {
      scale,
      contentWidth,
      contentHeight: Math.ceil(scaledContentHeight),
      stageLeft: 0,
      centerContent: contentWidth < availableWidth - 0.5,
      scrollX: false,
    };
  }

  const contentHeight =
    scaledContentHeight <= availableHeight + 0.5 ? availableHeight : Math.ceil(scaledContentHeight);
  return {
    scale,
    contentWidth: gutter + contentWidth,
    contentHeight,
    stageLeft: gutter,
    centerContent: false,
    scrollX,
  };
}

export function resolvePixelCanvasMeasureElement(host: HTMLElement): HTMLElement {
  let pixelHost: HTMLElement | null = host;
  while (pixelHost) {
    if (pixelHost.classList.contains("pixel-canvas-host")) {
      return pixelHost;
    }
    pixelHost = pixelHost.parentElement;
  }
  let node: HTMLElement | null = host.parentElement;
  while (node) {
    if (node.classList.contains("dashboard-canvas-surface")) {
      return node;
    }
    const style = getComputedStyle(node);
    if (
      style.overflow === "hidden" ||
      style.overflowX === "hidden" ||
      style.overflowY === "hidden"
    ) {
      if (node.clientWidth > 0 && node.clientHeight > 0) return node;
    }
    node = node.parentElement;
  }
  return host;
}

export const SHAPE_RESIZE_HANDLE_SCREEN_PX = 28;
/** 对标 DE 左侧 edit-bar：屏幕 px，缩放后换算为画布命中宽 */
export const SHAPE_EDIT_BAR_SCREEN_WIDTH = 32;
export const SHAPE_RESIZE_VISUAL_SCREEN_PX = 12;
/** DE `.de-drag-area` 透明边带（屏幕 px） */
export const SHAPE_DRAG_EDGE_TOP_SCREEN_PX = 12;
export const SHAPE_DRAG_EDGE_SIDE_SCREEN_PX = 16;
export const SHAPE_DRAG_EDGE_RIGHT_TOP_SCREEN_PX = 70;
export const SHAPE_DRAG_EDGE_BOTTOM_INSET_SCREEN_PX = 40;

/** 辅助网格叠层（须低于所有组件 shape） */
export const PIXEL_AUX_GRID_Z_INDEX = 1;

/** 未选中 shape 起始 z-index，保证始终在辅助网格之上 */
export const PIXEL_SHAPE_BASE_Z_INDEX = 10;

/** 选中 shape 抬升 z-index，避免被邻组件遮盖 */
export const PIXEL_SHAPE_SELECTED_Z_BOOST = 1_000_000;

/** 拖动/缩放中（isPlayer）再抬升，确保可叠过邻块且无体积阻挡 */
export const PIXEL_SHAPE_PLAYER_Z_BOOST = PIXEL_SHAPE_SELECTED_Z_BOOST + 1_000;

/** 对齐参考线须盖过选中 shape，否则拖动时蓝线被活动组件遮住 */
export const PIXEL_MARK_LINE_Z_INDEX = PIXEL_SHAPE_SELECTED_Z_BOOST + 1_000_000;

export function pixelShapeZIndex(order: number, selected: boolean): number {
  return selected
    ? PIXEL_SHAPE_SELECTED_Z_BOOST + order
    : PIXEL_SHAPE_BASE_Z_INDEX + order;
}

export function pixelShapePlayerZIndex(order: number): number {
  return PIXEL_SHAPE_PLAYER_Z_BOOST + order;
}

export function clientPointToCanvas(
  host: Pick<HTMLElement, "getBoundingClientRect" | "scrollLeft" | "scrollTop">,
  clientX: number,
  clientY: number,
  scale: number,
  gutter = 0,
): PixelPoint {
  const safeScale = scale > 0 ? scale : 1;
  const rect = host.getBoundingClientRect();
  return {
    x: (clientX - rect.left + host.scrollLeft - gutter) / safeScale,
    y: (clientY - rect.top + host.scrollTop) / safeScale,
  };
}

/**
 * 屏幕坐标 → 画布逻辑坐标（以已 scale 的 stage 外框为准）。
 * 自动吸收 scroll、居中留白、stageLeft 与 transform，避免 host 手算偏移漂移。
 */
export function clientPointToCanvasFromStage(
  stage: Pick<HTMLElement, "getBoundingClientRect">,
  clientX: number,
  clientY: number,
  scale: number,
): PixelPoint {
  const safeScale = scale > 0 ? scale : 1;
  const rect = stage.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / safeScale,
    y: (clientY - rect.top) / safeScale,
  };
}

/** 从 stage 屏幕外框反推视觉缩放（含祖先 transform；设计视口锁定时替代内部 scale=1） */
export function resolveStageVisualScale(
  stage: Pick<HTMLElement, "getBoundingClientRect"> | null | undefined,
  designWidth: number,
  designHeight: number,
): number {
  if (!stage || designWidth <= 0 || designHeight <= 0) return 1;
  const rect = stage.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return 1;
  const widthScale = rect.width > 0 ? rect.width / designWidth : Number.POSITIVE_INFINITY;
  const heightScale = rect.height > 0 ? rect.height / designHeight : Number.POSITIVE_INFINITY;
  const visual = Math.min(widthScale, heightScale);
  return visual > 0 && Number.isFinite(visual) ? visual : 1;
}

/** 测量可用宽度：优先布局外框，避免 padding-right 藏条缝导致 scale 与视觉不一致 */
export function resolvePixelCanvasMeasureWidth(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  if (rect.width > 0) return rect.width;
  return element.clientWidth;
}

export type PixelInteractionOptions = {
  allowBottomGrowth?: boolean;
};

export function applyPixelInteraction(
  start: PixelRect,
  delta: PixelPoint,
  kind: PixelInteractionKind,
  canvas: PixelCanvasBounds,
  options: PixelInteractionOptions = {},
): PixelRect {
  const allowBottomGrowth = options.allowBottomGrowth ?? false;
  if (kind === "move") {
    const maxY = allowBottomGrowth
      ? Number.POSITIVE_INFINITY
      : Math.max(0, canvas.height - start.height);
    return roundedRect(
      clamp(start.x + delta.x, 0, Math.max(0, canvas.width - start.width)),
      clamp(start.y + delta.y, 0, maxY),
      start.width,
      start.height,
    );
  }

  const movesLeft = kind.includes("w");
  const movesRight = kind.includes("e");
  const movesTop = kind.includes("n");
  const movesBottom = kind.includes("s");
  const startRight = start.x + start.width;
  const startBottom = start.y + start.height;
  const left = movesLeft
    ? clamp(start.x + delta.x, 0, startRight - MIN_WIDTH)
    : start.x;
  const right = movesRight
    ? clamp(startRight + delta.x, start.x + MIN_WIDTH, canvas.width)
    : startRight;
  const top = movesTop
    ? clamp(start.y + delta.y, 0, startBottom - MIN_HEIGHT)
    : start.y;
  const bottomLimit = allowBottomGrowth ? Number.POSITIVE_INFINITY : canvas.height;
  const bottom = movesBottom
    ? clamp(startBottom + delta.y, start.y + MIN_HEIGHT, bottomLimit)
    : startBottom;

  return roundedRect(left, top, right - left, bottom - top);
}

export type PixelStackPickWidget = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
  hidden?: boolean;
  parentTabsId?: string;
};

/** 画布点下所有顶层组件，按叠放顺序（最前 → 最后） */
export function findTopLevelWidgetsAtCanvasPoint(
  widgets: PixelStackPickWidget[],
  point: PixelPoint,
): string[] {
  return widgets
    .filter((widget) => !widget.hidden && !widget.parentTabsId)
    .filter(
      (widget) =>
        point.x >= widget.x &&
        point.x <= widget.x + widget.width &&
        point.y >= widget.y &&
        point.y <= widget.y + widget.height,
    )
    .sort((left, right) => {
      const delta = right.order - left.order;
      return delta !== 0 ? delta : right.id.localeCompare(left.id);
    })
    .map((widget) => widget.id);
}

/** 重叠点选：在叠放列表中轮换到下一层 */
export function resolveNextStackedWidgetAtPoint(
  widgetIds: string[],
  currentId: string,
): string | undefined {
  if (widgetIds.length === 0) return undefined;
  if (widgetIds.length === 1) return widgetIds[0];
  const index = widgetIds.indexOf(currentId);
  if (index < 0) return widgetIds[0];
  return widgetIds[(index + 1) % widgetIds.length];
}

/** resize 相对起点在各活动轴上的推进量（正=放大/外扩，负=缩小） */
export function resizeAdvancementScore(
  start: PixelRect,
  rect: PixelRect,
  kind: PixelInteractionKind,
): number {
  if (kind === "move") return 0;
  let score = 0;
  if (kind.includes("e")) score += rect.x + rect.width - (start.x + start.width);
  if (kind.includes("w")) score += start.x - rect.x;
  if (kind.includes("s")) score += rect.y + rect.height - (start.y + start.height);
  if (kind.includes("n")) score += start.y - rect.y;
  return score;
}

/** 松手提交：在 pending 与 pointerup 两路结果中取推进更远者，避免末帧吸附/抖动回拉 */
export function preferAdvancedResizeRect(
  start: PixelRect,
  primary: PixelRect,
  alternate: PixelRect,
  kind: PixelInteractionKind,
): PixelRect {
  const primaryScore = resizeAdvancementScore(start, primary, kind);
  const alternateScore = resizeAdvancementScore(start, alternate, kind);
  if (alternateScore > primaryScore) return alternate;
  return primary;
}
