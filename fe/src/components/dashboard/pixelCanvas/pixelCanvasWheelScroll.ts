/** 地图等组件用滚轮缩放时，画布不得拦截（见 data-viz-wheel-zoom） */
export const VIZ_WHEEL_ZOOM_SURFACE_ATTR = "data-viz-wheel-zoom";

export function isInsideWheelZoomSurface(
  start: EventTarget | null,
  host: HTMLElement,
): boolean {
  let node = start instanceof Node ? start : null;
  while (node && node !== host) {
    if (node instanceof HTMLElement && node.getAttribute(VIZ_WHEEL_ZOOM_SURFACE_ATTR) === "true") {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** 从事件目标向上查找首个可纵向滚动的内层容器（不含画布 host） */
export function findVerticalScrollable(
  start: EventTarget | null,
  host: HTMLElement,
): HTMLElement | null {
  let node = start instanceof Node ? start : null;
  while (node && node !== host) {
    if (node instanceof HTMLElement) {
      const { overflowY } = getComputedStyle(node);
      if (
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
        node.scrollHeight > node.clientHeight + 1
      ) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function isAtTop(element: HTMLElement): boolean {
  return element.scrollTop <= 0;
}

function isAtBottom(element: HTMLElement): boolean {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
}

/**
 * 画布是否应将滚轮交给内层组件（地图缩放面、可滚动表格等），而非平移/缩放画布。
 */
export function shouldDelegateWheelFromCanvasHost(
  host: HTMLElement,
  event: WheelEvent,
  target: EventTarget | null = event.target,
): boolean {
  if (event.defaultPrevented) return true;
  if (isInsideWheelZoomSurface(target, host)) return true;

  const deltaY = normalizeWheelDeltaY(event, host);
  if (deltaY === 0) return false;

  const inner = findVerticalScrollable(target, host);
  if (!inner) return false;

  return (deltaY < 0 && !isAtTop(inner)) || (deltaY > 0 && !isAtBottom(inner));
}

export function normalizeWheelDeltaY(
  event: WheelEvent,
  scrollContainer: Pick<HTMLElement, "clientHeight">,
): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * scrollContainer.clientHeight;
  }
  return event.deltaY;
}

/**
 * 将滚轮路由到 pixel-canvas-host：
 * - 内层仍可滚时交给内层
 * - 内层到顶/底或不存在内层时滚动画布（编辑态组件上滚轮不会丢失）
 */
export function routePixelCanvasWheel(
  host: HTMLElement,
  event: WheelEvent,
  target: EventTarget | null = event.target,
): boolean {
  if (shouldDelegateWheelFromCanvasHost(host, event, target)) return false;

  const deltaY = normalizeWheelDeltaY(event, host);
  if (deltaY === 0) return false;

  const maxScrollTop = Math.max(0, host.scrollHeight - host.clientHeight);
  const nextScrollTop = Math.max(0, Math.min(maxScrollTop, host.scrollTop + deltaY));
  if (nextScrollTop === host.scrollTop) return false;

  event.preventDefault();
  host.scrollTop = nextScrollTop;
  return true;
}

/** @deprecated 使用 routePixelCanvasWheel */
export function chainPixelCanvasWheelScroll(
  host: HTMLElement,
  event: WheelEvent,
  target?: EventTarget | null,
): boolean {
  return routePixelCanvasWheel(host, event, target ?? event.target);
}
