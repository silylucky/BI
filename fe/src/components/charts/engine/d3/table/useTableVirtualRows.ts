import { useMemo, useState, useEffect, type RefObject } from "react";
import { VCDS } from "@/components/charts/engine/d3/core/chartVisualTokens";

type UseTableVirtualRowsOptions = {
  rowCount: number;
  rowHeightPx: number;
  scrollTop: number;
  viewportHeight: number;
  enabled: boolean;
};

export function useTableVirtualRows({
  rowCount,
  rowHeightPx,
  scrollTop,
  viewportHeight,
  enabled,
}: UseTableVirtualRowsOptions) {
  return useMemo(() => {
    const threshold = VCDS.perf.tableVirtualScrollThreshold;
    if (!enabled || rowCount <= threshold) {
      return {
        start: 0,
        end: rowCount,
        offsetY: 0,
        totalHeight: rowCount * rowHeightPx,
        active: false,
      };
    }

    const overscan = 6;
    const start = Math.max(0, Math.floor(scrollTop / rowHeightPx) - overscan);
    const visible = Math.ceil(viewportHeight / rowHeightPx) + overscan * 2;
    const end = Math.min(rowCount, start + visible);

    return {
      start,
      end,
      offsetY: start * rowHeightPx,
      totalHeight: rowCount * rowHeightPx,
      active: true,
    };
  }, [enabled, rowCount, rowHeightPx, scrollTop, viewportHeight]);
}

export function useScrollTop(ref: RefObject<HTMLElement | null>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;

    const attach = () => {
      const el = ref.current;
      if (!el) {
        if (!cancelled) {
          requestAnimationFrame(attach);
        }
        return;
      }
      const onScroll = () => {
        setScrollTop(el.scrollTop);
        setViewportHeight(el.clientHeight);
      };
      onScroll();
      el.addEventListener("scroll", onScroll, { passive: true });
      const ro = new ResizeObserver(onScroll);
      ro.observe(el);
      detach = () => {
        el.removeEventListener("scroll", onScroll);
        ro.disconnect();
      };
    };

    attach();
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [ref]);

  return { scrollTop, viewportHeight };
}
