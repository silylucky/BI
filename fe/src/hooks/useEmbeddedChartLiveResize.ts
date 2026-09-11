import { useCallback, useEffect, useRef, type RefObject } from "react";
import { usePixelShapePlayer } from "@/components/dashboard/pixelCanvas/pixelShapePlayerContext";
import {
  geometryCommitAffectsWidget,
  PIXEL_LAYOUT_GEOMETRY_COMMITTED,
  resolvePixelWidgetIdFromElement,
} from "@/components/dashboard/pixelCanvas/pixelShapeLiveResize";
import { usePixelShapeLiveResize } from "@/hooks/usePixelShapeLiveResize";

/**
 * 看板内嵌图表尺寸同步（对标 DataEase isPlayer §4.2）：
 * - 交互期：live event → rAF 合帧 → 引擎 changeSize（真实比例，禁止 canvas CSS 拉伸）
 * - 松手：geometry committed 同步 remeasure，再清 isPlayer（仅几何变化的组件）
 * - isPlayer 期间跳过 ResizeObserver（防双路）
 */
export function useEmbeddedChartLiveResize(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onLiveResize: () => void,
  onCommitResize?: () => void,
) {
  const playing = usePixelShapePlayer();
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const onLiveRef = useRef(onLiveResize);
  onLiveRef.current = onLiveResize;
  const onCommitRef = useRef(onCommitResize ?? onLiveResize);
  onCommitRef.current = onCommitResize ?? onLiveResize;
  const resizeFrameRef = useRef<number | null>(null);
  const flushingRef = useRef(false);
  const commitRetryRef = useRef(0);
  const lastObservedSizeRef = useRef(new WeakMap<HTMLElement, { width: number; height: number }>());

  const runLiveResize = useCallback(() => {
    if (resizeFrameRef.current !== null) return;
    resizeFrameRef.current = requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      onLiveRef.current();
    });
  }, []);

  const flushCommitResize = useCallback(() => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const el = containerRef.current;
      if (!el) return;
      const hasSize =
        (el.clientWidth > 0 && el.clientHeight > 0) ||
        (el.closest(".pixel-shape-outer")?.clientWidth ?? 0) > 0;
      if (!hasSize && commitRetryRef.current < 2) {
        commitRetryRef.current += 1;
        requestAnimationFrame(() => {
          flushingRef.current = false;
          flushCommitResize();
        });
        return;
      }
      commitRetryRef.current = 0;
      onCommitRef.current();
    } finally {
      flushingRef.current = false;
    }
  }, [containerRef]);

  usePixelShapeLiveResize(enabled, runLiveResize);

  const runResizeFromObserver = useCallback(() => {
    if (playingRef.current) return;
    const hosts: HTMLElement[] = [];
    const el = containerRef.current;
    if (el) hosts.push(el);
    const shapeOuter = el?.closest(".shape, .pixel-shape-outer");
    const shapeInner = el?.closest(".pixel-shape-inner");
    if (shapeOuter instanceof HTMLElement) hosts.push(shapeOuter);
    if (shapeInner instanceof HTMLElement) hosts.push(shapeInner);
    const seen = lastObservedSizeRef.current;
    let sizeChanged = false;
    for (const host of hosts) {
      const next = { width: host.clientWidth, height: host.clientHeight };
      const prev = seen.get(host);
      if (!prev || prev.width !== next.width || prev.height !== next.height) {
        seen.set(host, next);
        sizeChanged = true;
      }
    }
    if (!sizeChanged) return;
    runLiveResize();
  }, [containerRef, runLiveResize]);

  useEffect(() => {
    if (!enabled) return;
    const onGeometryCommitted = (event: Event) => {
      const widgetId = resolvePixelWidgetIdFromElement(containerRef.current);
      if (!geometryCommitAffectsWidget(event, widgetId)) return;
      flushCommitResize();
    };
    document.addEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, onGeometryCommitted);
    return () => document.removeEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, onGeometryCommitted);
  }, [enabled, containerRef, flushCommitResize]);

  // 松手补测仅由 geometry-committed（且仅宽高变化的组件）触发；
  // 勿在 playing→false 时全量 flush，否则纯移动也会重绘。

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const hosts = new Set<HTMLElement>([el]);
    const shapeOuter = el.closest(".shape, .pixel-shape-outer");
    const shapeInner = el.closest(".pixel-shape-inner");
    if (shapeOuter instanceof HTMLElement) hosts.add(shapeOuter);
    if (shapeInner instanceof HTMLElement) hosts.add(shapeInner);

    const observer = new ResizeObserver(() => {
      runResizeFromObserver();
    });
    for (const host of hosts) observer.observe(host);
    runResizeFromObserver();

    return () => {
      observer.disconnect();
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [containerRef, enabled, runResizeFromObserver]);

  return flushCommitResize;
}
