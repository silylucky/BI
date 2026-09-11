import { useCallback, useMemo, useState } from "react";

export function useWidgetSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const handleSelect = useCallback((widgetId: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      if (shiftKey) {
        const next = new Set(prev);
        if (next.has(widgetId)) next.delete(widgetId);
        else next.add(widgetId);
        return next;
      }
      if (prev.size === 1 && prev.has(widgetId)) return prev;
      return new Set([widgetId]);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const removeFromSelection = useCallback((ids: Iterable<string>) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const pruneMissing = useCallback((validIds: string[]) => {
    const valid = new Set(validIds);
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, []);

  const primarySelectedId = useMemo(
    () => (selectedIds.size === 1 ? [...selectedIds][0] : null),
    [selectedIds],
  );

  return {
    selectedIds,
    primarySelectedId,
    handleSelect,
    clearSelection,
    removeFromSelection,
    pruneMissing,
  };
}
