/** 图表视口观测根：优先 closest(selector)，普通像素画布回退到滚动宿主 */
export function resolveViewportObserverRoot(
  node: Element,
  rootSelector?: string,
): Element | null {
  if (rootSelector) {
    const closestNamed = node.closest(rootSelector);
    if (closestNamed) return closestNamed;
  }
  return (
    node.closest(".pixel-canvas-host") ??
    node.closest("[data-testid='pixel-canvas-host']") ??
    node.closest(".dashboard-grid-edit") ??
    (rootSelector ? document.querySelector(rootSelector) : null)
  );
}
