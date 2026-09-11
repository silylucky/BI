import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveCanvasRulerScrollOffset } from "./canvasRulerUtils";
import {
  clampViewportPan,
  computeViewportScrollMetrics,
  type ViewportPan,
} from "./dataScreenViewportScroll";
import {
  clampDataScreenUserZoom,
  DATA_SCREEN_ZOOM_WHEEL_STEP,
  stepDataScreenUserZoom,
} from "./dataScreenViewportZoom";
import { computePanForZoomAtPointer } from "./dataScreenViewportZoomAtPointer";
import {
  computePresentationTransform,
  resolveDataScreenEditViewportOffsets,
  type PresentationMode,
} from "./presentationScale";

export type UseDataScreenViewportStateOptions = {
  canvasWidth: number;
  canvasHeight: number;
  presentationMode: PresentationMode;
  viewportSize: { width: number; height: number };
};

export function useDataScreenViewportState({
  canvasWidth,
  canvasHeight,
  presentationMode,
  viewportSize,
}: UseDataScreenViewportStateOptions) {
  const [viewPan, setViewPan] = useState<ViewportPan>({ x: 0, y: 0 });
  const viewPanRef = useRef(viewPan);
  viewPanRef.current = viewPan;
  const [userZoom, setUserZoom] = useState(1);
  const userZoomRef = useRef(userZoom);
  userZoomRef.current = userZoom;
  const panCommitFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const resetPan = { x: 0, y: 0 };
    viewPanRef.current = resetPan;
    setViewPan(resetPan);
    setUserZoom(1);
    userZoomRef.current = 1;
  }, [canvasWidth, canvasHeight, presentationMode]);

  const baseTransform = useMemo(
    () =>
      computePresentationTransform(
        viewportSize.width,
        viewportSize.height,
        canvasWidth,
        canvasHeight,
        presentationMode,
      ),
    [viewportSize.width, viewportSize.height, canvasWidth, canvasHeight, presentationMode],
  );

  const scale = baseTransform.scaleX * userZoom;
  const scaledWidth = canvasWidth * scale;
  const scaledHeight = canvasHeight * scale;
  const { offsetX, offsetY } = resolveDataScreenEditViewportOffsets();

  const rulerOffsetX = resolveCanvasRulerScrollOffset(viewPan.x, offsetX);
  const rulerOffsetY = resolveCanvasRulerScrollOffset(viewPan.y, offsetY);

  const contentLayout = useMemo(
    () => ({ scaledWidth, scaledHeight, offsetX, offsetY }),
    [scaledWidth, scaledHeight, offsetX, offsetY],
  );

  const scrollMetrics = useMemo(
    () => computeViewportScrollMetrics(viewportSize, contentLayout, viewPan),
    [viewportSize, contentLayout, viewPan],
  );

  const boundsRef = useRef(scrollMetrics.bounds);
  boundsRef.current = scrollMetrics.bounds;

  useEffect(() => {
    setViewPan((previous) => {
      const clamped = clampViewportPan(previous, scrollMetrics.bounds);
      viewPanRef.current = clamped;
      return clamped;
    });
  }, [
    scrollMetrics.bounds.minPanX,
    scrollMetrics.bounds.maxPanX,
    scrollMetrics.bounds.minPanY,
    scrollMetrics.bounds.maxPanY,
    viewportSize.width,
    viewportSize.height,
    scale,
  ]);

  const commitPanState = useCallback((pan: ViewportPan) => {
    viewPanRef.current = pan;
    setViewPan(pan);
  }, []);

  const schedulePanStateCommit = useCallback(() => {
    if (panCommitFrameRef.current != null) return;
    panCommitFrameRef.current = window.requestAnimationFrame(() => {
      panCommitFrameRef.current = null;
      setViewPan({ ...viewPanRef.current });
    });
  }, []);

  const cancelPanStateCommit = useCallback(() => {
    if (panCommitFrameRef.current != null) {
      window.cancelAnimationFrame(panCommitFrameRef.current);
      panCommitFrameRef.current = null;
    }
  }, []);

  const applyPan = useCallback((next: ViewportPan | ((prev: ViewportPan) => ViewportPan)) => {
    setViewPan((previous) => {
      const resolved = typeof next === "function" ? next(previous) : next;
      const clamped = clampViewportPan(resolved, boundsRef.current);
      viewPanRef.current = clamped;
      return clamped;
    });
  }, []);

  const applyPanPatch = useCallback(
    (patch: { x?: number; y?: number }) => {
      applyPan((previous) => ({
        x: patch.x ?? previous.x,
        y: patch.y ?? previous.y,
      }));
    },
    [applyPan],
  );

  const applyPanImmediate = useCallback((pan: ViewportPan) => {
    const clamped = clampViewportPan(pan, boundsRef.current);
    viewPanRef.current = clamped;
    return clamped;
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    const clamped = clampDataScreenUserZoom(zoom);
    userZoomRef.current = clamped;
    setUserZoom(clamped);
  }, []);

  const handleZoomIn = useCallback(() => {
    setUserZoom((previous) => {
      const next = stepDataScreenUserZoom(previous, 1);
      userZoomRef.current = next;
      return next;
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setUserZoom((previous) => {
      const next = stepDataScreenUserZoom(previous, -1);
      userZoomRef.current = next;
      return next;
    });
  }, []);

  const resetViewport = useCallback(() => {
    userZoomRef.current = 1;
    setUserZoom(1);
    const resetPan = { x: 0, y: 0 };
    viewPanRef.current = resetPan;
    setViewPan(resetPan);
    return resetPan;
  }, []);

  const applyWheelZoom = useCallback(
    (pointerX: number, pointerY: number, direction: 1 | -1, deltaY?: number) => {
      const result = computeWheelZoomAtPointer({
        pointerX,
        pointerY,
        pan: viewPanRef.current,
        offsetX,
        offsetY,
        baseScale: baseTransform.scaleX,
        userZoom: userZoomRef.current,
        direction,
        deltaY,
        bounds: boundsRef.current,
      });
      if (!result) {
        return { zoom: userZoomRef.current, pan: viewPanRef.current };
      }
      viewPanRef.current = result.pan;
      userZoomRef.current = result.zoom;
      setUserZoom(result.zoom);
      setViewPan(result.pan);
      return result;
    },
    [offsetX, offsetY, baseTransform.scaleX],
  );

  const previewWheelZoom = useCallback(
    (pointerX: number, pointerY: number, direction: 1 | -1, deltaY?: number) => {
      const result = computeWheelZoomAtPointer({
        pointerX,
        pointerY,
        pan: viewPanRef.current,
        offsetX,
        offsetY,
        baseScale: baseTransform.scaleX,
        userZoom: userZoomRef.current,
        direction,
        deltaY,
        bounds: boundsRef.current,
      });
      if (!result) {
        return { zoom: userZoomRef.current, pan: viewPanRef.current };
      }
      viewPanRef.current = result.pan;
      userZoomRef.current = result.zoom;
      return result;
    },
    [offsetX, offsetY, baseTransform.scaleX],
  );

  const commitWheelZoomState = useCallback(() => {
    setUserZoom(userZoomRef.current);
    setViewPan({ ...viewPanRef.current });
  }, []);

  const applyWheelPan = useCallback(
    (deltaX: number, deltaY: number) => {
      const clamped = applyPanImmediate({
        x: viewPanRef.current.x - deltaX,
        y: viewPanRef.current.y - deltaY,
      });
      schedulePanStateCommit();
      return clamped;
    },
    [applyPanImmediate, schedulePanStateCommit],
  );

  return {
    viewPan,
    userZoom,
    viewPanRef,
    scale,
    baseTransform,
    scaledWidth,
    scaledHeight,
    offsetX,
    offsetY,
    rulerOffsetX,
    rulerOffsetY,
    scrollMetrics,
    boundsRef,
    commitPanState,
    schedulePanStateCommit,
    cancelPanStateCommit,
    applyPan,
    applyPanPatch,
    applyPanImmediate,
    handleZoomChange,
    handleZoomIn,
    handleZoomOut,
    resetViewport,
    applyWheelZoom,
    previewWheelZoom,
    commitWheelZoomState,
    applyWheelPan,
  };
}

export function computeWheelZoomAtPointer(input: {
  pointerX: number;
  pointerY: number;
  pan: ViewportPan;
  offsetX: number;
  offsetY: number;
  baseScale: number;
  userZoom: number;
  direction: 1 | -1;
  deltaY?: number;
  bounds: ReturnType<typeof computeViewportScrollMetrics>["bounds"];
}): { zoom: number; pan: ViewportPan } | null {
  const previousZoom = input.userZoom;
  const newZoom =
    input.deltaY != null
      ? clampDataScreenUserZoom(previousZoom * Math.exp(-input.deltaY * 0.002))
      : clampDataScreenUserZoom(
          previousZoom + input.direction * DATA_SCREEN_ZOOM_WHEEL_STEP,
        );
  if (newZoom === previousZoom) {
    return null;
  }
  const newPan = computePanForZoomAtPointer({
    pointerX: input.pointerX,
    pointerY: input.pointerY,
    pan: input.pan,
    offsetX: input.offsetX,
    offsetY: input.offsetY,
    baseScale: input.baseScale,
    oldZoom: previousZoom,
    newZoom,
  });
  return {
    zoom: newZoom,
    pan: clampViewportPan(newPan, input.bounds),
  };
}
