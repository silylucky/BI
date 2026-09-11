import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { CanvasRuler } from "./CanvasRuler";
import {
  canvasRulerChromeVars,
  canvasRulerCornerClass,
  canvasRulerCornerStyle,
  CanvasRulerCornerMark,
} from "./canvasRulerChrome";
import { CANVAS_RULER_SIZE_PX, DATA_SCREEN_VIEWPORT_BG } from "./canvasRulerUtils";
import {
  applyViewportPanTranslate,
  type ViewportPanSession,
} from "./dataScreenViewportPan";
import { isPixelCanvasWidgetTarget } from "../pixelCanvas/pixelCanvasHitTest";
import { shouldDelegateWheelFromCanvasHost } from "../pixelCanvas/pixelCanvasWheelScroll";
import {
  applyViewportPanLayerTransform,
  hasExceededPanClickThreshold,
} from "./viewportPanLayer";
import {
  DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
  type PresentationMode,
} from "./presentationScale";
import { CanvasScaleArea } from "./CanvasScaleArea";
import { DataScreenVisualScaleProvider } from "./dataScreenVisualScaleContext";
import {
  CanvasViewportScrollbarHorizontal,
  CanvasViewportScrollbarVertical,
  canvasViewportScrollbarStyle,
} from "./CanvasViewportScrollbars";
import { clampViewportPan, CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX } from "./dataScreenViewportScroll";
import { useDataScreenViewportState } from "./useDataScreenViewportState";

