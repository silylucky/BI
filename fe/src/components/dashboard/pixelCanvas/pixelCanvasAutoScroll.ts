/** 对标 DataEase CanvasCore scrollScreen：指针靠近滚动容器上下缘时自动滚动画布 */
export const PIXEL_CANVAS_AUTO_SCROLL_EDGE_PX = 50;
export const PIXEL_CANVAS_AUTO_SCROLL_STEP_PX = 20;

export type PixelCanvasAutoScrollOptions = {
  edgeThresholdPx?: number;
  stepPx?: number;
};

/**
 * 在纵向可滚动的画布宿主上按指针位置自动滚动。
 * @returns 实际 scrollTop 变化量（用于拖动跟手补偿）
 */
export function autoScrollPixelCanvasHost(
  host: Pick<
    HTMLElement,
    "getBoundingClientRect" | "scrollTop" | "scrollHeight" | "clientHeight"
  >,
  clientY: number,
  options: PixelCanvasAutoScrollOptions = {},
): number {
  const edge = options.edgeThresholdPx ?? PIXEL_CANVAS_AUTO_SCROLL_EDGE_PX;
  const step = options.stepPx ?? PIXEL_CANVAS_AUTO_SCROLL_STEP_PX;
  const rect = host.getBoundingClientRect();
  const maxScrollTop = Math.max(0, host.scrollHeight - host.clientHeight);
  const previous = host.scrollTop;

  if (clientY >= rect.bottom - edge) {
    host.scrollTop = Math.min(maxScrollTop, previous + step);
  } else if (clientY <= rect.top + edge) {
    host.scrollTop = Math.max(0, previous - step);
  }

  return host.scrollTop - previous;
}
