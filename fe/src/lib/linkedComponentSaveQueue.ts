/** Tracks in-flight linked component library writes so dashboard save can await them. */

import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import type { VizComponentMap } from "@/lib/resolveVizComponent";
import type { VizComponentPayload } from "@/lib/vizComponents";
import { pushWidgetPayloadToLibrary } from "@/lib/vizComponentEdit";

const inFlight = new Map<string, Promise<unknown>>();

export function queueLinkedComponentPush(
  widget: LayoutWidget,
  componentMap: VizComponentMap,
  payload: VizComponentPayload,
): Promise<unknown> {
  const ref = widget.componentRef;
  const componentId = ref && "componentId" in ref ? ref.componentId : widget.id;
  const previous = inFlight.get(componentId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => pushWidgetPayloadToLibrary(widget, componentMap, payload));
  inFlight.set(componentId, next);
  void next.finally(() => {
    if (inFlight.get(componentId) === next) {
      inFlight.delete(componentId);
    }
  });
  return next;
}

export async function awaitLinkedComponentWrites(): Promise<void> {
  if (inFlight.size === 0) return;
  await Promise.all([...inFlight.values()]);
}

export function clearLinkedComponentWriteQueueForTests(): void {
  inFlight.clear();
}
