export type DataZoomWindow = { start: number; end: number };

const windows = new WeakMap<HTMLElement, DataZoomWindow>();

export const DATA_ZOOM_SLIDER_H = 22;
export const DATA_ZOOM_SLIDER_GAP = 8;
export const DATA_ZOOM_SLIDER_RESERVE = DATA_ZOOM_SLIDER_H + DATA_ZOOM_SLIDER_GAP;

export function clampDataZoomWindow(window: DataZoomWindow, count: number): DataZoomWindow {
  if (count <= 0) return { start: 0, end: 1 };
  let i0 = Math.floor(window.start * count);
  let i1 = Math.ceil(window.end * count);
  i0 = Math.max(0, Math.min(i0, count - 1));
  i1 = Math.max(i0 + 1, Math.min(i1, count));
  return { start: i0 / count, end: i1 / count };
}

export const DATA_ZOOM_DEFAULT_VISIBLE = 12;

export function defaultDataZoomWindow(count: number): DataZoomWindow {
  if (count <= DATA_ZOOM_DEFAULT_VISIBLE) return { start: 0, end: 1 };
  return clampDataZoomWindow({ start: 0, end: DATA_ZOOM_DEFAULT_VISIBLE / count }, count);
}

export function panDataZoomWindow(window: DataZoomWindow, deltaRatio: number, count: number): DataZoomWindow {
  const clamped = clampDataZoomWindow(window, count);
  const span = clamped.end - clamped.start;
  let start = clamped.start + deltaRatio;
  let end = start + span;
  if (start < 0) {
    start = 0;
    end = span;
  }
  if (end > 1) {
    end = 1;
    start = 1 - span;
  }
  return clampDataZoomWindow({ start, end }, count);
}

export function zoomDataZoomWindow(
  window: DataZoomWindow,
  factor: number,
  anchor: number,
  count: number,
): DataZoomWindow {
  const clamped = clampDataZoomWindow(window, count);
  const span = Math.max(clamped.end - clamped.start, count > 0 ? 1 / count : 1);
  const minSpan = count > 0 ? 1 / count : 1;
  const nextSpan = Math.min(1, Math.max(minSpan, span * factor));
  const t = Math.min(1, Math.max(0, anchor));
  const focus = clamped.start + span * t;
  let start = focus - nextSpan * t;
  let end = start + nextSpan;
  if (start < 0) {
    start = 0;
    end = nextSpan;
  }
  if (end > 1) {
    end = 1;
    start = 1 - nextSpan;
  }
  return clampDataZoomWindow({ start, end }, count);
}

export function sliceByDataZoomWindow<T>(items: readonly T[], window: DataZoomWindow): T[] {
  const count = items.length;
  if (count === 0) return [];
  const clamped = clampDataZoomWindow(window, count);
  const i0 = Math.round(clamped.start * count);
  const i1 = Math.round(clamped.end * count);
  return items.slice(i0, i1);
}

export function brushSelectionFromWindow(
  window: DataZoomWindow,
  innerW: number,
): [number, number] {
  return [window.start * innerW, window.end * innerW];
}

export function windowFromBrushSelection(
  selection: [number, number] | null,
  innerW: number,
  count: number,
  fallback: DataZoomWindow = { start: 0, end: 1 },
): DataZoomWindow {
  if (!selection || innerW <= 0) return clampDataZoomWindow(fallback, count);
  const [x0, x1] = selection;
  return clampDataZoomWindow({ start: x0 / innerW, end: x1 / innerW }, count);
}

export function sparklineByCategory(
  categories: readonly string[],
  points: readonly { category: string; value: number }[],
): number[] {
  const sums = new Map<string, number>();
  for (const point of points) {
    sums.set(point.category, (sums.get(point.category) ?? 0) + Number(point.value || 0));
  }
  return categories.map((category) => sums.get(category) ?? 0);
}

export function readStoredDataZoomWindow(host: HTMLElement, count: number): DataZoomWindow {
  const fromDom = parseHostWindow(host);
  return clampDataZoomWindow(fromDom ?? windows.get(host) ?? defaultDataZoomWindow(count), count);
}

export function writeStoredDataZoomWindow(host: HTMLElement, window: DataZoomWindow): void {
  windows.set(host, window);
  host.dataset.vsDataZoom = `${window.start},${window.end}`;
}

export function clearStoredDataZoomWindow(host: HTMLElement): void {
  windows.delete(host);
  delete host.dataset.vsDataZoom;
}

function parseHostWindow(host: HTMLElement): DataZoomWindow | undefined {
  const raw = host.dataset.vsDataZoom;
  if (!raw) return undefined;
  const [start, end] = raw.split(",").map(Number);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  return { start, end };
}

export function rowsInCategories<T extends { __category__?: unknown }>(
  rows: readonly T[],
  categories: readonly string[],
): T[] {
  const allowed = new Set(categories);
  return rows.filter((row) => allowed.has(String(row.__category__ ?? "")));
}