export type DataScreenEditViewportProps = {
  canvasWidth: number;
  canvasHeight: number;
  presentationMode?: PresentationMode;
  className?: string;
  /** 点击视口留白或画布非组件区域时（如取消选中、回到大屏配置） */
  onBlankPointerDown?: () => void;
  children: ReactNode;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function DataScreenEditViewport({
  canvasWidth,
  canvasHeight,
  presentationMode = DATA_SCREEN_EDIT_PRESENTATION_DEFAULT,
  className,
  onBlankPointerDown,
  children,
}: DataScreenEditViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const wheelHostRef = useRef<HTMLDivElement>(null);
  const panLayerRef = useRef<HTMLDivElement>(null);
  const spacePanRef = useRef(false);
  const panSessionRef = useRef<ViewportPanSession | null>(null);
  const panMovedRef = useRef(false);
  const blankClickSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const onBlankPointerDownRef = useRef(onBlankPointerDown);
  onBlankPointerDownRef.current = onBlankPointerDown;
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [spacePan, setSpacePan] = useState(false);
  const [panDragging, setPanDragging] = useState(false);

  const viewport = useDataScreenViewportState({
    canvasWidth,
    canvasHeight,
    presentationMode,
    viewportSize,
  });

  const {
    viewPan,
    userZoom,
    viewPanRef,
    scale,
    baseTransform,
    offsetX,
    offsetY,
    rulerOffsetX,
    rulerOffsetY,
    scrollMetrics,
    boundsRef,
    commitPanState,
    schedulePanStateCommit,
    cancelPanStateCommit,
    applyPanPatch,
    handleZoomChange,
    handleZoomIn,
    handleZoomOut,
    resetViewport,
    applyWheelZoom,
    previewWheelZoom,
    commitWheelZoomState,
    applyWheelPan,
  } = viewport;

  const stageRef = useRef<HTMLDivElement>(null);
  const wheelZoomRafRef = useRef<number | null>(null);

  const syncStageTransform = useCallback(
    (nextUserZoom: number) => {
      const el = stageRef.current;
      if (!el) return;
      el.style.transform = `scale(${baseTransform.scaleX * nextUserZoom})`;
    },
    [baseTransform.scaleX],
  );

  const scheduleWheelZoomStateCommit = useCallback(() => {
    if (wheelZoomRafRef.current != null) return;
    wheelZoomRafRef.current = window.requestAnimationFrame(() => {
      wheelZoomRafRef.current = null;
      commitWheelZoomState();
    });
  }, [commitWheelZoomState]);

  const offsetXRef = useRef(offsetX);
  const offsetYRef = useRef(offsetY);
  offsetXRef.current = offsetX;
  offsetYRef.current = offsetY;

  const syncPanLayer = useCallback((pan: { x: number; y: number }) => {
    applyViewportPanLayerTransform(
      panLayerRef.current,
      offsetXRef.current,
      offsetYRef.current,
      pan,
    );
  }, []);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewportSize({ width, height });
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    syncPanLayer(viewPan);
  }, [viewPan.x, viewPan.y, offsetX, offsetY, syncPanLayer]);

  const endPanSession = useCallback(() => {
    const session = panSessionRef.current;
    panSessionRef.current = null;
    setPanDragging(false);
    if (session) {
      commitPanState(viewPanRef.current);
    }
    panMovedRef.current = false;
  }, [commitPanState, viewPanRef]);

  const isPanEligibleTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    const viewportEl = viewportRef.current;
    if (!viewportEl?.contains(target)) return false;
    if (isEditableTarget(target)) return false;
    if (isPixelCanvasWidgetTarget(target)) return false;
    if (
      target instanceof Element &&
      (target.closest("[data-canvas-scale-area]") ||
        target.closest("[data-testid^='canvas-scrollbar-']"))
    ) {
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    const releaseSpacePan = () => {
      spacePanRef.current = false;
      setSpacePan(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isEditableTarget(event.target)) return;
      event.preventDefault();
      spacePanRef.current = true;
      setSpacePan(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      releaseSpacePan();
    };

    const onPointerMove = (event: PointerEvent) => {
      const session = panSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      event.preventDefault();
      if (
        !panMovedRef.current &&
        hasExceededPanClickThreshold(session.startX, session.startY, event.clientX, event.clientY)
      ) {
        panMovedRef.current = true;
      }
      const next = applyViewportPanTranslate(session, event.clientX, event.clientY);
      const clamped = clampViewportPan({ x: next.panX, y: next.panY }, boundsRef.current);
      viewPanRef.current = clamped;
      syncPanLayer(clamped);
      schedulePanStateCommit();
    };

    const releasePointerCapture = (event: PointerEvent) => {
      const viewportEl = viewportRef.current;
      if (viewportEl?.hasPointerCapture(event.pointerId)) {
        viewportEl.releasePointerCapture(event.pointerId);
      }
    };

    const finishBlankClickSession = (event: PointerEvent) => {
      const session = blankClickSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      blankClickSessionRef.current = null;
      if (
        !hasExceededPanClickThreshold(
          session.startX,
          session.startY,
          event.clientX,
          event.clientY,
        )
      ) {
        onBlankPointerDownRef.current?.();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      finishBlankClickSession(event);
      const session = panSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      releasePointerCapture(event);
      endPanSession();
    };

    const onPointerDown = (event: PointerEvent) => {
      const middleMouse = event.button === 1;
      const spaceLeft = event.button === 0 && spacePanRef.current;
      const blankClick =
        event.button === 0 && !spacePanRef.current && isPanEligibleTarget(event.target);
      if (!middleMouse && !spaceLeft) {
        if (blankClick) {
          blankClickSessionRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
          };
        }
        return;
      }

      const viewportEl = viewportRef.current;
      if (!viewportEl) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        viewportEl.setPointerCapture(event.pointerId);
      } catch {
        // jsdom / legacy browsers
      }
      panMovedRef.current = false;
      panSessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: viewPanRef.current.x,
        panY: viewPanRef.current.y,
      };
      setPanDragging(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseSpacePan);
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { capture: true });
    document.addEventListener("pointerup", onPointerEnd, { capture: true });
    document.addEventListener("pointercancel", onPointerEnd, { capture: true });
    document.addEventListener("lostpointercapture", onPointerEnd, { capture: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseSpacePan);
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", onPointerEnd, { capture: true });
      document.removeEventListener("pointercancel", onPointerEnd, { capture: true });
      document.removeEventListener("lostpointercapture", onPointerEnd, { capture: true });
    };
  }, [endPanSession, isPanEligibleTarget, schedulePanStateCommit, syncPanLayer, boundsRef, viewPanRef]);

  useEffect(() => {
    const wheelHost = wheelHostRef.current;
    if (!wheelHost) return undefined;

    const onWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !wheelHost.contains(target)) return;

      const onCanvasViewport = viewportRef.current?.contains(target) ?? false;
      const isZoomGesture = event.ctrlKey || event.metaKey;

      if (isZoomGesture) {
        if (event.cancelable) event.preventDefault();
        if (!onCanvasViewport || !viewportRef.current) return;
        const rect = viewportRef.current.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const direction = event.deltaY > 0 ? -1 : 1;
        const result = previewWheelZoom(
          pointerX,
          pointerY,
          direction as 1 | -1,
          event.deltaY,
        );
        if (result) {
          syncStageTransform(result.zoom);
          syncPanLayer(result.pan);
          scheduleWheelZoomStateCommit();
        }
        return;
      }

      if (!onCanvasViewport) return;
      if (!isZoomGesture && shouldDelegateWheelFromCanvasHost(wheelHost, event, target)) {
        return;
      }

      if (event.deltaX === 0 && event.deltaY === 0) return;
      if (event.cancelable) event.preventDefault();
      const clamped = applyWheelPan(event.deltaX, event.deltaY);
      syncPanLayer(clamped);
    };

    wheelHost.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      wheelHost.removeEventListener("wheel", onWheel, { capture: true });
      cancelPanStateCommit();
      if (wheelZoomRafRef.current != null) {
        window.cancelAnimationFrame(wheelZoomRafRef.current);
        wheelZoomRafRef.current = null;
      }
    };
  }, [
    applyWheelPan,
    syncPanLayer,
    cancelPanStateCommit,
    previewWheelZoom,
    syncStageTransform,
    scheduleWheelZoomStateCommit,
  ]);

  const handleResetViewport = useCallback(() => {
    const resetPan = resetViewport();
    syncPanLayer(resetPan);
    syncStageTransform(1);
  }, [resetViewport, syncPanLayer, syncStageTransform]);

  useLayoutEffect(() => {
    syncStageTransform(userZoom);
  }, [userZoom, syncStageTransform]);

  const stageStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    transformOrigin: "top left",
  };

  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      data-testid="data-screen-edit-viewport"
      data-presentation-mode={presentationMode}
      data-user-zoom={userZoom.toFixed(3)}
      data-space-pan={spacePan ? "true" : undefined}
      data-view-pan-x={viewPan.x}
      data-view-pan-y={viewPan.y}
    >
      <div
        ref={wheelHostRef}
        className="relative grid min-h-0 flex-1"
        style={
          {
            ...canvasViewportScrollbarStyle(),
            ...canvasRulerChromeVars(),
            gridTemplateColumns: `${CANVAS_RULER_SIZE_PX}px minmax(0, 1fr) ${CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX}px`,
            gridTemplateRows: `${CANVAS_RULER_SIZE_PX}px minmax(0, 1fr) ${CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX}px`,
          } as CSSProperties
        }
      >
        <div className={canvasRulerCornerClass} style={canvasRulerCornerStyle} aria-hidden>
          <CanvasRulerCornerMark />
        </div>
        <CanvasRuler
          orientation="horizontal"
          designLength={canvasWidth}
          scale={scale}
          scrollOffsetPx={rulerOffsetX}
          viewportPx={viewportSize.width}
        />
        <div
          className="bg-[#0d1117]"
          style={{ width: CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX, height: CANVAS_RULER_SIZE_PX }}
          aria-hidden
        />
        <CanvasRuler
          orientation="vertical"
          designLength={canvasHeight}
          scale={scale}
          scrollOffsetPx={rulerOffsetY}
          viewportPx={viewportSize.height}
        />
        <div
          ref={viewportRef}
          className={cn(
            "relative min-h-0 min-w-0 overflow-hidden",
            spacePan && "cursor-grab",
            panDragging && "cursor-grabbing",
          )}
          style={{ backgroundColor: DATA_SCREEN_VIEWPORT_BG }}
          data-canvas-scale-viewport
        >
          <div
            ref={panLayerRef}
            className="absolute top-0 left-0 will-change-transform"
          >
            <div
              ref={stageRef}
              className={cn("origin-top-left", (spacePan || panDragging) && "pointer-events-none")}
              data-testid="data-screen-canvas-stage"
              data-canvas-design-width={canvasWidth}
              data-canvas-design-height={canvasHeight}
              style={stageStyle}
            >
              <DataScreenVisualScaleProvider liveScale={scale}>
                {children}
              </DataScreenVisualScaleProvider>
            </div>
          </div>
          <CanvasScaleArea
            userZoom={userZoom}
            designCanvasWidth={canvasWidth}
            designCanvasHeight={canvasHeight}
            spacePanActive={spacePan}
            onZoomChange={handleZoomChange}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetViewport={handleResetViewport}
          />
        </div>
        <CanvasViewportScrollbarVertical
          metrics={scrollMetrics.vertical}
          bounds={scrollMetrics.bounds}
          onPanChange={applyPanPatch}
        />
        <div
          className="bg-[#0d1117]"
          style={{ width: CANVAS_RULER_SIZE_PX, height: CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX }}
          aria-hidden
        />
        <CanvasViewportScrollbarHorizontal
          metrics={scrollMetrics.horizontal}
          bounds={scrollMetrics.bounds}
          onPanChange={applyPanPatch}
        />
        <div
          className="bg-[#0d1117]"
          style={{
            width: CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX,
            height: CANVAS_VIEWPORT_SCROLLBAR_SIZE_PX,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
