import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveCanvasRulerScrollOffset } from "./canvasRulerUtils";
import { useDataScreenViewportState } from "./useDataScreenViewportState";

describe("useDataScreenViewportState", () => {
  const baseOptions = {
    canvasWidth: 1920,
    canvasHeight: 1080,
    presentationMode: "fitWidth" as const,
    viewportSize: { width: 960, height: 540 },
  };

  it("starts with zero pan and unit zoom", () => {
    const { result } = renderHook(() => useDataScreenViewportState(baseOptions));
    expect(result.current.viewPan).toEqual({ x: 0, y: 0 });
    expect(result.current.userZoom).toBe(1);
  });

  it("resets pan and zoom when canvas size changes", () => {
    const { result, rerender } = renderHook(
      (props) => useDataScreenViewportState(props),
      { initialProps: baseOptions },
    );

    act(() => {
      result.current.applyPan({ x: 100, y: 50 });
      result.current.handleZoomChange(1.5);
    });
    expect(result.current.viewPan.x).toBeGreaterThan(0);

    rerender({ ...baseOptions, canvasWidth: 2560 });
    expect(result.current.viewPan).toEqual({ x: 0, y: 0 });
    expect(result.current.userZoom).toBe(1);
  });

  it("computes ruler offsets from pan", () => {
    const { result } = renderHook(() => useDataScreenViewportState(baseOptions));
    act(() => {
      result.current.applyPan({ x: 80, y: 40 });
    });
    expect(result.current.rulerOffsetX).toBe(
      resolveCanvasRulerScrollOffset(80, result.current.offsetX),
    );
    expect(result.current.rulerOffsetY).toBe(
      resolveCanvasRulerScrollOffset(40, result.current.offsetY),
    );
  });

  it("resetViewport restores defaults", () => {
    const { result } = renderHook(() => useDataScreenViewportState(baseOptions));
    act(() => {
      result.current.applyPan({ x: 120, y: 60 });
      result.current.handleZoomIn();
    });
    act(() => {
      result.current.resetViewport();
    });
    expect(result.current.viewPan).toEqual({ x: 0, y: 0 });
    expect(result.current.userZoom).toBe(1);
  });

  it("applyWheelZoom adjusts pan for pointer anchor", () => {
    const { result } = renderHook(() => useDataScreenViewportState(baseOptions));
    let wheelResult: { zoom: number; pan: { x: number; y: number } } | undefined;
    act(() => {
      wheelResult = result.current.applyWheelZoom(200, 150, 1);
    });
    expect(wheelResult?.zoom).toBeGreaterThan(1);
    expect(wheelResult?.pan).toBeDefined();
  });
});
