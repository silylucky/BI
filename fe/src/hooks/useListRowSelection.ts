import { useCallback, useEffect, useState } from "react";

/** 列表页多选：勾选行后批量删除 */
export function useListRowSelection(rowIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const valid = new Set(rowIds);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rowIds]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (rowIds.length > 0 && rowIds.every((id) => prev.has(id))) return new Set();
      return new Set(rowIds);
    });
  }, [rowIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.has(id));
  const someSelected = rowIds.some((id) => selected.has(id)) && !allSelected;

  return {
    selectedIds: selected,
    selectedCount: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
  };
}
