import { useCallback, useEffect, useRef, useState } from "react";
import {
  geometryCommitAffectsWidget,
  PIXEL_LAYOUT_GEOMETRY_COMMITTED,
  resolvePixelWidgetIdFromElement,
} from "@/components/dashboard/pixelCanvas/pixelShapeLiveResize";

type Size = { width: number; height: number };

function readLayoutSize(node: HTMLElement): Size {
  return {
    width: Math.round(node.clientWidth),
    height: Math.round(node.clientHeight),
  };
}

type UseElementSizeOptions = {
  enabled?: boolean;
  /** 合并连续尺寸变更，减轻拖拽缩放时图表逐帧重绘 */
  debounceMs?: number;
  /** 暂停上报尺寸（拖拽缩放中由 CSS 跟手，松手后自动补一次测量） */
  paused?: boolean;
};

/** 监听容器尺寸，供图表/表格随 widget 缩放自适应 */
export function useElementSize<T extends HTMLElement>(
  enabledOrOptions: boolean | UseElementSizeOptions = true,
): {
  ref: (node: T | null) => void;
  size: Size;
  remeasure: () => void;
} {
  const options =
    typeof enabledOrOptions === "boolean"
      ? { enabled: enabledOrOptions, debounceMs: 0, paused: false }
      : { enabled: true, debounceMs: 0, paused: false, ...enabledOrOptions };
  const { enabled = true, debounceMs = 0, paused = false } = options;

  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const ref = useCallback((next: T | null) => setNode(next), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!enabled || !node) return;

    const apply = () => {
      const next = readLayoutSize(node);
      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    const update = () => {
      if (pausedRef.current) return;
      if (debounceMs <= 0) {
        apply();
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (!pausedRef.current) apply();
      }, debounceMs);
    };

    apply();
    const ro = new ResizeObserver(() => update());
    ro.observe(node);
    return () => {
      ro.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, node, debounceMs]);

  useEffect(() => {
    if (!enabled || !node || paused) return;
    const next = readLayoutSize(node);
    setSize((prev) =>
      prev.width === next.width && prev.height === next.height ? prev : next,
    );
  }, [enabled, node, paused]);

  const remeasure = useCallback(() => {
    if (!node) return;
    const next = readLayoutSize(node);
    setSize((prev) =>
      prev.width === next.width && prev.height === next.height ? prev : next,
    );
  }, [node]);

  useEffect(() => {
    if (!enabled || !node) return;
    const remeasureOnCommit = (event: Event) => {
      const widgetId = resolvePixelWidgetIdFromElement(node);
      if (!geometryCommitAffectsWidget(event, widgetId)) return;
      remeasure();
    };
    document.addEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, remeasureOnCommit);
    return () => document.removeEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, remeasureOnCommit);
  }, [enabled, node, remeasure]);

  return { ref, size, remeasure };
}
