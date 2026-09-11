import type { PixelInteractionKind } from "./geometry";

/** DataEase `isPlayer`：缩放/拖移中用实时像素尺寸，而非已提交 layout */
export function isResizeInteraction(kind: PixelInteractionKind): boolean {
  return kind !== "move";
}
