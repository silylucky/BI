export type GeoMapTapState = {
  at: number;
  key: string;
} | null;

export const GEO_MAP_DOUBLE_TAP_MS = 400;
export const GEO_MAP_TAP_MOVE_TOLERANCE_PX = 5;

export function isPointerTapMove(
  downX: number,
  downY: number,
  upX: number,
  upY: number,
  tolerancePx = GEO_MAP_TAP_MOVE_TOLERANCE_PX,
): boolean {
  const dx = upX - downX;
  const dy = upY - downY;
  return dx * dx + dy * dy <= tolerancePx * tolerancePx;
}

/** 同一 key 在窗口期内连续两次轻触视为双击 */
export function advanceGeoMapDoubleTap(
  prev: GeoMapTapState,
  now: number,
  key: string,
  maxGapMs = GEO_MAP_DOUBLE_TAP_MS,
): { isDouble: boolean; next: GeoMapTapState } {
  if (!prev || prev.key !== key || now - prev.at > maxGapMs) {
    return { isDouble: false, next: { at: now, key } };
  }
  return { isDouble: true, next: null };
}
