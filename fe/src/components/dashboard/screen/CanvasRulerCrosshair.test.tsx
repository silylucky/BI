import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasRulerCrosshair } from "./CanvasRulerCrosshair";

afterEach(() => cleanup());

describe("CanvasRulerCrosshair", () => {
  it("updates crosshair attributes on pointer move over viewport", () => {
    const wheelHostRef = { current: null as HTMLDivElement | null };
    const viewportRef = { current: null as HTMLDivElement | null };

    render(
      <div ref={wheelHostRef} data-testid="wheel-host" style={{ width: 400, height: 300 }}>
        <div
          ref={viewportRef}
          data-testid="viewport"
          style={{ width: 300, height: 200, marginLeft: 28, marginTop: 28 }}
        />
        <CanvasRulerCrosshair
          wheelHostRef={wheelHostRef}
          viewportRef={viewportRef}
          pan={{ x: 0, y: 0 }}
          offsetX={0}
          offsetY={0}
          scale={1}
          rulerSizePx={28}
        />
      </div>,
    );

    const viewport = screen.getByTestId("viewport");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 28,
      top: 28,
      width: 300,
      height: 200,
      right: 328,
      bottom: 228,
      x: 28,
      y: 28,
      toJSON: () => ({}),
    });
    vi.spyOn(screen.getByTestId("wheel-host"), "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(screen.getByTestId("wheel-host"), { clientX: 128, clientY: 78 });

    const crosshairX = document.querySelector("[data-crosshair-x]");
    expect(crosshairX).toBeTruthy();
    expect(crosshairX?.getAttribute("data-crosshair-x")).toBe("100");
    expect(screen.getByTestId("canvas-ruler-crosshair-label")).toHaveTextContent("100, 50");
  });
});
