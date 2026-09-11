import { useCallback, useEffect, useMemo, useState } from "react";

/** 列表默认每页条数（10 的倍数） */
export const LIST_PAGE_SIZE_DEFAULT = 20;

/** 列表每页条数选项（统一 10 的倍数） */
export const LIST_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

export type ListPaginationState = {
  page: number;
  pageSize: number;
  offset: number;
  onPageChange: (page: number, pageSize?: number) => void;
  resetPage: () => void;
};

export function useListPagination(
  pageSizeDefault = LIST_PAGE_SIZE_DEFAULT,
  resetDeps: unknown[] = [],
): ListPaginationState {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when filter deps change
  }, resetDeps);

  const onPageChange = useCallback((nextPage: number, nextSize?: number) => {
    if (nextSize !== undefined && nextSize !== pageSize) {
      setPageSize(nextSize);
      setPage(1);
      return;
    }
    setPage(nextPage);
  }, [pageSize]);

  const resetPage = useCallback(() => setPage(1), []);

  return useMemo(
    () => ({
      page,
      pageSize,
      offset: (page - 1) * pageSize,
      onPageChange,
      resetPage,
    }),
    [page, pageSize, onPageChange, resetPage],
  );
}

/** 对已加载列表做前端分页切片（API 无 limit/offset 时使用） */
export function sliceListPage<T>(items: T[], offset: number, pageSize: number): T[] {
  return items.slice(offset, offset + pageSize);
}

export type PaginationRange = {
  current: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
};

/** 计算当前页展示区间（1-based，含端点） */
export function getPaginationRange(
  current: number,
  pageSize: number,
  total: number,
): PaginationRange {
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
  const safeCurrent = Math.min(Math.max(1, current), totalPages);
  if (total <= 0) {
    return {
      current: safeCurrent,
      pageSize,
      total: 0,
      totalPages: 1,
      start: 0,
      end: 0,
    };
  }
  const start = (safeCurrent - 1) * pageSize + 1;
  const end = Math.min(safeCurrent * pageSize, total);
  return { current: safeCurrent, pageSize, total, totalPages, start, end };
}
