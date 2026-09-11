export type ViewportPanSession = {
  pointerId: number;
  startX: number;
  startY: number;
  panX: number;
  panY: number;
};

/** @deprecated 滚动平移；内容未溢出时无效，保留供回归对照 */
export function applyViewportPanScroll(
  session: Pick<ViewportPanSession, "startX" | "startY" | "scrollLeft" | "scrollTop"> & {
    scrollLeft: number;
    scrollTop: number;
  },
  clientX: number,
  clientY: number,
): { scrollLeft: number; scrollTop: number } {
  return {
    scrollLeft: session.scrollLeft - (clientX - session.startX),
    scrollTop: session.scrollTop - (clientY - session.startY),
  };
}

/** 视口平移：画布跟随指针（拖右 → 画布右移） */
export function applyViewportPanTranslate(
  session: ViewportPanSession,
  clientX: number,
  clientY: number,
): { panX: number; panY: number } {
  return {
    panX: session.panX + (clientX - session.startX),
    panY: session.panY + (clientY - session.startY),
  };
}
