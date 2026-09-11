import type { GapConfigInput } from "../gapPolicy";
import { resolvePixelGutter } from "../gapPolicy";
import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";
import { getTopLevelPixelWidgets } from "../layoutUtils";
import { measurePixelLayoutOuterGaps } from "../gapRuntimeProbe";

const CROSS_AXIS_OVERLAP_MIN = 1;
const NEIGHBOR_GAP_EPS = 0.5;
const MAX_PASSES = 64;

export type GapCompactionResult = {
  layout: DashboardLayoutV2;
  compacted: boolean;
  closedGaps: number;
};

function crossOverlap(a: PixelLayoutWidget, b: PixelLayoutWidget, axis: "horizontal" | "vertical"): number {
  if (axis === "horizontal") {
    return Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  }
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
}

function cloneWidgets(widgets: PixelLayoutWidget[]): PixelLayoutWidget[] {
  return widgets.map((widget) => ({ ...widget }));
}

function compactHorizontalPass(
  widgets: PixelLayoutWidget[],
  targetOuterGap: number,
): { widgets: PixelLayoutWidget[]; moved: boolean } {
  const next = cloneWidgets(widgets);
  const byId = new Map(next.map((widget) => [widget.id, widget]));
  let moved = false;

  for (const left of next) {
    const leftRect = byId.get(left.id)!;
    let closest: PixelLayoutWidget | null = null;
    let closestGap = Infinity;

    for (const right of next) {
      if (right.id === left.id) continue;
      const rightRect = byId.get(right.id)!;
      if (crossOverlap(leftRect, rightRect, "horizontal") < CROSS_AXIS_OVERLAP_MIN) continue;
      const gap = rightRect.x - (leftRect.x + leftRect.width);
      if (gap < -NEIGHBOR_GAP_EPS || gap >= closestGap) continue;
      closestGap = gap;
      closest = right;
    }

    if (!closest || closestGap <= targetOuterGap + NEIGHBOR_GAP_EPS) continue;
    const delta = closestGap - targetOuterGap;
    const target = byId.get(closest.id)!;
    target.x = Math.round(target.x - delta);
    moved = true;
  }

  return { widgets: next, moved };
}

function compactVerticalPass(
  widgets: PixelLayoutWidget[],
  targetOuterGap: number,
): { widgets: PixelLayoutWidget[]; moved: boolean } {
  const next = cloneWidgets(widgets);
  const byId = new Map(next.map((widget) => [widget.id, widget]));
  let moved = false;

  for (const top of next) {
    const topRect = byId.get(top.id)!;
    let closest: PixelLayoutWidget | null = null;
    let closestGap = Infinity;

    for (const bottom of next) {
      if (bottom.id === top.id) continue;
      const bottomRect = byId.get(bottom.id)!;
      if (crossOverlap(topRect, bottomRect, "vertical") < CROSS_AXIS_OVERLAP_MIN) continue;
      const gap = bottomRect.y - (topRect.y + topRect.height);
      if (gap < -NEIGHBOR_GAP_EPS || gap >= closestGap) continue;
      closestGap = gap;
      closest = bottom;
    }

    if (!closest || closestGap <= targetOuterGap + NEIGHBOR_GAP_EPS) continue;
    const delta = closestGap - targetOuterGap;
    const target = byId.get(closest.id)!;
    target.y = Math.round(target.y - delta);
    moved = true;
  }

  return { widgets: next, moved };
}

/**
 * 将外框正缝压实至相切（gapPreset=none 或加载/保存时调用）。
 */
function compactTopLevelOuterRects(
  topLevel: PixelLayoutWidget[],
  targetOuterGap: number,
): { widgets: PixelLayoutWidget[]; moved: boolean } {
  if (topLevel.length < 2) {
    return { widgets: topLevel, moved: false };
  }

  let widgets = cloneWidgets(topLevel);
  let movedAny = false;

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const horizontal = compactHorizontalPass(widgets, targetOuterGap);
    widgets = horizontal.widgets;
    movedAny = movedAny || horizontal.moved;

    const vertical = compactVerticalPass(widgets, targetOuterGap);
    widgets = vertical.widgets;
    movedAny = movedAny || vertical.moved;

    if (!horizontal.moved && !vertical.moved) break;
  }

  return { widgets, moved: movedAny };
}

export function compactPixelLayoutOuterRects(layout: DashboardLayoutV2): GapCompactionResult {
  const topLevel = getTopLevelPixelWidgets(layout.widgets).filter(
    (widget) => widget.width > 0 && widget.height > 0,
  );
  if (topLevel.length < 2) {
    return { layout, compacted: false, closedGaps: 0 };
  }

  const beforeGaps = measurePixelLayoutOuterGaps(topLevel);
  const targetOuterGap = 0;
  const { widgets: compactedTopLevel, moved: movedAny } = compactTopLevelOuterRects(
    topLevel,
    targetOuterGap,
  );
  const movedById = new Map(compactedTopLevel.map((widget) => [widget.id, widget]));
  const widgets = layout.widgets.map((widget) => {
    const moved = movedById.get(widget.id);
    if (!moved) return widget;
    return { ...widget, x: moved.x, y: moved.y };
  });

  const afterGaps = measurePixelLayoutOuterGaps(compactedTopLevel);
  const closedGaps = Math.max(0, beforeGaps.length - afterGaps.length);

  return {
    layout: { ...layout, widgets },
    compacted: movedAny,
    closedGaps,
  };
}

/**
 * shell gap 变小时压实外框正缝（DE：坐标为外框，padding 独立）。
 * 不处理重叠块；仅将可分离正缝收敛到 targetOuterGap（none→0）。
 */
export function compactPixelLayoutForGapChange(
  layout: DashboardLayoutV2,
  prevShellGap: number,
  nextShellGap: number,
): GapCompactionResult {
  if (nextShellGap >= prevShellGap) {
    return { layout, compacted: false, closedGaps: 0 };
  }
  return compactPixelLayoutOuterRects(layout);
}

export function shouldCompactForGapChange(prevShellGap: number, nextShellGap: number): boolean {
  return nextShellGap < prevShellGap;
}

/** gapPreset=none 时：加载/保存/编辑态零间隙一律压实外框正缝 */
export function compactPixelLayoutWhenZeroGap(
  layout: DashboardLayoutV2,
  gapConfig: GapConfigInput,
): GapCompactionResult {
  if (resolvePixelGutter(gapConfig) > 0 || layout.widgets.length < 2) {
    return { layout, compacted: false, closedGaps: 0 };
  }
  return compactPixelLayoutOuterRects(layout);
}
