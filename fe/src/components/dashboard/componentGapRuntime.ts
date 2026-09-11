import type { CSSProperties } from "react";
import type { GapConfigInput } from "./gapPolicy";
import { PIXEL_COLLISION_OVERLAP_BUFFER_PX } from "./pixelCanvas/collisionLayout";
import {
  DASHBOARD_SHAPE_GAP_VAR,
  resolvePixelGutter,
  resolveWidgetGap,
} from "./gapPolicy";

export type CanvasGapMode = "grid" | "pixel";

/** 间隙在画布上的运行时 adapter 输出（CSS / 吸附 / 碰撞） */
export type ComponentGapRuntime = {
  mode: CanvasGapMode;
  /** shape 外层 padding（DE curGap） */
  shellPaddingPx: number;
  /** 对齐吸附使用的 gap（与 shell 一致） */
  snapGapPx: number;
  /**
   * 布局引擎 outer rect 间距。DE 模型下间隙在 shell padding 内，
   * 布局坐标不扩缝 → 恒为 0。
   */
  collisionGapPx: number;
  /** 碰撞推挤缓冲（画布 px）：双向重叠须超过此值 */
  collisionOverlapBufferPx: number;
};

export function resolveComponentGapRuntime(
  config: GapConfigInput,
  mode: CanvasGapMode,
): ComponentGapRuntime {
  const shellPaddingPx =
    mode === "pixel" ? resolvePixelGutter(config) : resolveWidgetGap(config);
  return {
    mode,
    shellPaddingPx,
    snapGapPx: shellPaddingPx,
    collisionGapPx: 0,
    collisionOverlapBufferPx: PIXEL_COLLISION_OVERLAP_BUFFER_PX,
  };
}

export function componentGapShellStyle(gapPx: number): CSSProperties {
  return { [DASHBOARD_SHAPE_GAP_VAR]: `${Math.max(0, gapPx)}px` } as CSSProperties;
}
