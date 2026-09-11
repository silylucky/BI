import type { GapConfigInput } from "./gapPolicy";
import { resolvePixelGutter, resolveWidgetGap } from "./gapPolicy";
import type { CanvasGapMode } from "./componentGapRuntime";
import type { PixelLayoutWidget } from "./layoutUtils";

export type OuterRectGap = {
  aId: string;
  bId: string;
  axis: "horizontal" | "vertical";
  /** B 起始边 − A 结束边（外框坐标，≥0） */
  gapPx: number;
};

const CROSS_AXIS_OVERLAP_MIN = 1;

function crossOverlap(
  a: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  b: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  axis: "horizontal" | "vertical",
): number {
  if (axis === "horizontal") {
    return Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  }
  return Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
}

/** 采样像素布局中相邻外框正缝（不含重叠、不含隔了其它块的远距缝） */
export function measurePixelLayoutOuterGaps(
  widgets: Pick<PixelLayoutWidget, "id" | "x" | "y" | "width" | "height">[],
  options?: { maxGapPx?: number },
): OuterRectGap[] {
  const maxGap = options?.maxGapPx ?? 512;
  const gaps: OuterRectGap[] = [];
  const seen = new Set<string>();

  const record = (aId: string, bId: string, axis: "horizontal" | "vertical", gapPx: number) => {
    if (gapPx <= 0 || gapPx > maxGap) return;
    const key = [aId, bId, axis].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    gaps.push({ aId, bId, axis, gapPx });
  };

  for (const anchor of widgets) {
    let closestRight: { id: string; gap: number } | null = null;
    let closestLeft: { id: string; gap: number } | null = null;
    let closestDown: { id: string; gap: number } | null = null;
    let closestUp: { id: string; gap: number } | null = null;

    for (const other of widgets) {
      if (other.id === anchor.id) continue;

      if (crossOverlap(anchor, other, "horizontal") >= CROSS_AXIS_OVERLAP_MIN) {
        const rightGap = other.x - (anchor.x + anchor.width);
        if (rightGap >= 0 && (!closestRight || rightGap < closestRight.gap)) {
          closestRight = { id: other.id, gap: rightGap };
        }
        const leftGap = anchor.x - (other.x + other.width);
        if (leftGap >= 0 && (!closestLeft || leftGap < closestLeft.gap)) {
          closestLeft = { id: other.id, gap: leftGap };
        }
      }

      if (crossOverlap(anchor, other, "vertical") >= CROSS_AXIS_OVERLAP_MIN) {
        const downGap = other.y - (anchor.y + anchor.height);
        if (downGap >= 0 && (!closestDown || downGap < closestDown.gap)) {
          closestDown = { id: other.id, gap: downGap };
        }
        const upGap = anchor.y - (other.y + other.height);
        if (upGap >= 0 && (!closestUp || upGap < closestUp.gap)) {
          closestUp = { id: other.id, gap: upGap };
        }
      }
    }

    if (closestRight) record(anchor.id, closestRight.id, "horizontal", closestRight.gap);
    if (closestLeft) record(closestLeft.id, anchor.id, "horizontal", closestLeft.gap);
    if (closestDown) record(anchor.id, closestDown.id, "vertical", closestDown.gap);
    if (closestUp) record(closestUp.id, anchor.id, "vertical", closestUp.gap);
  }

  return gaps;
}

export function hasPositiveOuterGaps(
  widgets: Pick<PixelLayoutWidget, "id" | "x" | "y" | "width" | "height">[],
  thresholdPx = 1.5,
): boolean {
  return measurePixelLayoutOuterGaps(widgets).some((gap) => gap.gapPx > thresholdPx);
}

/** 外框相切时两侧 shell padding 之和 ≈ 视觉缝宽 */
export function estimateVisualGapPx(outerGapPx: number, shellPaddingPx: number): number {
  return Math.max(0, outerGapPx) + shellPaddingPx * 2;
}

export type GapLayoutAnalysis = {
  shellPaddingPx: number;
  outerGaps: OuterRectGap[];
  hasConfigGap: boolean;
  hasCoordinateGaps: boolean;
  maxOuterGapPx: number;
  estimatedMaxVisualGapPx: number;
};

/** 诊断：区分「配置间隙」与「外框坐标缝」 */
export function analyzeDashboardGapLayout(
  widgets: Pick<PixelLayoutWidget, "id" | "x" | "y" | "width" | "height">[],
  gapConfig: GapConfigInput,
  mode: CanvasGapMode = "pixel",
): GapLayoutAnalysis {
  const shellPaddingPx =
    mode === "pixel" ? resolvePixelGutter(gapConfig) : resolveWidgetGap(gapConfig);
  const outerGaps = measurePixelLayoutOuterGaps(widgets);
  const maxOuterGapPx = outerGaps.reduce((max, gap) => Math.max(max, gap.gapPx), 0);
  return {
    shellPaddingPx,
    outerGaps,
    hasConfigGap: shellPaddingPx > 0,
    hasCoordinateGaps: hasPositiveOuterGaps(widgets),
    maxOuterGapPx,
    estimatedMaxVisualGapPx: estimateVisualGapPx(maxOuterGapPx, shellPaddingPx),
  };
}
