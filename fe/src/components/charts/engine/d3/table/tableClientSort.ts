import { useCallback, useMemo, useState } from "react";

export type TableSortState = {
  field: string;
  direction: "asc" | "desc";
} | null;

function isNumericValue(raw: unknown): boolean {
  if (raw == null || raw === "") return false;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n);
}

export function compareCellValues(a: unknown, b: unknown): number {
  const aEmpty = a == null || a === "";
  const bEmpty = b == null || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (isNumericValue(a) && isNumericValue(b)) {
    return Number(String(a).replace(/,/g, "")) - Number(String(b).replace(/,/g, ""));
  }

  return String(a).localeCompare(String(b), "zh-CN", { numeric: true, sensitivity: "base" });
}

export function sortTableRows(
  rows: unknown[][],
  columns: string[],
  sort: TableSortState,
): unknown[][] {
  if (!sort) return rows;
  const idx = columns.indexOf(sort.field);
  if (idx < 0) return rows;

  const sorted = [...rows];
  sorted.sort((rowA, rowB) => {
    const cmp = compareCellValues(rowA[idx], rowB[idx]);
    return sort.direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export function toggleTableSort(prev: TableSortState, field: string): TableSortState {
  if (prev?.field !== field) return { field, direction: "asc" };
  if (prev.direction === "asc") return { field, direction: "desc" };
  return null;
}

export function useTableClientSort() {
  const [sort, setSort] = useState<TableSortState>(null);
  const toggle = useCallback((field: string) => {
    setSort((prev) => toggleTableSort(prev, field));
  }, []);
  const reset = useCallback(() => setSort(null), []);
  return useMemo(() => ({ sort, toggle, reset }), [reset, sort, toggle]);
}
