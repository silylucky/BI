import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";
import { getTopLevelPixelWidgets, syncParkedTabChildren } from "../layoutUtils";
import { readSurfaceKind } from "@/lib/dataScreenLayout";
import type { PixelCanvasBounds, PixelRect } from "./geometry";

export type CollisionLayoutOptions = {
  gap?: number;
  minCanvasHeight?: number;
  bottomPadding?: number;
  /** 两轴重叠均超过该值（画布 px）才触发推挤，避免轻触即碰撞 */
  minOverlap?: number;
  /** @deprecated */
  skipVerticalCompact?: boolean;
};

/** 拖动/落位碰撞缓冲：XY 双向重叠均须超过此值才推挤邻块 */
export const PIXEL_COLLISION_OVERLAP_BUFFER_PX = 40;

/** 松手/落位提交：任意重叠即触发碰撞推挤（忽略预览缓冲） */
export const COLLISION_COMMIT_MIN_OVERLAP_PX = 0;

const PACK_SCAN_STEP = 8;

const DEFAULT_OPTIONS: Required<Omit<CollisionLayoutOptions, "skipVerticalCompact">> & {
  skipVerticalCompact: boolean;
} = {
  gap: 0,
  minCanvasHeight: 220,
  bottomPadding: 0,
  minOverlap: PIXEL_COLLISION_OVERLAP_BUFFER_PX,
  skipVerticalCompact: false,
};

/** 数据大屏：允许自由叠放，不做 DE 式邻块推挤 */
export function allowsPixelWidgetOverlap(
  layout: Pick<DashboardLayoutV2, "styleConfig">,
): boolean {
  return readSurfaceKind(layout) === "data-screen";
}

export function widgetRect(widget: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">): PixelRect {
  return { x: widget.x, y: widget.y, width: widget.width, height: widget.height };
}

export function rectsOverlap(
  a: PixelRect,
  b: PixelRect,
  gap = 0,
  minOverlap = 0,
): boolean {
  const touches =
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y;
  if (!touches || minOverlap <= 0) return touches;
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > minOverlap && overlapY > minOverlap;
}

export function rectsTouch(a: PixelRect, b: PixelRect, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** 与邻块有交集，但双向重叠未超过缓冲（轻触区） */
export function hasShallowOverlap(
  a: PixelRect,
  b: PixelRect,
  minOverlap: number,
  gap = 0,
): boolean {
  return rectsTouch(a, b, gap) && !rectsOverlap(a, b, gap, minOverlap);
}

/** 拖动落点在轻触区（仅用于单测/文档；产品侧不再整段回弹） */
export function shouldRevertPixelDragCommit(
  finalRect: PixelRect,
  _startRect: PixelRect,
  others: PixelRect[],
  minOverlap: number,
  gap = 0,
): boolean {
  return others.some((other) => hasShallowOverlap(finalRect, other, minOverlap, gap));
}

/** 仅更新活动组件外框，不触发邻块碰撞推挤（数据大屏叠放） */
export function applyActiveWidgetRect(
  layout: DashboardLayoutV2,
  activeId: string,
  activeRect: PixelRect,
): DashboardLayoutV2 {
  const roundedActive = {
    x: Math.round(activeRect.x),
    y: Math.round(activeRect.y),
    width: Math.round(activeRect.width),
    height: Math.round(activeRect.height),
  };
  return {
    ...layout,
    widgets: layout.widgets.map((widget) =>
      widget.id === activeId ? { ...widget, ...roundedActive } : widget,
    ),
  };
}

/** 按 surface 策略写入活动组件外框：仪表板推挤邻块，大屏仅叠放 */
export function resolvePixelLayoutWithActiveRect(
  layout: DashboardLayoutV2,
  activeId: string,
  activeRect: PixelRect,
  options: CollisionLayoutOptions = {},
): DashboardLayoutV2 {
  if (allowsPixelWidgetOverlap(layout)) {
    return applyActiveWidgetRect(layout, activeId, activeRect);
  }
  return resolvePixelCollisions(layout, activeId, activeRect, options);
}

function stableWidgetKey(widget: PixelLayoutWidget): [number, number, number, string] {
  return [widget.y, widget.x, widget.order, widget.id];
}

function compareWidgets(a: PixelLayoutWidget, b: PixelLayoutWidget): number {
  const [ay, ax, ao, aid] = stableWidgetKey(a);
  const [by, bx, bo, bid] = stableWidgetKey(b);
  if (ay !== by) return ay - by;
  if (ax !== bx) return ax - bx;
  if (ao !== bo) return ao - bo;
  return aid.localeCompare(bid);
}

function withRect(widget: PixelLayoutWidget, rect: PixelRect): PixelLayoutWidget {
  return { ...widget, ...rect };
}

function growCanvasHeight(
  widgets: PixelLayoutWidget[],
  canvas: PixelCanvasBounds,
  options: Required<CollisionLayoutOptions>,
): number {
  const lowest = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.height), 0);
  return Math.max(options.minCanvasHeight, lowest + options.bottomPadding, canvas.height);
}

