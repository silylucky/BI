export const DATA_SCREEN_MIN_USER_ZOOM = 0.25;
export const DATA_SCREEN_MAX_USER_ZOOM = 2;
export const DATA_SCREEN_ZOOM_WHEEL_STEP = 0.08;
export const DATA_SCREEN_ZOOM_BUTTON_STEP = 0.1;

export const DATA_SCREEN_ZOOM_PRESETS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2,
] as const;

export function clampDataScreenUserZoom(value: number): number {
  return Math.min(
    DATA_SCREEN_MAX_USER_ZOOM,
    Math.max(DATA_SCREEN_MIN_USER_ZOOM, value),
  );
}

export function formatDataScreenZoomPercent(userZoom: number): string {
  return `${Math.round(userZoom * 100)}%`;
}

export function stepDataScreenUserZoom(
  current: number,
  direction: 1 | -1,
  step = DATA_SCREEN_ZOOM_BUTTON_STEP,
): number {
  return clampDataScreenUserZoom(current + direction * step);
}
