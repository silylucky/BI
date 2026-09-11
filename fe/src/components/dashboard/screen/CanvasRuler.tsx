import { useMemo, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  buildCanvasRulerTicks,
  CANVAS_RULER_SIZE_PX,
  DATA_SCREEN_RULER_LABEL,
  DATA_SCREEN_RULER_TICK_MAJOR,
  DATA_SCREEN_RULER_TICK_MICRO,
  DATA_SCREEN_RULER_TICK_MINOR,
  type CanvasRulerTick,
  type CanvasRulerTickKind,
} from "./canvasRulerUtils";
import { canvasRulerSurfaceClass } from "./canvasRulerChrome";

export type CanvasRulerProps = {
  orientation: "horizontal" | "vertical";
  designLength: number;
  scale: number;
  scrollOffsetPx: number;
  viewportPx: number;
  className?: string;
};

const TICK_LENGTH: Record<CanvasRulerTickKind, number> = {
  major: 10,
  minor: 7,
  micro: 4,
};

const TICK_COLOR: Record<CanvasRulerTickKind, string> = {
  major: DATA_SCREEN_RULER_TICK_MAJOR,
  minor: DATA_SCREEN_RULER_TICK_MINOR,
  micro: DATA_SCREEN_RULER_TICK_MICRO,
};

/** 靠原点一侧的刻度数字改右/下对齐，避免被角块裁切 */
const ORIGIN_LABEL_INSET_PX = CANVAS_RULER_SIZE_PX - 4;

function RulerTick({
  tick,
  orientation,
}: {
  tick: CanvasRulerTick;
  orientation: CanvasRulerProps["orientation"];
}) {
  const isHorizontal = orientation === "horizontal";
  const tickLen = TICK_LENGTH[tick.kind];
  const nearOrigin = tick.positionPx < ORIGIN_LABEL_INSET_PX;

  if (isHorizontal) {
    return (
      <div
        className="pointer-events-none absolute bottom-0"
        style={{ left: tick.positionPx, transform: nearOrigin ? undefined : "translateX(-50%)" }}
      >
        <div
          className="w-px"
          style={{ height: tickLen, backgroundColor: TICK_COLOR[tick.kind] }}
          aria-hidden
        />
        {tick.showLabel ? (
          <span
            className={cn(
              "absolute bottom-[12px] whitespace-nowrap text-[8px] leading-none font-medium tabular-nums select-none",
              nearOrigin ? "left-0" : "left-1/2 -translate-x-1/2",
            )}
            style={{ color: DATA_SCREEN_RULER_LABEL }}
          >
            {tick.value}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute right-0"
      style={{ top: tick.positionPx, transform: nearOrigin ? undefined : "translateY(-50%)" }}
    >
      <div
        className="h-px"
        style={{ width: tickLen, backgroundColor: TICK_COLOR[tick.kind] }}
        aria-hidden
      />
      {tick.showLabel ? (
        <span
          className={cn(
            "absolute whitespace-nowrap text-[8px] leading-none font-medium tabular-nums select-none",
            nearOrigin
              ? "top-0 right-[4px] text-right"
              : "top-1/2 right-[12px] -translate-y-1/2 text-right",
          )}
          style={{ color: DATA_SCREEN_RULER_LABEL }}
        >
          {tick.value}
        </span>
      ) : null}
    </div>
  );
}

export function CanvasRuler({
  orientation,
  designLength,
  scale,
  scrollOffsetPx,
  viewportPx,
  className,
}: CanvasRulerProps) {
  const ticks = useMemo(
    () => buildCanvasRulerTicks(designLength, scale, scrollOffsetPx, viewportPx),
    [designLength, scale, scrollOffsetPx, viewportPx],
  );
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      data-testid={`canvas-ruler-${orientation}`}
      className={cn(
        canvasRulerSurfaceClass,
        isHorizontal
          ? "h-[var(--canvas-ruler-size)]"
          : "w-[var(--canvas-ruler-size)]",
        className,
      )}
      style={{ "--canvas-ruler-size": `${CANVAS_RULER_SIZE_PX}px` } as CSSProperties}
      aria-hidden
    >
      {ticks.map((tick) => (
        <RulerTick key={`${tick.kind}-${tick.value}`} tick={tick} orientation={orientation} />
      ))}
    </div>
  );
}
