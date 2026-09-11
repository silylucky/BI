/** 事件目标是否落在点阵组件 shape 内（含拖拽手柄、操作栏等子节点）。 */
export function isPixelCanvasWidgetTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".pixel-shape-outer"));
}