function applyPositions(
  layout: DashboardLayoutV2,
  positions: Map<string, PixelRect>,
  options: Required<CollisionLayoutOptions>,
): DashboardLayoutV2 {
  const widgets = layout.widgets.map((widget) => withRect(widget, positions.get(widget.id)!));
  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      height: growCanvasHeight(widgets, layout.canvas, options),
    },
    widgets,
  };
}

function horizontalOverlap(a: PixelRect, b: PixelRect, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x;
}

function isBelowVacatedFootprint(rect: PixelRect, vacated: PixelRect, gap: number): boolean {
  if (!horizontalOverlap(rect, vacated, gap)) return false;
  return rect.y >= vacated.y + vacated.height + gap;
}

/** 对标 DE moveItemUp：同列组件可上浮的最高 y */
function maxUpwardTop(
  rect: PixelRect,
  positions: Map<string, PixelRect>,
  excludeId: string,
  gap: number,
): number {
  let top = 0;
  for (const [id, other] of positions) {
    if (id === excludeId) continue;
    if (!horizontalOverlap(rect, other, gap)) continue;
    if (other.y + other.height + gap <= rect.y) {
      top = Math.max(top, other.y + other.height + gap);
    }
  }
  return top;
}

function globalVerticalCompact(
  widgets: PixelLayoutWidget[],
  positions: Map<string, PixelRect>,
  gap: number,
  excludeIds?: ReadonlySet<string>,
): boolean {
  let changed = false;
  const sorted = [...widgets].sort(compareWidgets);
  for (const widget of sorted) {
    if (excludeIds?.has(widget.id)) continue;
    const rect = positions.get(widget.id);
    if (!rect) continue;
    const nextY = Math.round(maxUpwardTop(rect, positions, widget.id, gap));
    if (nextY < rect.y) {
      positions.set(widget.id, { ...rect, y: nextY });
      changed = true;
    }
  }
  return changed;
}

function liftVacatedColumn(
  widgets: PixelLayoutWidget[],
  positions: Map<string, PixelRect>,
  vacated: PixelRect,
  activeId: string,
  gap: number,
): void {
  const column = widgets.filter((widget) => {
    if (widget.id === activeId) return false;
    const rect = positions.get(widget.id);
    return rect ? isBelowVacatedFootprint(rect, vacated, gap) : false;
  });
  const limit = column.length + 1;
  for (let step = 0; step < limit; step += 1) {
    if (!globalVerticalCompact(column, positions, gap)) break;
  }
}

/** DE findBelowItems：同列中位于 item 下方的首层组件 */
function findBelowItemsInColumn(
  widgets: PixelLayoutWidget[],
  positions: Map<string, PixelRect>,
  itemId: string,
  gap: number,
): PixelLayoutWidget[] {
  const item = positions.get(itemId);
  if (!item) return [];
  return widgets
    .filter((widget) => widget.id !== itemId)
    .filter((widget) => {
      const rect = positions.get(widget.id);
      return rect ? horizontalOverlap(rect, item, gap) && rect.y >= item.y : false;
    })
    .sort(compareWidgets);
}

