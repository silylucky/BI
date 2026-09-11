/** 对标 DataEase debounceRender（文档参考）；isPlayer 引擎 resize 在松手后触发 */
export const PIXEL_LIVE_RESIZE_DEBOUNCE_MS = 32;

export const PIXEL_SHAPE_LIVE_RESIZE = "pixel-shape-live-resize";
export const PIXEL_LAYOUT_GEOMETRY_COMMITTED = "pixel-layout-geometry-committed";

export type PixelLayoutGeometryCommittedDetail = {
  /** 宽/高变化的组件 id；必须非空才派发（禁止全画布广播） */
  widgetIds?: string[];
};

export function dispatchPixelShapeLiveResize() {
  document.dispatchEvent(new CustomEvent(PIXEL_SHAPE_LIVE_RESIZE));
}

/**
 * 像素布局几何已提交；仅对列出的组件补测。
 * 省略 / 空数组均不派发，避免「未碰也刷新」。
 */
export function dispatchPixelLayoutGeometryCommitted(widgetIds?: readonly string[]) {
  if (!widgetIds || widgetIds.length === 0) return;
  const detail: PixelLayoutGeometryCommittedDetail = {
    widgetIds: [...widgetIds],
  };
  document.dispatchEvent(
    new CustomEvent<PixelLayoutGeometryCommittedDetail>(PIXEL_LAYOUT_GEOMETRY_COMMITTED, {
      detail,
    }),
  );
}

export function resolvePixelWidgetIdFromElement(el: Element | null | undefined): string | null {
  if (!el) return null;
  const host = el.closest("[data-component-id]");
  return host?.getAttribute("data-component-id") ?? null;
}

/** 事件是否应触发该组件的 commit resize（fail-closed） */
export function geometryCommitAffectsWidget(
  event: Event,
  widgetId: string | null | undefined,
): boolean {
  const detail = (event as CustomEvent<PixelLayoutGeometryCommittedDetail>).detail;
  const ids = detail?.widgetIds;
  if (!ids?.length) return false;
  if (!widgetId) return false;
  return ids.includes(widgetId);
}

type GeometryWidget = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 比较提交前后外框，仅宽/高变化的组件需要补测重绘（纯位移/碰撞推位不触发） */
export function collectGeometryChangedWidgetIds(
  before: readonly GeometryWidget[],
  after: readonly GeometryWidget[],
  alwaysInclude?: string,
): string[] {
  const prevById = new Map(before.map((item) => [item.id, item]));
  const changed: string[] = [];
  for (const next of after) {
    const prev = prevById.get(next.id);
    if (!prev || prev.width !== next.width || prev.height !== next.height) {
      changed.push(next.id);
    }
  }
  if (alwaysInclude) {
    const prev = prevById.get(alwaysInclude);
    const next = after.find((item) => item.id === alwaysInclude);
    const sizeChanged =
      !prev ||
      !next ||
      prev.width !== next.width ||
      prev.height !== next.height;
    if (sizeChanged && !changed.includes(alwaysInclude)) {
      changed.push(alwaysInclude);
    }
  }
  return changed;
}
