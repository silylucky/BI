import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataScreenEditViewport } from "./DataScreenEditViewport";

afterEach(() => cleanup());

function renderViewport(ui: ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe("DataScreenEditViewport blank selection", () => {
  it("calls onBlankPointerDown when clicking viewport letterbox", () => {
    const onBlankPointerDown = vi.fn();
    renderViewport(
      <DataScreenEditViewport
        canvasWidth={1920}
        canvasHeight={1080}
        onBlankPointerDown={onBlankPointerDown}
      >
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]" />
      </DataScreenEditViewport>,
    );

    const viewport = screen
      .getByTestId("data-screen-edit-viewport")
      .querySelector("[data-canvas-scale-viewport]") as HTMLElement;
    fireEvent.pointerDown(viewport);
    fireEvent.pointerUp(viewport);
    expect(onBlankPointerDown).toHaveBeenCalledTimes(1);
  });

  it("does not call onBlankPointerDown when clicking a pixel widget", () => {
    const onBlankPointerDown = vi.fn();
    renderViewport(
      <DataScreenEditViewport
        canvasWidth={1920}
        canvasHeight={1080}
        onBlankPointerDown={onBlankPointerDown}
      >
        <div className="pixel-shape-outer" data-testid="widget">
          <button type="button">主标题</button>
        </div>
      </DataScreenEditViewport>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "主标题" }));
    expect(onBlankPointerDown).not.toHaveBeenCalled();
  });

  it("calls onBlankPointerDown when clicking blank canvas stage", () => {
    const onBlankPointerDown = vi.fn();
    renderViewport(
      <DataScreenEditViewport
        canvasWidth={1920}
        canvasHeight={1080}
        onBlankPointerDown={onBlankPointerDown}
      >
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]" />
      </DataScreenEditViewport>,
    );

    fireEvent.pointerDown(screen.getByTestId("canvas-stage"));
    fireEvent.pointerUp(screen.getByTestId("canvas-stage"));
    expect(onBlankPointerDown).toHaveBeenCalledTimes(1);
  });

  it("updates design stage dimensions when canvas size changes", () => {
    const { rerender } = renderViewport(
      <DataScreenEditViewport canvasWidth={1920} canvasHeight={1080}>
        <div data-testid="canvas-stage" />
      </DataScreenEditViewport>,
    );

    const stage = screen.getByTestId("data-screen-canvas-stage");
    expect(stage).toHaveAttribute("data-canvas-design-width", "1920");
    expect(stage).toHaveAttribute("data-canvas-design-height", "1080");
    expect(stage).toHaveStyle({ width: "1920px", height: "1080px" });

    rerender(
      <TooltipProvider delayDuration={0}>
        <DataScreenEditViewport canvasWidth={2560} canvasHeight={1080}>
          <div data-testid="canvas-stage" />
        </DataScreenEditViewport>
      </TooltipProvider>,
    );

    expect(screen.getByTestId("data-screen-canvas-stage")).toHaveAttribute(
      "data-canvas-design-width",
      "2560",
    );
    expect(screen.getByTestId("data-screen-canvas-stage")).toHaveStyle({ width: "2560px" });
  });

  it("prevents browser zoom on ctrl+wheel over canvas viewport", () => {
    renderViewport(
      <DataScreenEditViewport canvasWidth={1920} canvasHeight={1080}>
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]" />
      </DataScreenEditViewport>,
    );

    const viewport = screen
      .getByTestId("data-screen-edit-viewport")
      .querySelector("[data-canvas-scale-viewport]") as HTMLElement;
    const event = new WheelEvent("wheel", {
      deltaY: -100,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefault = vi.spyOn(event, "preventDefault");
    viewport.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("zooms at pointer with pan compensation on ctrl+wheel", async () => {
    renderViewport(
      <DataScreenEditViewport canvasWidth={1920} canvasHeight={1080}>
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]" />
      </DataScreenEditViewport>,
    );

    const root = screen.getByTestId("data-screen-edit-viewport");
    const viewport = root.querySelector("[data-canvas-scale-viewport]") as HTMLElement;
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const event = new WheelEvent("wheel", {
      deltaY: -100,
      ctrlKey: true,
      clientX: 400,
      clientY: 300,
      bubbles: true,
      cancelable: true,
    });
    viewport.dispatchEvent(event);

    await waitFor(() => {
      expect(Number(root.getAttribute("data-user-zoom"))).toBeGreaterThan(1);
    });
  });

  it("does not pan the viewport when wheel is over a map zoom surface", () => {
    renderViewport(
      <DataScreenEditViewport canvasWidth={1920} canvasHeight={1080}>
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]">
          <div data-viz-wheel-zoom="true" data-testid="map-surface">
            <canvas />
          </div>
        </div>
      </DataScreenEditViewport>,
    );

    const root = screen.getByTestId("data-screen-edit-viewport");
    expect(root).toHaveAttribute("data-view-pan-y", "0");

    const mapSurface = screen.getByTestId("map-surface");
    const event = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });
    const preventDefault = vi.spyOn(event, "preventDefault");
    mapSurface.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(root).toHaveAttribute("data-view-pan-y", "0");
  });

  it("updates view pan while dragging with space held", async () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    renderViewport(
      <DataScreenEditViewport canvasWidth={1920} canvasHeight={1080}>
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]" />
      </DataScreenEditViewport>,
    );

    const root = screen.getByTestId("data-screen-edit-viewport");
    const viewport = root.querySelector("[data-canvas-scale-viewport]") as HTMLElement;
    const panLayer = viewport.firstElementChild as HTMLElement;

    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.pointerDown(viewport, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 100, pointerId: 1 });

    expect(root).toHaveAttribute("data-view-pan-x", "50");
    expect(panLayer.style.transform).toBe("translate(50px, 0px)");
    fireEvent.pointerUp(document, { clientX: 150, clientY: 100, pointerId: 1 });
    fireEvent.keyUp(window, { code: "Space" });
    raf.mockRestore();
  });

  it("does not pan the viewport when dragging blank canvas without space", () => {
    renderViewport(
      <DataScreenEditViewport canvasWidth={1920} canvasHeight={1080}>
        <div data-testid="canvas-stage" className="h-[1080px] w-[1920px]" />
      </DataScreenEditViewport>,
    );

    const root = screen.getByTestId("data-screen-edit-viewport");
    const stage = screen.getByTestId("canvas-stage");

    fireEvent.pointerDown(stage, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 200, clientY: 200, pointerId: 1 });

    expect(root).toHaveAttribute("data-view-pan-x", "0");
    expect(root).toHaveAttribute("data-view-pan-y", "0");
  });
});