/** DE moveItemDown：递归下推同列被占位组件 */
function moveItemDown(
  widgets: PixelLayoutWidget[],
  positions: Map<string, PixelRect>,
  itemId: string,
  deltaY: number,
  gap: number,
  depth = 0,
): void {
  const limit = widgets.length * widgets.length;
  if (depth > limit) {
    throw new Error("moveItemDown exceeded cascade limit");
  }
  const item = positions.get(itemId);
  if (!item || deltaY <= 0) return;
  positions.set(itemId, { ...item, y: Math.round(item.y + deltaY) });
  const moved = positions.get(itemId)!;
  for (const below of findBelowItemsInColumn(widgets, positions, itemId, gap)) {
    const belowRect = positions.get(below.id)!;
    const moveSize = moved.y + moved.height + gap - belowRect.y;
    if (moveSize > 0) {
      moveItemDown(widgets, positions, below.id, moveSize, gap, depth + 1);
    }
  }
}

/** DE emptyTargetCell：落位时清空目标区占位（凡与目标外框重叠的块下推） */
function emptyTargetFootprint(
  widgets: PixelLayoutWidget[],
  positions: Map<string, PixelRect>,
  activeId: string,
  target: PixelRect,
  gap: number,
  minOverlap: number,
): void {
  const candidates = widgets
    .filter((widget) => widget.id !== activeId)
    .filter((widget) => {
      const rect = positions.get(widget.id)!;
      return (
        horizontalOverlap(rect, target, gap) &&
        rectsOverlap(rect, target, gap, minOverlap)
      );
    })
    .sort(compareWidgets);

  for (const blocked of candidates) {
    const blockedRect = positions.get(blocked.id)!;
    const moveSize = target.y + target.height + gap - blockedRect.y;
    if (moveSize > 0) {
      moveItemDown(widgets, positions, blocked.id, moveSize, gap);
    }
  }
}

/**
 * 对标 DataEase CanvasCore movePlayer / resizePlayer：
 * 1. 旧占位同列上浮（moveItemUp）
 * 2. 写入新外框
 * 3. 目标区占位下推（emptyTargetCell + moveItemDown）
 *
 * 拖动过程中经 PixelCanvas.handlePreview 节流预览；松手/提交同算法写入 layout。
 */
export function resolvePixelCollisions(
  layout: DashboardLayoutV2,
  activeId: string,
  activeRect: PixelRect,
  options: CollisionLayoutOptions = {},
): DashboardLayoutV2 {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const collisionWidgets = getTopLevelPixelWidgets(layout.widgets);
  const positions = new Map(collisionWidgets.map((widget) => [widget.id, widgetRect(widget)]));
  const roundedActive = {
    x: Math.round(activeRect.x),
    y: Math.round(activeRect.y),
    width: Math.round(activeRect.width),
    height: Math.round(activeRect.height),
  };

  const oldRect = positions.get(activeId);
  const shouldVacateLift =
    oldRect &&
    (roundedActive.y !== oldRect.y ||
      roundedActive.x !== oldRect.x ||
      roundedActive.height < oldRect.height);

  if (shouldVacateLift) {
    positions.delete(activeId);
    liftVacatedColumn(collisionWidgets, positions, oldRect, activeId, resolved.gap);
  }

  positions.set(activeId, roundedActive);
  emptyTargetFootprint(
    collisionWidgets,
    positions,
    activeId,
    roundedActive,
    resolved.gap,
    resolved.minOverlap,
  );

  const movedTopLevel = collisionWidgets.map((widget) =>
    withRect(widget, positions.get(widget.id)!),
  );
  const movedById = new Map(movedTopLevel.map((w) => [w.id, w]));
  const widgets = layout.widgets.map((w) => movedById.get(w.id) ?? w);

  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      height: growCanvasHeight(movedTopLevel, layout.canvas, resolved),
    },
    widgets: syncParkedTabChildren(widgets),
  };
}

