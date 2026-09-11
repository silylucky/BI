import type { Layout, LayoutItem } from "react-grid-layout/legacy";

export const GRID_COLS = 12;
const PREFERRED_WIDTHS = [4, 6, 8, 12];

/** 半宽/三分之一宽组件的列起点（对齐 DataEase 12 列栅格） */
const SNAP_X_SLOTS: Record<number, number[]> = {
  4: [0, 4, 8],
  6: [0, 6],
  8: [0, 4],
  12: [0],
};

export function layoutItemsCollide(
  a: Pick<LayoutItem, "x" | "y" | "w" | "h">,
  b: Pick<LayoutItem, "x" | "y" | "w" | "h">,
): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

function snapWidth(w: number): number {
  const rounded = Math.min(GRID_COLS, Math.max(1, Math.round(w)));
  let best = rounded;
  let bestDist = Infinity;
  for (const pref of PREFERRED_WIDTHS) {
    const dist = Math.abs(rounded - pref);
    if (dist < bestDist) {
      bestDist = dist;
      best = pref;
    }
  }
  return bestDist <= 1 ? best : rounded;
}

function snapX(x: number, w: number): number {
  const snappedW = snapWidth(w);
  const slots = SNAP_X_SLOTS[snappedW];
  if (slots?.length) {
    return slots.reduce((best, slot) =>
      Math.abs(x - slot) < Math.abs(x - best) ? slot : best,
    );
  }
  const maxX = GRID_COLS - snappedW;
  return Math.min(maxX, Math.max(0, Math.round(x)));
}

function softSnapItem(item: LayoutItem): LayoutItem {
  const w = Math.min(GRID_COLS, Math.max(1, Math.round(item.w)));
  const maxX = GRID_COLS - w;
  return {
    ...item,
    x: Math.min(maxX, Math.max(0, Math.round(item.x))),
    y: Math.max(0, Math.round(item.y)),
    w,
    h: Math.max(1, Math.round(item.h)),
  };
}

function snapItem(item: LayoutItem): LayoutItem {
  const w = snapWidth(item.w);
  const x = snapX(item.x, w);
  return {
    ...item,
    x,
    w,
    y: Math.max(0, Math.round(item.y)),
    h: Math.max(1, Math.round(item.h)),
  };
}

/** 垂直紧凑：上移组件消除行间空隙（对标 DataEase 画布自动对齐） */
export function compactLayoutVertical(layout: Layout): Layout {
  const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: LayoutItem[] = [];

  for (const item of sorted) {
    let y = item.y;
    while (y > 0) {
      const probe = { ...item, y: y - 1 };
      if (placed.some((other) => layoutItemsCollide(probe, other))) break;
      y -= 1;
    }
    placed.push({ ...item, y });
  }

  return placed;
}

/** 在现有布局中找第一个可放置 (x,y) 的空位，优先同行再换行 */
export function findFirstFreeSlot(
  layout: Layout,
  w: number,
  h: number,
  preferred?: { x: number; y: number },
): { x: number; y: number } {
  const width = Math.min(GRID_COLS, Math.max(1, Math.round(w)));
  const height = Math.max(1, Math.round(h));
  const startY = Math.max(0, Math.round(preferred?.y ?? 0));

  const fitsAt = (x: number, y: number) => {
    const box = { x, y, w: width, h: height };
    return !layout.some((item) => layoutItemsCollide(box, item));
  };

  const xCandidates = (() => {
    const slots = SNAP_X_SLOTS[width] ?? Array.from({ length: GRID_COLS - width + 1 }, (_, i) => i);
    if (preferred == null) return slots;
    const prefX = Math.min(GRID_COLS - width, Math.max(0, Math.round(preferred.x)));
    return [...slots].sort((a, b) => Math.abs(a - prefX) - Math.abs(b - prefX));
  })();

  for (let y = startY; y < startY + 200; y += 1) {
    for (const x of xCandidates) {
      if (fitsAt(x, y)) return { x, y };
    }
  }

  let maxY = 0;
  for (const item of layout) {
    maxY = Math.max(maxY, item.y + item.h);
  }
  return { x: xCandidates[0] ?? 0, y: maxY };
}

/** 吸附列宽 + 垂直紧凑（默认：仅取整，不强制 4/6/8/12 档位） */
export function normalizeGridLayout(layout: Layout): Layout {
  return compactLayoutVertical(layout.map(softSnapItem));
}

/** 强吸附到 4/6/8/12 列宽（测试 / 兼容旧行为） */
export function snapLayoutToGrid(layout: Layout): Layout {
  return layout.map(snapItem);
}

/** @deprecated use normalizeGridLayout — kept for imports */
export function softSnapLayoutToGrid(layout: Layout): Layout {
  return layout.map(softSnapItem);
}
