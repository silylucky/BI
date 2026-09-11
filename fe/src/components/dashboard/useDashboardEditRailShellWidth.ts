import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  readStoredDashboardEditRailWidth,
  resolveDashboardEditRailWidthOnDrag,
  writeStoredDashboardEditRailWidth,
} from "./dashboardEditRailLayout";

export function useDashboardEditRailShellWidth() {
  const [railWidthPx, setRailWidthPx] = useState(readStoredDashboardEditRailWidth);
  const railWidthRef = useRef(railWidthPx);
  railWidthRef.current = railWidthPx;

  useEffect(() => {
    writeStoredDashboardEditRailWidth(railWidthPx);
  }, [railWidthPx]);

  const onShellResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = railWidthRef.current;

    handle.setPointerCapture(pointerId);

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = moveEvent.clientX - startX;
      const next = resolveDashboardEditRailWidthOnDrag(startWidth, delta, window.innerWidth);
      setRailWidthPx(next);
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
  }, []);

  return { railWidthPx, onShellResizePointerDown };
}
