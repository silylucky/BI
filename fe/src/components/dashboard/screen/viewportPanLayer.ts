import type { ViewportPan } from "./dataScreenViewportScroll";

export function formatViewportPanTransform(
  offsetX: number,
  offsetY: number,
  pan: ViewportPan,
): string {
  return `translate(${offsetX + pan.x}px, ${offsetY + pan.y}px)`;
}

export function applyViewportPanLayerTransform(
  element: HTMLElement | null | undefined,
  offsetX: number,
  offsetY: number,
  pan: ViewportPan,
): void {
  if (!element) return;
  element.style.transform = formatViewportPanTransform(offsetX, offsetY, pan);
}

export const VIEWPORT_PAN_CLICK_THRESHOLD_PX = 4;

export function hasExceededPanClickThreshold(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  thresholdPx = VIEWPORT_PAN_CLICK_THRESHOLD_PX,
): boolean {
  return (
    Math.abs(clientX - startX) > thresholdPx || Math.abs(clientY - startY) > thresholdPx
  );
}
