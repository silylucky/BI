import { useCallback, useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { DATA_SCREEN_RULER_TICK_MAJOR } from "./canvasRulerUtils";
import { formatDesignCoord, screenToDesignCoord } from "./dataScreenRulerCrosshair";
import type { ViewportPan } from "./dataScreenViewportScroll";

export type CanvasRulerCrosshairProps = {
  wheelHostRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  pan: ViewportPan;
  offsetX: number;
  offsetY: number;
  scale: number;
  rulerSizePx: number;
};

type CrosshairState = {
  clientX: number;
  clientY: number;
  designX: number;
  designY: number;
} | null;

export function CanvasRulerCrosshair({
  wheelHostRef,
  viewportRef,
  pan,
  offsetX,
  offsetY,
  scale,
  rulerSizePx,
}: CanvasRulerCrosshairProps) {
  const [crosshair, setCrosshair] = useState<CrosshairState>(null);

  const updateCrosshair = useCallback(
    (clientX: number, clientY: number) => {
      const viewportEl = viewportRef.current;
      if (!viewportEl) {
        setCrosshair(null);
        return;
      }
      const rect = viewportEl.getBoundingClientRect();
      const design = screenToDesignCoord({
        clientX,
        clientY,
        viewportRect: rect,
        pan,
        offsetX,
        offsetY,
        scale,
      });
      if (!design) {
        setCrosshair(null);
        return;
      }
      setCrosshair({
        clientX,
        clientY,
        designX: design.x,
        designY: design.y,
      });
    },
    [viewportRef, pan, offsetX, offsetY, scale],
  );

  useEffect(() => {
    const host = wheelHostRef.current;
    if (!host) return undefined;

    const onPointerMove = (event: PointerEvent) => {
      updateCrosshair(event.clientX, event.clientY);
    };
    const onPointerLeave = () => setCrosshair(null);

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
    return () => {
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [wheelHostRef, updateCrosshair]);

  if (!crosshair) return null;

  const hostRect = wheelHostRef.current?.getBoundingClientRect();
  if (!hostRect) return null;

  const localX = crosshair.clientX - hostRect.left;
  const localY = crosshair.clientY - hostRect.top;
  const lineColor = DATA_SCREEN_RULER_TICK_MAJOR;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      <div
        className="absolute top-0 w-px"
        style={{
          left: localX,
          height: rulerSizePx,
          backgroundColor: lineColor,
        }}
        data-crosshair-x={Math.round(crosshair.designX)}
      />
      <div
        className="absolute left-0 h-px"
        style={{
          top: localY,
          width: rulerSizePx,
          backgroundColor: lineColor,
        }}
        data-crosshair-y={Math.round(crosshair.designY)}
      />
      <span
        className={cn(
          "absolute left-1 top-1 z-10 rounded px-1 py-0.5",
          "text-[9px] leading-none font-medium tabular-nums select-none",
        )}
        style={{ color: lineColor }}
        data-testid="canvas-ruler-crosshair-label"
      >
        {formatDesignCoord({ x: crosshair.designX, y: crosshair.designY })}
      </span>
    </div>
  );
}
