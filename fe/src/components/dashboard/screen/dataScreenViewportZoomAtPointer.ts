import type { ViewportPan } from "./dataScreenViewportScroll";

export type ZoomAtPointerInput = {
  pointerX: number;
  pointerY: number;
  pan: ViewportPan;
  offsetX: number;
  offsetY: number;
  baseScale: number;
  oldZoom: number;
  newZoom: number;
};

/** 缩放时补偿 pan，使指针下的设计坐标保持在屏幕同一位置 */
export function computePanForZoomAtPointer(input: ZoomAtPointerInput): ViewportPan {
  const totalOld = input.baseScale * input.oldZoom;
  const totalNew = input.baseScale * input.newZoom;
  if (totalOld <= 0 || totalNew <= 0) return input.pan;

  const designX = (input.pointerX - input.offsetX - input.pan.x) / totalOld;
  const designY = (input.pointerY - input.offsetY - input.pan.y) / totalOld;
  return {
    x: input.pointerX - input.offsetX - designX * totalNew,
    y: input.pointerY - input.offsetY - designY * totalNew,
  };
}
