import { pixelRectsNearlyEqual } from "./pixelRectEqual";
import type { PixelRect } from "./geometry";

/** 交互落库前 display 领先 props 时，禁止 props 同步覆盖外框几何 */
export function shouldApplyPropsRectToDisplay(
  display: PixelRect,
  nextProps: PixelRect,
  lastSynced: PixelRect | null,
): boolean {
  if (pixelRectsNearlyEqual(display, nextProps)) return true;
  if (!lastSynced) return false;
  return pixelRectsNearlyEqual(display, lastSynced);
}
