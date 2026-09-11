import { useEffect, useState, type RefObject } from "react";

export type TableScrollEdges = {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
};

const INITIAL: TableScrollEdges = { left: false, right: false, top: false, bottom: false };

export function useTableScrollEdges(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const [edges, setEdges] = useState<TableScrollEdges>(INITIAL);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;
      setEdges({
        left: scrollLeft > 1,
        right: scrollLeft + clientWidth < scrollWidth - 1,
        top: scrollTop > 1,
        bottom: scrollTop + clientHeight < scrollHeight - 1,
      });
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [ref, ...deps]);

  return edges;
}
