import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX,
  panFromHorizontalScroll,
  panFromVerticalScroll,
  type ViewportPanBounds,
  type ViewportScrollAxisMetrics,
} from "./dataScreenViewportScroll";

export { CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX };

/** 水平滑块相对轨道左缘的内边距（与编辑视口预览对齐） */
const HORIZONTAL_THUMB_LEFT_INSET_PX = 13;
/** 水平滑块垂直偏移：相对轨道顶边略上移以居中细条 */
const HORIZONTAL_THUMB_TOP_PX = -7;

type ScrollbarAxisProps = {
  orientation: "horizontal" | "vertical";
  metrics: ViewportScrollAxisMetrics;
  bounds: ViewportPanBounds;
  onPanChange: (pan: { x?: number; y?: number }) => void;
  className?: string;
};

function ScrollbarAxis({
  orientation,
  metrics,
  bounds,
  onPanChange,
  className,
}: ScrollbarAxisProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isHorizontal = orientation === "horizontal";

  const resolveScrollOffset = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return metrics.scrollOffset;
      const rect = track.getBoundingClientRect();
      const trackSize = isHorizontal ? rect.width : rect.height;
      const maxScroll = Math.max(0, metrics.scrollSize - metrics.clientSize);
      if (maxScroll <= 0) return 0;

      const thumbSize = Math.max(24, trackSize * (metrics.clientSize / metrics.scrollSize));
      const travel = Math.max(1, trackSize - thumbSize);
      const pointer = isHorizontal ? clientX - rect.left : clientY - rect.top;
      const ratio = Math.min(1, Math.max(0, (pointer - thumbSize / 2) / travel));
      return ratio * maxScroll;
    },
    [isHorizontal, metrics.clientSize, metrics.scrollOffset, metrics.scrollSize],
  );

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!metrics.canScroll) return;
    event.preventDefault();
    const scrollOffset = resolveScrollOffset(event.clientX, event.clientY);
    onPanChange(
      isHorizontal
        ? { x: panFromHorizontalScroll(scrollOffset, bounds) }
        : { y: panFromVerticalScroll(scrollOffset, bounds) },
    );
  };

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!metrics.canScroll) return;
    event.preventDefault();
    event.stopPropagation();

    const track = trackRef.current;
    if (!track) return;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom / legacy browsers
    }

    const rect = track.getBoundingClientRect();
    const trackSize = isHorizontal ? rect.width : rect.height;
    const maxScroll = Math.max(0, metrics.scrollSize - metrics.clientSize);
    const thumbSize = Math.max(24, trackSize * (metrics.clientSize / metrics.scrollSize));
    const travel = Math.max(1, trackSize - thumbSize);
    const startPointer = isHorizontal ? event.clientX : event.clientY;
    const startScroll = metrics.scrollOffset;

    const onMove = (moveEvent: PointerEvent) => {
      const pointer = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const delta = pointer - startPointer;
      const nextScroll = Math.min(maxScroll, Math.max(0, startScroll + (delta / travel) * maxScroll));
      onPanChange(
        isHorizontal
          ? { x: panFromHorizontalScroll(nextScroll, bounds) }
          : { y: panFromVerticalScroll(nextScroll, bounds) },
      );
    };

    const thumbEl = event.currentTarget;
    const pointerId = event.pointerId;

    const onUp = () => {
      if (thumbEl.hasPointerCapture(pointerId)) {
        thumbEl.releasePointerCapture(pointerId);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const maxScroll = Math.max(0, metrics.scrollSize - metrics.clientSize);
  const thumbSizePercent = Math.min(100, (metrics.clientSize / metrics.scrollSize) * 100);
  const thumbOffsetPercent =
    maxScroll > 0 ? (metrics.scrollOffset / maxScroll) * (100 - thumbSizePercent) : 0;

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-orientation={isHorizontal ? "horizontal" : "vertical"}
      aria-hidden={!metrics.canScroll}
      data-testid={isHorizontal ? "canvas-scrollbar-horizontal" : "canvas-scrollbar-vertical"}
      data-can-scroll={metrics.canScroll ? "true" : "false"}
      className={cn(
        "relative shrink-0 bg-[#0d1117]",
        isHorizontal ? "h-[var(--canvas-scrollbar-size)]" : "w-[var(--canvas-scrollbar-size)]",
        className,
      )}
      onPointerDown={handleTrackPointerDown}
    >
      {metrics.canScroll ? (
        <div
          className={cn(
            "absolute rounded-full bg-white/20 transition-colors hover:bg-white/30",
            isHorizontal ? "h-1.5" : "left-1/2 w-1.5 -translate-x-1/2",
          )}
          style={
            isHorizontal
              ? {
                  width: `${thumbSizePercent}%`,
                  left: `calc(${thumbOffsetPercent}% + ${HORIZONTAL_THUMB_LEFT_INSET_PX}px)`,
                  top: HORIZONTAL_THUMB_TOP_PX,
                }
              : { height: `${thumbSizePercent}%`, top: `${thumbOffsetPercent}%` }
          }
          onPointerDown={handleThumbPointerDown}
        />
      ) : null}
    </div>
  );
}

type CanvasViewportScrollbarsProps = {
  horizontal: ViewportScrollAxisMetrics;
  vertical: ViewportScrollAxisMetrics;
  bounds: ViewportPanBounds;
  onPanChange: (pan: { x?: number; y?: number }) => void;
};

export function CanvasViewportScrollbarHorizontal(props: Omit<ScrollbarAxisProps, "orientation">) {
  return <ScrollbarAxis orientation="horizontal" {...props} />;
}

export function CanvasViewportScrollbarVertical(props: Omit<ScrollbarAxisProps, "orientation">) {
  return <ScrollbarAxis orientation="vertical" {...props} />;
}

export function canvasViewportScrollbarStyle(): CSSProperties {
  return {
    "--canvas-scrollbar-size": `${CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX}px`,
  } as CSSProperties;
}
