import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  clampWidgetEditRailLeftRatio,
  readStoredWidgetEditRailLeftRatio,
  WIDGET_EDIT_RAIL_RESIZE_HANDLE_PX,
  writeStoredWidgetEditRailLeftRatio,
} from "./widgetEditRailSplit";

export function useWidgetEditRailSplit(containerRef: RefObject<HTMLElement | null>) {
  const [leftRatio, setLeftRatio] = useState(readStoredWidgetEditRailLeftRatio);
  const leftRatioRef = useRef(leftRatio);
  leftRatioRef.current = leftRatio;

  useEffect(() => {
    writeStoredWidgetEditRailLeftRatio(leftRatio);
  }, [leftRatio]);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const handle = event.currentTarget;
      const container = containerRef.current;
      if (!container) return;

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startRatio = leftRatioRef.current;
      const containerWidth = container.getBoundingClientRect().width;
      const trackWidth = Math.max(containerWidth - WIDGET_EDIT_RAIL_RESIZE_HANDLE_PX, 1);

      handle.setPointerCapture(pointerId);

      const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const deltaRatio = (moveEvent.clientX - startX) / trackWidth;
        const next = clampWidgetEditRailLeftRatio(startRatio + deltaRatio, containerWidth);
        setLeftRatio(next);
      };

      const onPointerUp = (upEvent: globalThis.PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        if (handle.hasPointerCapture(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [containerRef],
  );

  return { leftRatio, onResizePointerDown };
}
