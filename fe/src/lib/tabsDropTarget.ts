/** 从拖放事件解析落点下的 Tab 容器 id（穿透 shape 拖移边带等遮挡层） */
export function readTabsWidgetIdFromDropEvent(
  event: Pick<DragEvent, "clientX" | "clientY">,
): string | null {
  const stack =
    typeof document.elementsFromPoint === "function"
      ? document.elementsFromPoint(event.clientX, event.clientY)
      : [document.elementFromPoint(event.clientX, event.clientY)].filter(Boolean);
  for (const node of stack) {
    const host = (node as Element).closest?.("[data-tabs-widget-id]");
    const id = host?.getAttribute("data-tabs-widget-id");
    if (id) return id;
  }
  return null;
}