export function findNextOpenSlot(
  size: Pick<PixelRect, "width" | "height">,
  occupied: PixelRect[],
  canvas: PixelCanvasBounds,
  gap = DEFAULT_OPTIONS.gap,
): Pick<PixelRect, "x" | "y"> {
  if (occupied.length === 0) return { x: 0, y: 0 };

  const candidatePoints = new Set<string>();
  const addCandidate = (x: number, y: number) => {
    if (x < 0 || y < 0 || x + size.width > canvas.width || y + size.height > canvas.height) return;
    candidatePoints.add(`${x}:${y}`);
  };

  addCandidate(0, 0);
  for (const rect of occupied) {
    addCandidate(rect.x + rect.width + gap, rect.y);
    addCandidate(rect.x, rect.y + rect.height + gap);
    addCandidate(rect.x + rect.width + gap, rect.y + rect.height + gap);
  }

  const maxY =
    occupied.reduce((max, rect) => Math.max(max, rect.y + rect.height), 0) + size.height;
  for (let y = 0; y <= maxY; y += PACK_SCAN_STEP) {
    for (let x = 0; x <= canvas.width - size.width; x += PACK_SCAN_STEP) {
      addCandidate(x, y);
    }
  }

  let best: Pick<PixelRect, "x" | "y"> | null = null;
  let bestY = Number.POSITIVE_INFINITY;
  let bestX = Number.POSITIVE_INFINITY;

  for (const key of candidatePoints) {
    const [rawX, rawY] = key.split(":").map(Number);
    const x = rawX!;
    const y = rawY!;
    const candidate = { x, y, width: size.width, height: size.height };
    if (occupied.some((rect) => rectsOverlap(rect, candidate, gap))) continue;
    if (y < bestY || (y === bestY && x < bestX)) {
      bestY = y;
      bestX = x;
      best = { x, y };
    }
  }

  if (best) return best;

  const lowestExtent = occupied.reduce(
    (max, rect) => Math.max(max, rect.y + rect.height),
    0,
  );
  let y = lowestExtent + gap;
  const x = 0;
  const scanLimit = Math.max(
    canvas.height,
    lowestExtent + size.height * 4,
    lowestExtent + PACK_SCAN_STEP * 32,
  );
  while (y + size.height <= scanLimit) {
    const candidate = { x, y, width: size.width, height: size.height };
    if (!occupied.some((rect) => rectsOverlap(rect, candidate, gap))) {
      return { x, y };
    }
    y += PACK_SCAN_STEP;
  }

  const lowest = occupied.reduce((top, rect) =>
    rect.y + rect.height > top.y + top.height ? rect : top,
  );
  return {
    x: 0,
    y: Math.min(
      lowest.y + lowest.height + gap,
      Math.max(0, canvas.height - size.height),
    ),
  };
}

export function packPixelLayoutSeamless(
  layout: DashboardLayoutV2,
  options: CollisionLayoutOptions = {},
): DashboardLayoutV2 {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const topLevel = getTopLevelPixelWidgets(layout.widgets).filter(
    (widget) => widget.width > 0 && widget.height > 0,
  );
  const sorted = [...topLevel].sort(compareWidgets);
  const positions = new Map<string, PixelRect>();
  const placed: PixelRect[] = [];

  for (const widget of sorted) {
    const size = { width: widget.width, height: widget.height };
    const slot = findNextOpenSlot(size, placed, layout.canvas, resolved.gap);
    const rect = {
      x: Math.round(slot.x),
      y: Math.round(slot.y),
      width: size.width,
      height: size.height,
    };
    positions.set(widget.id, rect);
    placed.push(rect);
  }

  const movedById = new Map(
    sorted.map((widget) => [widget.id, withRect(widget, positions.get(widget.id)!)] as const),
  );
  const widgets = layout.widgets.map((widget) => movedById.get(widget.id) ?? widget);
  const movedTopLevel = sorted.map((widget) => movedById.get(widget.id)!);

  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      height: growCanvasHeight(movedTopLevel, layout.canvas, resolved),
    },
    widgets: syncParkedTabChildren(widgets),
  };
}

/** @deprecated Use packPixelLayoutSeamless */
export function normalizeOverlappingPixelLayout(
  layout: DashboardLayoutV2,
  options: CollisionLayoutOptions = {},
): DashboardLayoutV2 {
  return packPixelLayoutSeamless(layout, options);
}

export function layoutsOverlap(layout: DashboardLayoutV2, gap = 0): boolean {
  const widgets = getTopLevelPixelWidgets(layout.widgets).filter(
    (widget) => widget.width > 0 && widget.height > 0,
  );
  for (let i = 0; i < widgets.length; i += 1) {
    for (let j = i + 1; j < widgets.length; j += 1) {
      if (rectsOverlap(widgetRect(widgets[i]!), widgetRect(widgets[j]!), gap)) {
        return true;
      }
    }
  }
  return false;
}
