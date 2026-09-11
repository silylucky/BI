import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { mapApiError } from "@/lib/apiError";
import type { VizComponentMap } from "@/lib/resolveVizComponent";
import {
  pushWidgetPayloadToLibrary,
  relinkWidgetToComponent,
} from "@/lib/vizComponentEdit";
import {
  collectComponentIds,
  extractWidgetPayload,
  isLinkedComponentRef,
  patchVizComponentResolveCache,
  type VizComponentPayload,
} from "@/lib/vizComponents";

type UseVizComponentInspectorActionsArgs = {
  primarySelectedId: string | null;
  selectedWidget: LayoutWidget | null;
  resolvedSelectedWidget: LayoutWidget | null;
  widgets: LayoutWidget[];
  componentMap: VizComponentMap;
  setWidgets: React.Dispatch<React.SetStateAction<LayoutWidget[]>>;
  refetchComponents: () => void | Promise<unknown>;
};

export function useVizComponentInspectorActions({
  primarySelectedId,
  selectedWidget,
  resolvedSelectedWidget,
  widgets,
  componentMap,
  setWidgets,
  refetchComponents,
}: UseVizComponentInspectorActionsArgs) {
  const linkedComponentIds = collectComponentIds(widgets);
  const queryClient = useQueryClient();
  const [pushing, setPushing] = useState(false);

  const detach = useCallback(
    (detached: LayoutWidget) => {
      if (!primarySelectedId) return;
      setWidgets((prev) => prev.map((w) => (w.id === primarySelectedId ? detached : w)));
    },
    [primarySelectedId, setWidgets],
  );

  const relink = useCallback(() => {
    const componentId = selectedWidget?.componentRef?.componentId;
    if (!primarySelectedId || !componentId) return;
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === primarySelectedId ? relinkWidgetToComponent(w, componentId) : w,
      ),
    );
  }, [primarySelectedId, selectedWidget?.componentRef?.componentId, setWidgets]);

  const pushToLibrary = useCallback(async () => {
    if (!selectedWidget || !resolvedSelectedWidget) return;
    setPushing(true);
    try {
      const updated = await pushWidgetPayloadToLibrary(
        selectedWidget,
        componentMap,
        extractWidgetPayload(resolvedSelectedWidget),
      );
      if (updated) {
        patchVizComponentResolveCache(queryClient, linkedComponentIds, updated);
      }
      toast.success("已更新到组件库");
      await refetchComponents();
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setPushing(false);
    }
  }, [componentMap, linkedComponentIds, queryClient, refetchComponents, resolvedSelectedWidget, selectedWidget]);

  const applyPayloadChange = useCallback(
    async (_payload: VizComponentPayload, localPatch: Partial<LayoutWidget>) => {
      if (!primarySelectedId || !selectedWidget) return;
      setWidgets((prev) =>
        prev.map((w) => (w.id === primarySelectedId ? { ...w, ...localPatch } : w)),
      );
    },
    [primarySelectedId, selectedWidget, setWidgets],
  );

  return { pushing, detach, relink, pushToLibrary, applyPayloadChange };
}
