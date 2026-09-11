import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { endPaletteDragSession } from "@/lib/paletteDragSession";
import type { DashboardLayoutV2, LayoutWidget, PixelLayoutWidget } from "../layoutUtils";
import { PIXEL_CANVAS_GUTTER, PIXEL_PREVIEW_THROTTLE_MS } from "./pixelCanvasHost";
import { PixelCanvas } from "./PixelCanvas";
import {
  insertClonedPixelWidget,
  insertPixelPaletteWidget,
  placeClonedPixelWidget,
} from "./createPixelWidget";
import { layoutsOverlap } from "./collisionLayout";
import { PIXEL_LAYOUT_GEOMETRY_COMMITTED } from "./pixelShapeLiveResize";
import { usePixelLayoutHistory } from "./usePixelLayoutHistory";

const widget: PixelLayoutWidget = {
  id: "w1",
  type: "chart",
  title: "图表",
  order: 3,
  x: 100,
  y: 80,
  width: 300,
  height: 200,
};

const layout: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1440, height: 900 },
  widgets: [widget],
  globalFilters: [{ id: "region" }],
};

afterEach(() => {
  cleanup();
  endPaletteDragSession();
});

function triggerResizeObservers() {
  (
    globalThis as typeof globalThis & {
      __triggerResizeObservers: () => void;
    }
  ).__triggerResizeObservers();
}

async function flushPixelPointerFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) =>
      setTimeout(resolve, PIXEL_PREVIEW_THROTTLE_MS + 8),
    );
  });
}

async function pinPixelHostMetrics(width = 1440, height = 900) {
  const host = screen.getByTestId("pixel-canvas-host");
  Object.defineProperties(host, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: height,
    left: 0,
    right: width,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  await act(async () => {
    triggerResizeObservers();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  expect(host).toHaveAttribute("data-pixel-canvas-scale", "1");
}

function wrapTooltipProvider(children: ReactNode) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}

function renderPixelCanvas(ui: ReactElement) {
  return render(wrapTooltipProvider(ui));
}

function rerenderPixelCanvas(rerender: (ui: React.ReactNode) => void, ui: ReactElement) {
  rerender(wrapTooltipProvider(ui));
}

async function renderCanvas(mode: "edit" | "view", onLayoutChange = vi.fn()) {
  renderPixelCanvas(
    <PixelCanvas
      mode={mode}
      layout={layout}
      selectedIds={new Set(["w1"])}
      onLayoutChange={onLayoutChange}
      renderWidget={(item) => <button data-pixel-no-drag>{item.title}</button>}
    />,
  );
  await pinPixelHostMetrics();
  return onLayoutChange;
}

describe("PixelCanvas", () => {
  it("previews DE collision reflow on neighbors while dragging", async () => {
    const blocker: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下方",
      order: 2,
      x: 100,
      y: 280,
      width: 300,
      height: 200,
    };
    const stackedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [widget, blocker],
    };
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={stackedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    const shape = screen.getByTestId("pixel-shape-w1");
    const blockerShape = screen.getByTestId("pixel-shape-w2");
    expect(blockerShape).toHaveStyle({ top: "280px" });

    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 3,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 3,
      clientX: 0,
      clientY: 120,
    });
    await flushPixelPointerFrames();

    expect(blockerShape.style.width).not.toBe("");
    expect(blockerShape.style.height).not.toBe("");
    expect(blockerShape).not.toHaveStyle({ top: "280px" });
    fireEvent.pointerUp(shape, { pointerId: 3, clientX: 0, clientY: 120 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(layoutsOverlap(onChange.mock.calls[0][0], 0)).toBe(false);
    expect(onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w2")).toMatchObject({
      y: 0,
    });
  });

  it("does not reflow neighbors on data-screen while dragging", async () => {
    const blocker: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下方",
      order: 2,
      x: 100,
      y: 280,
      width: 300,
      height: 200,
    };
    const stackedLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
      widgets: [widget, blocker],
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={stackedLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const shape = screen.getByTestId("pixel-shape-w1");
    const blockerShape = screen.getByTestId("pixel-shape-w2");
    expect(blockerShape).toHaveStyle({ top: "280px" });

    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 5,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 5,
      clientX: 0,
      clientY: 120,
    });
    await flushPixelPointerFrames();

    expect(blockerShape).toHaveStyle({ top: "280px" });
    fireEvent.pointerUp(shape, { pointerId: 5, clientX: 0, clientY: 120 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w2")).toMatchObject({
      y: 280,
    });
    expect(layoutsOverlap(onChange.mock.calls[0][0], 0)).toBe(true);
  });

  it("clamps move to bottom canvas bound on data-screen", async () => {
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={dataScreenLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 12,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 12,
      clientX: 0,
      clientY: 5000,
    });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, {
      pointerId: 12,
      clientX: 0,
      clientY: 5000,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const moved = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(moved?.y).toBeLessThanOrEqual(1080 - widget.height);
    expect(moved?.y).toBe(880);
  });

  it("keeps resized widget geometry after data-screen resize commit", async () => {
    const sibling: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "邻块",
      order: 2,
      x: 500,
      y: 80,
      width: 300,
      height: 200,
    };
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
      widgets: [widget, sibling],
    };
    let currentLayout = dataScreenLayout;
    const onChange = vi.fn((next: DashboardLayoutV2) => {
      currentLayout = next;
    });
    const { rerender } = renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={currentLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );
    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.pointerDown(handle, {
      pointerId: 21,
      clientX: 400,
      clientY: 280,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 21, clientX: 420, clientY: 300 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 21, clientX: 420, clientY: 300 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(resized).toMatchObject({ width: 320, height: 220 });

    rerenderPixelCanvas(rerender, <PixelCanvas
        mode="edit"
        layout={currentLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );

    const shape = screen.getByTestId("pixel-shape-w1");
    expect(shape).toHaveStyle({ width: "320px", height: "220px" });
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();

    const blockerShape = screen.getByTestId("pixel-shape-w2");
    expect(blockerShape).toHaveStyle({ width: "300px", height: "200px" });
    expect(screen.getByTestId("widget-body-w2")).toBeInTheDocument();
  });

  it("keeps data-screen outer geometry after resize commit without parent rerender", async () => {
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={dataScreenLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );
    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.pointerDown(handle, {
      pointerId: 31,
      clientX: 400,
      clientY: 280,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 31, clientX: 420, clientY: 300 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 31, clientX: 420, clientY: 300 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find(
      (item: PixelLayoutWidget) => item.id === "w1",
    )!;
    expect(resized).toMatchObject({ width: 320, height: 220 });

    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    const shape = screen.getByTestId("pixel-shape-w1");
    expect(shape).toHaveStyle({
      left: `${resized.x}px`,
      top: `${resized.y}px`,
      width: `${resized.width}px`,
      height: `${resized.height}px`,
    });
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();
  });

  it("shows data-screen widget geometry on first paint without host metrics pin", () => {
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
    };
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={dataScreenLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={vi.fn()}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );
    const shape = screen.getByTestId("pixel-shape-w1");
    expect(shape).toHaveStyle({
      left: `${widget.x}px`,
      top: `${widget.y}px`,
      width: `${widget.width}px`,
      height: `${widget.height}px`,
    });
    expect(screen.getByTestId("pixel-canvas-content")).toHaveStyle({
      width: "1920px",
      height: "1080px",
    });
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();
  });

  it("keeps all data-screen widgets visible after resize commit", async () => {
    const peer: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "图表二",
      order: 2,
      x: 520,
      y: 220,
      width: 320,
      height: 220,
    };
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      widgets: [widget, peer],
      styleConfig: { surfaceKind: "data-screen" },
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={dataScreenLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );
    const shape = screen.getByTestId("pixel-shape-w1");
    const peerShape = screen.getByTestId("pixel-shape-w2");
    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.pointerDown(handle, {
      pointerId: 41,
      clientX: 400,
      clientY: 280,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 41, clientX: 440, clientY: 310 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 41, clientX: 440, clientY: 310 });

    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    expect(screen.getByTestId("pixel-canvas-content")).toHaveStyle({
      width: "1920px",
      height: "1080px",
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find(
      (item: PixelLayoutWidget) => item.id === "w1",
    )!;
    expect(shape).toHaveStyle({
      left: `${resized.x}px`,
      top: `${resized.y}px`,
      width: `${resized.width}px`,
      height: `${resized.height}px`,
    });
    expect(peerShape).toHaveStyle({
      left: `${peer.x}px`,
      top: `${peer.y}px`,
      width: `${peer.width}px`,
      height: `${peer.height}px`,
    });
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();
    expect(screen.getByTestId("widget-body-w2")).toBeInTheDocument();
  });

  it("keeps data-screen stage height after resize commit without parent rerender", async () => {
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={dataScreenLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );
    const stage = screen.getByTestId("pixel-canvas-stage");
    const host = screen.getByTestId("pixel-canvas-host");
    expect(stage).toHaveStyle({ width: "1920px", height: "1080px" });

    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.pointerDown(handle, {
      pointerId: 51,
      clientX: 400,
      clientY: 280,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 51, clientX: 440, clientY: 310 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 51, clientX: 440, clientY: 310 });

    expect(onChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    expect(stage).toHaveStyle({ width: "1920px", height: "1080px" });
    expect(host).not.toHaveAttribute("data-pixel-canvas-playing");
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();
  });

  it("keeps data-screen outer geometry after drag commit without parent rerender", async () => {
    const dataScreenLayout: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1920, height: 1080 },
      styleConfig: { surfaceKind: "data-screen" },
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={dataScreenLayout}
        styleConfig={{ surfaceKind: "data-screen" }}
        designViewportLocked
        viewportFit="data-screen"
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span data-testid={`widget-body-${item.id}`}>{item.title}</span>}
      />,
    );
    const shape = screen.getByTestId("pixel-shape-w1");
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 32,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 32, clientX: 120, clientY: 80 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(shape, { pointerId: 32, clientX: 120, clientY: 80 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const moved = onChange.mock.calls[0][0].widgets.find(
      (item: PixelLayoutWidget) => item.id === "w1",
    )!;
    expect(moved.x).toBeGreaterThan(widget.x);
    expect(moved.y).toBeGreaterThan(widget.y);

    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    expect(shape).toHaveStyle({
      left: `${moved.x}px`,
      top: `${moved.y}px`,
      width: `${moved.width}px`,
      height: `${moved.height}px`,
    });
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();
  });

  it("applies DE reflow to neighbors on pointer up after resize", async () => {
    const blocker: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下方",
      order: 2,
      x: 100,
      y: 280,
      width: 300,
      height: 200,
    };
    const stackedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [widget, blocker],
    };
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={stackedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    const shape = screen.getByTestId("pixel-shape-w1");
    const blockerShape = screen.getByTestId("pixel-shape-w2");
    const handle = screen.getByLabelText("调整组件大小：右下");
    expect(blockerShape).toHaveStyle({ top: "280px" });

    fireEvent.pointerDown(handle, {
      pointerId: 4,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 4, clientX: 0, clientY: 1 });
    fireEvent.pointerMove(document, { pointerId: 4, clientX: 0, clientY: 120 });
    await flushPixelPointerFrames();

    expect(blockerShape).not.toHaveStyle({ top: "280px" });
    fireEvent.pointerUp(shape, { pointerId: 4, clientX: 0, clientY: 120 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(layoutsOverlap(onChange.mock.calls[0][0], 0)).toBe(false);
    expect(onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w2")).toMatchObject({
      y: 400,
    });
  });

  it("keeps all widgets visible on canvas after resize commit with neighbor reflow", async () => {
    const blocker: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下方",
      order: 2,
      x: 100,
      y: 280,
      width: 300,
      height: 200,
    };
    const stackedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [widget, blocker],
    };
    let currentLayout = stackedLayout;
    const onChange = vi.fn((next: DashboardLayoutV2) => {
      currentLayout = next;
    });
    const { rerender } = renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={currentLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => (
          <span data-testid={`widget-body-${item.id}`}>{item.title}</span>
        )}
      />,
    );
    await pinPixelHostMetrics();
    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.pointerDown(handle, {
      pointerId: 44,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 44, clientX: 0, clientY: 120 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(screen.getByTestId("pixel-shape-w1"), {
      pointerId: 44,
      clientX: 0,
      clientY: 120,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    rerenderPixelCanvas(rerender, <PixelCanvas
        mode="edit"
        layout={currentLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => (
          <span data-testid={`widget-body-${item.id}`}>{item.title}</span>
        )}
      />,
    );
    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    const w1 = currentLayout.widgets.find((item) => item.id === "w1")!;
    const w2 = currentLayout.widgets.find((item) => item.id === "w2")!;
    const shape1 = screen.getByTestId("pixel-shape-w1");
    const shape2 = screen.getByTestId("pixel-shape-w2");
    expect(shape1).toHaveStyle({
      top: `${w1.y}px`,
      left: `${w1.x}px`,
      width: `${w1.width}px`,
      height: `${w1.height}px`,
    });
    expect(shape2).toHaveStyle({
      top: `${w2.y}px`,
      left: `${w2.x}px`,
      width: `${w2.width}px`,
      height: `${w2.height}px`,
    });
    expect(screen.getByTestId("widget-body-w1")).toBeInTheDocument();
    expect(screen.getByTestId("widget-body-w2")).toBeInTheDocument();
  });

  it("commits canonical drag coordinates on pointer up", async () => {
    const onChange = await renderCanvas("edit");
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 7,
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    fireEvent.pointerMove(screen.getByTestId("pixel-shape-w1"), {
      pointerId: 7,
      clientX: 110,
      clientY: 60,
    });
    fireEvent.pointerUp(screen.getByTestId("pixel-shape-w1"), {
      pointerId: 7,
      clientX: 110,
      clientY: 60,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].widgets[0]).toMatchObject({ x: 200, y: 130 });
  });

  it("does not broadcast geometry committed on move-only commit", async () => {
    const committed = vi.fn();
    document.addEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, committed);
    await renderCanvas("edit");
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 21,
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    fireEvent.pointerMove(screen.getByTestId("pixel-shape-w1"), {
      pointerId: 21,
      clientX: 110,
      clientY: 60,
    });
    fireEvent.pointerUp(screen.getByTestId("pixel-shape-w1"), {
      pointerId: 21,
      clientX: 110,
      clientY: 60,
    });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    document.removeEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, committed);
    expect(committed).not.toHaveBeenCalled();
  });

  it("broadcasts geometry committed only for the resized widget", async () => {
    const committed = vi.fn();
    document.addEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, committed);
    await renderCanvas("edit");
    const handle = screen.getByTestId("pixel-resize-se");
    fireEvent.pointerDown(handle, {
      pointerId: 22,
      clientX: 400,
      clientY: 280,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 22,
      clientX: 460,
      clientY: 320,
    });
    fireEvent.pointerUp(document, {
      pointerId: 22,
      clientX: 460,
      clientY: 320,
    });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    document.removeEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, committed);
    expect(committed).toHaveBeenCalledTimes(1);
    const detail = (committed.mock.calls[0][0] as CustomEvent).detail as {
      widgetIds?: string[];
    };
    expect(detail.widgetIds).toEqual(["w1"]);
  });

  it("clamps move to canvas bounds on document pointerup", async () => {
    const onChange = await renderCanvas("edit");
    const drag = screen.getByLabelText("拖动组件");
    fireEvent.pointerDown(drag, {
      pointerId: 11,
      clientX: 100,
      clientY: 100,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 11,
      clientX: -500,
      clientY: -500,
    });
    fireEvent.pointerUp(document, {
      pointerId: 11,
      clientX: -500,
      clientY: -500,
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].widgets[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("cancels an in-progress interaction without writing layout", async () => {
    const onChange = await renderCanvas("edit");
    fireEvent.pointerDown(screen.getByLabelText("调整组件大小：右下"), {
      pointerId: 8,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerCancel(document, { pointerId: 8 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits moved geometry on pointercancel to avoid losing the last frame", async () => {
    const onChange = await renderCanvas("edit");
    fireEvent.pointerDown(screen.getByLabelText("调整组件大小：右下"), {
      pointerId: 18,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 18,
      clientX: 100,
      clientY: 100,
    });
    await flushPixelPointerFrames();
    fireEvent.pointerCancel(document, { pointerId: 18 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets[0];
    expect(resized.width).toBeGreaterThan(300);
    expect(resized.height).toBeGreaterThan(200);
  });

  it("commits the last live rectangle on document pointerup", async () => {
    const onChange = await renderCanvas("edit");
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 10,
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    fireEvent.pointerMove(document, {
      pointerId: 10,
      clientX: 60,
      clientY: 40,
    });
    fireEvent.pointerUp(document, { pointerId: 10, clientX: 60, clientY: 40 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].widgets[0]).toMatchObject({ x: 150, y: 110 });
  });

  it("does not start dragging from widget content", async () => {
    const onChange = await renderCanvas("edit");
    fireEvent.pointerDown(screen.getByRole("button", { name: "图表" }), {
      pointerId: 9,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(screen.getByTestId("pixel-shape-w1"), {
      pointerId: 9,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(screen.getByTestId("pixel-shape-w1"), { pointerId: 9 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears selection when clicking blank canvas content outside the stage", () => {
    const onClearSelection = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={layout}
        selectedIds={new Set(["w1"])}
        onClearSelection={onClearSelection}
        onLayoutChange={vi.fn()}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("pixel-canvas-content"));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("clears selection when clicking blank host padding", () => {
    const onClearSelection = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={layout}
        selectedIds={new Set(["w1"])}
        onClearSelection={onClearSelection}
        onLayoutChange={vi.fn()}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );

    fireEvent.pointerDown(screen.getByTestId("pixel-canvas-host"));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("shows DE edit chrome only in edit mode", () => {
    const { unmount } = renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={layout}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    expect(screen.getByTestId("canvas-mark-line")).toBeInTheDocument();
    expect(document.getElementById("editor-canvas-main")).toBeTruthy();
    expect(document.getElementById("shape-id-w1")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^调整组件大小：/ })).toHaveLength(8);
    unmount();

    renderPixelCanvas(<PixelCanvas
        mode="view"
        layout={layout}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    expect(screen.queryByTestId("canvas-mark-line")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^调整组件大小：/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("pixel-shape-w1")).not.toHaveClass("pixel-shape-selected");
  });

  it("toggles auxiliary grid overlay and mark-line snap from chrome config", () => {
    const { rerender } = renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={layout}
        styleConfig={{ chrome: { showAuxiliaryGrid: true } }}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    expect(screen.getByTestId("pixel-canvas-aux-grid")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-mark-line")).toBeInTheDocument();

    rerenderPixelCanvas(rerender, <PixelCanvas
        mode="edit"
        layout={layout}
        styleConfig={{ chrome: { showAuxiliaryGrid: false } }}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    expect(screen.queryByTestId("pixel-canvas-aux-grid")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-mark-line")).toBeInTheDocument();
  });

  it("updates artboard background when styleConfig resets canvas decor", () => {
    const withDecor = {
      colorScheme: "dark" as const,
      canvasBackgroundCustom: true,
      canvasBackground:
        "radial-gradient(ellipse 100% 85% at 50% -5%, #22d3ee40 0%, #0f172a 42%, #020617 100%)",
      canvasBackgroundImage:
        "/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-cyan-command.svg",
    };
    const { rerender } = renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={layout}
        styleConfig={withDecor}
        selectedIds={new Set()}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const artboard = screen.getByTestId("pixel-canvas-artboard");
    expect(artboard.style.backgroundImage).toContain("canvas-dark-cyan-command.svg");

    rerenderPixelCanvas(
      rerender,
      <PixelCanvas
        mode="edit"
        layout={layout}
        styleConfig={{ colorScheme: "dark", canvasBackground: "#0f172a" }}
        selectedIds={new Set()}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const resetArtboard = screen.getByTestId("pixel-canvas-artboard");
    expect(resetArtboard.style.backgroundImage).toBe("");
    expect(resetArtboard.style.backgroundColor).toBe("rgb(15, 23, 42)");
  });

  it("keeps tile decor only on artboard so host letterbox does not double-scale dots", () => {
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={layout}
        styleConfig={{
          colorScheme: "light",
          canvasBackgroundCustom: true,
          canvasBackground: "#eff6ff",
          canvasDecorPresetId: "dots",
          canvasBackgroundImage:
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"%3E%3Ccircle cx="1" cy="1" r="1" fill="%2394a3b8"/%3E%3C/svg%3E',
          chrome: { showAuxiliaryGrid: false },
        }}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const host = screen.getByTestId("pixel-canvas-host");
    const artboard = screen.getByTestId("pixel-canvas-artboard");
    expect(host.style.backgroundImage).toBe("");
    expect(host.style.backgroundColor).toBe("rgb(239, 246, 255)");
    expect(artboard.style.backgroundImage).toContain("url(");
  });

  it("does not compact intentional outer gaps on commit", async () => {
    const spacedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [
        widget,
        {
          id: "w2",
          type: "chart",
          title: "右",
          order: 2,
          x: 420,
          y: 0,
          width: 300,
          height: 200,
        },
      ],
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={spacedLayout}
        styleConfig={{ chrome: { showAuxiliaryGrid: false } }}
        selectedIds={new Set(["w2"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    expect(screen.getByTestId("pixel-shape-w2")).toHaveStyle({ left: "420px" });

    const shape = screen.getByTestId("pixel-shape-w2");
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 9,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 9, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(shape, { pointerId: 9, clientX: 0, clientY: 0 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w2")?.x).toBe(420);
  });

  it.each([
    [1, 1],
    [0.5, 0.5],
    [0.25, 0.5],
  ])(
    "keeps resize handles inside the host at scale %s (clamped to %s)",
    async (hostScaleFactor, expectedScale) => {
    const hostWidth = 1440 * hostScaleFactor;
    const hostHeight = 320 * expectedScale;
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={{ ...layout, widgets: [{ ...widget, x: 0 }], canvas: { width: 1440, height: 320 } }}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const host = screen.getByTestId("pixel-canvas-host");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: hostWidth },
      clientHeight: { configurable: true, value: hostHeight },
    });
    await act(async () => {
      triggerResizeObservers();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(host).toHaveAttribute("data-pixel-canvas-scale", String(expectedScale));
    expect(screen.getByTestId("pixel-canvas-stage")).toHaveStyle({
      left: "0px",
      transform: `scale(${expectedScale})`,
    });
    const handle = screen.getByTestId("pixel-resize-se");
    const visual = screen.getByTestId("pixel-resize-visual-se");
    expect(Number.parseFloat(handle.style.width) * expectedScale).toBe(28);
    expect(Number.parseFloat(visual.style.width) * expectedScale).toBe(12);
    },
  );

  it("commits southeast resize at reduced canvas scale", async () => {
    const hostWidth = 720;
    const hostHeight = 450;
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={{ ...layout, widgets: [{ ...widget, x: 0, y: 0 }] }}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const host = screen.getByTestId("pixel-canvas-host");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: hostWidth },
      clientHeight: { configurable: true, value: hostHeight },
    });
    await act(async () => {
      triggerResizeObservers();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(host).toHaveAttribute("data-pixel-canvas-scale", "0.5");

    fireEvent.pointerDown(screen.getByLabelText("调整组件大小：右下"), {
      pointerId: 77,
      clientX: 200,
      clientY: 150,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 77, clientX: 260, clientY: 210 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 77, clientX: 200, clientY: 150 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(resized!.width).toBeGreaterThan(300);
    expect(resized!.height).toBeGreaterThan(200);
  });

  it("edit mode fills host width even when scaleMode is component", async () => {
    const hostWidth = 1189;
    const hostHeight = 400;
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        scaleMode="component"
        layout={layout}
        selectedIds={new Set(["w1"])}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const host = screen.getByTestId("pixel-canvas-host");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: hostWidth },
      clientHeight: { configurable: true, value: hostHeight },
    });
    await act(async () => {
      triggerResizeObservers();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    const expectedScale = hostWidth / 1440;
    expect(host).toHaveAttribute("data-pixel-canvas-scale", String(expectedScale));
    expect(host.className).not.toMatch(/items-center/);
    expect(screen.getByTestId("pixel-canvas-content")).toHaveStyle({
      width: `${hostWidth}px`,
    });
  });

  it("commits move when overlap is still within collision buffer", async () => {
    const blocker: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下方",
      order: 2,
      x: 100,
      y: 270,
      width: 300,
      height: 200,
    };
    const stackedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [{ ...widget, y: 80 }, blocker],
    };
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={stackedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    const shape = screen.getByTestId("pixel-shape-w1");
    expect(shape).toHaveStyle({ top: "80px" });

    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 13,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 13, clientX: 0, clientY: 20 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(shape, { pointerId: 13, clientX: 0, clientY: 20 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const moved = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(moved!.y).toBeGreaterThan(80);
  });

  it("commits last drag frame when pointerup coords differ from last move", async () => {
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={layout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    const handle = screen.getByLabelText("调整组件大小：右下");

    fireEvent.pointerDown(handle, {
      pointerId: 21,
      clientX: 100,
      clientY: 100,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 21, clientX: 160, clientY: 160 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 21, clientX: 100, clientY: 100 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(resized!.width).toBeGreaterThan(300);
    expect(resized!.height).toBeGreaterThan(200);
  });

  it("snaps move to neighbor edge when mark-line snap is enabled", async () => {
    const neighbor: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下",
      order: 2,
      x: 100,
      y: 295,
      width: 300,
      height: 100,
    };
    const snapLayout: DashboardLayoutV2 = {
      ...layout,
      styleConfig: {
        chrome: {
          alignmentSnap: {
            enableMarkLineSnap: true,
            markLineThresholdPx: 16,
            snapEdges: true,
            snapCenters: false,
          },
        },
      },
      widgets: [widget, neighbor],
    };
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={snapLayout}
        styleConfig={snapLayout.styleConfig}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();

    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 31,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 31, clientX: 0, clientY: 14 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 31, clientX: 0, clientY: 14 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const moved = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(moved!.y).toBe(95);
  });

  it("shows horizontal and vertical mark lines while resizing southwest near neighbors", async () => {
    const leftNeighbor: PixelLayoutWidget = {
      id: "w-left",
      type: "chart",
      title: "左",
      order: 2,
      x: 20,
      y: 80,
      width: 80,
      height: 200,
    };
    const bottomNeighbor: PixelLayoutWidget = {
      id: "w-bottom",
      type: "chart",
      title: "下",
      order: 3,
      x: 100,
      y: 284,
      width: 300,
      height: 120,
    };
    const snapLayout: DashboardLayoutV2 = {
      ...layout,
      styleConfig: {
        chrome: {
          alignmentSnap: {
            enableMarkLineSnap: true,
            markLineThresholdPx: 16,
            snapEdges: true,
            snapCenters: false,
          },
        },
      },
      widgets: [widget, leftNeighbor, bottomNeighbor],
    };
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={snapLayout}
        styleConfig={snapLayout.styleConfig}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();

    const handle = screen.getByLabelText("调整组件大小：左下");
    fireEvent.pointerDown(handle, {
      pointerId: 72,
      clientX: 100,
      clientY: 280,
      button: 0,
    });
    // 向内收缩：指针越过按下点（右+上）时仍应稳定显示双轴参考线
    fireEvent.pointerMove(document, { pointerId: 72, clientX: 112, clientY: 268 });
    await flushPixelPointerFrames();

    const horizontalIds = ["mark-line-xt", "mark-line-xc", "mark-line-xb"];
    const verticalIds = ["mark-line-yl", "mark-line-yc", "mark-line-yr"];
    expect(horizontalIds.some((id) => screen.queryByTestId(id))).toBe(true);
    expect(verticalIds.some((id) => screen.queryByTestId(id))).toBe(true);

    fireEvent.pointerUp(document, { pointerId: 72, clientX: 112, clientY: 268 });
    await flushPixelPointerFrames();

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find(
      (item: PixelLayoutWidget) => item.id === "w1",
    );
    expect(resized).toMatchObject({ x: 100, y: 80, width: 300, height: 204 });

    expect(horizontalIds.every((id) => screen.queryByTestId(id) == null)).toBe(true);
    expect(verticalIds.every((id) => screen.queryByTestId(id) == null)).toBe(true);
  });

  it("keeps southeast resize with neighbors and alignment snap enabled", async () => {
    const neighbors: PixelLayoutWidget[] = [
      { id: "w2", type: "chart", title: "上", order: 2, x: 80, y: 20, width: 340, height: 50 },
      { id: "w3", type: "chart", title: "右", order: 3, x: 420, y: 80, width: 200, height: 200 },
      { id: "w4", type: "chart", title: "下", order: 4, x: 100, y: 290, width: 300, height: 180 },
    ];
    const crowdedLayout: DashboardLayoutV2 = {
      ...layout,
      styleConfig: {
        chrome: {
          alignmentSnap: {
            enableMarkLineSnap: true,
            markLineThresholdPx: 16,
            snapEdges: true,
            snapCenters: true,
          },
        },
      },
      widgets: [widget, ...neighbors],
    };
    let currentLayout = crowdedLayout;
    const onChange = vi.fn((next: DashboardLayoutV2) => {
      currentLayout = next;
    });
    const { rerender } = renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={currentLayout}
        styleConfig={crowdedLayout.styleConfig}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.pointerDown(handle, {
      pointerId: 55,
      clientX: 400,
      clientY: 280,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 55, clientX: 460, clientY: 340 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 55, clientX: 400, clientY: 280 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(resized!.width).toBeGreaterThan(300);
    expect(resized!.height).toBeGreaterThan(200);

    rerenderPixelCanvas(
      rerender,
      <PixelCanvas
        mode="edit"
        layout={currentLayout}
        styleConfig={crowdedLayout.styleConfig}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    expect(screen.getByTestId("pixel-shape-w1")).toHaveStyle({
      width: `${resized!.width}px`,
      height: `${resized!.height}px`,
    });
  });

  it("keeps resize commit when overlap is still within collision buffer", async () => {
    const blocker: PixelLayoutWidget = {
      id: "w2",
      type: "chart",
      title: "下方",
      order: 2,
      x: 100,
      y: 270,
      width: 300,
      height: 200,
    };
    const stackedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [{ ...widget, y: 80 }, blocker],
    };
    const onChange = vi.fn();
    renderPixelCanvas(
      <PixelCanvas
        mode="edit"
        layout={stackedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    await pinPixelHostMetrics();
    const shape = screen.getByTestId("pixel-shape-w1");
    const handle = screen.getByLabelText("调整组件大小：下");

    fireEvent.pointerDown(handle, {
      pointerId: 14,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 14, clientX: 0, clientY: 20 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(shape, { pointerId: 14, clientX: 0, clientY: 20 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const resized = onChange.mock.calls[0][0].widgets.find((item: PixelLayoutWidget) => item.id === "w1");
    expect(resized!.height).toBeGreaterThan(200);
  });

  it("auto-scrolls canvas host when dragging near the bottom edge", async () => {
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={layout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const host = screen.getByTestId("pixel-canvas-host");
    let scrollTop = 0;
    Object.defineProperty(host, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Object.defineProperty(host, "scrollHeight", { configurable: true, value: 3_000 });
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 600 });
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 700,
      left: 0,
      right: 1_200,
      width: 1_200,
      height: 600,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const shape = screen.getByTestId("pixel-shape-w1");
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 12,
      clientX: 200,
      clientY: 200,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 12, clientX: 200, clientY: 690 });
    await flushPixelPointerFrames();

    expect(scrollTop).toBe(20);
    fireEvent.pointerUp(shape, { pointerId: 12, clientX: 200, clientY: 690 });
  });

  it("reports the visible canonical viewport after resize and scroll", async () => {
    const onViewportChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={layout}
        onViewportChange={onViewportChange}
        renderWidget={(item) => <span>{item.title}</span>}
      />,
    );
    const host = screen.getByTestId("pixel-canvas-host");
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 720 },
      clientHeight: { configurable: true, value: 300 },
      scrollLeft: { configurable: true, writable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    await act(async () => {
      triggerResizeObservers();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    fireEvent.scroll(host);

    expect(onViewportChange).toHaveBeenLastCalledWith({
      x: 400,
      y: 200,
      width: 1040,
      height: 120,
    });
  });

  it("hides resize handles when widget is locked", () => {
    const lockedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [{ ...widget, locked: true }],
    };
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={lockedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={vi.fn()}
        renderWidget={(item) => <button data-pixel-no-drag>{item.title}</button>}
      />,
    );
    expect(screen.queryByLabelText("调整组件大小：右下")).not.toBeInTheDocument();
  });

  it("does not move or resize locked widget via keyboard", async () => {
    const lockedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [{ ...widget, locked: true }],
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={lockedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <button data-pixel-no-drag>{item.title}</button>}
      />,
    );
    const drag = screen.getByLabelText("拖动组件");
    fireEvent.keyDown(drag, { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not start pointer drag when widget is locked", async () => {
    const lockedLayout: DashboardLayoutV2 = {
      ...layout,
      widgets: [{ ...widget, locked: true }],
    };
    const onChange = vi.fn();
    renderPixelCanvas(<PixelCanvas
        mode="edit"
        layout={lockedLayout}
        selectedIds={new Set(["w1"])}
        onLayoutChange={onChange}
        renderWidget={(item) => <button data-pixel-no-drag>{item.title}</button>}
      />,
    );
    await pinPixelHostMetrics();
    fireEvent.pointerDown(screen.getByLabelText("拖动组件"), {
      pointerId: 9,
      clientX: 0,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(document, { pointerId: 9, clientX: 80, clientY: 0 });
    await flushPixelPointerFrames();
    fireEvent.pointerUp(document, { pointerId: 9, clientX: 80, clientY: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports keyboard move and resize without Enter or Space mutations", async () => {
    const onChange = await renderCanvas("edit");
    const drag = screen.getByLabelText("拖动组件");
    fireEvent.keyDown(drag, { key: "ArrowRight" });
    expect(onChange.mock.calls[0][0].widgets[0]).toMatchObject({ x: 101, y: 80 });

    const handle = screen.getByLabelText("调整组件大小：右下");
    fireEvent.keyDown(handle, { key: "ArrowDown", shiftKey: true });
    expect(onChange.mock.calls[1][0].widgets[0]).toMatchObject({ width: 300, height: 210 });
    fireEvent.keyDown(drag, { key: "Enter" });
    fireEvent.keyDown(handle, { key: " " });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("v2 widget creation and history", () => {
  it("creates chart and filter widgets centered on canvas", () => {
    const chartLayout = insertPixelPaletteWidget("bar", {
      version: 2,
      canvas: layout.canvas,
      widgets: [],
      globalFilters: [],
    });
    const chart = chartLayout.widgets[0]!;
    const filterLayout = insertPixelPaletteWidget(
      { type: "filter", controlType: "date" },
      chartLayout,
    );
    const filter = filterLayout.widgets.find((item) => item.type === "filter")!;
    const chartAfterFilter = filterLayout.widgets.find((item) => item.type === "chart")!;

    expect(chart).toMatchObject({ type: "chart", x: 480, y: 300, width: 480, height: 300 });
    expect(filter).toMatchObject({ type: "filter", x: 560, y: 380, width: 320, height: 140 });
    expect(chartAfterFilter).toMatchObject({ x: 480, y: 520 });
    expect(layoutsOverlap(filterLayout, 0)).toBe(false);
  });

  it("places a reused v1 widget in v2 without losing cloned content identity", () => {
    const cloned: LayoutWidget = {
      id: "clone-1",
      type: "text",
      title: "复用说明",
      order: 8,
      colSpan: 6,
      rowSpan: 2,
      textConfig: { content: "复用内容", variant: "plain" },
    };
    const placed = placeClonedPixelWidget(
      cloned,
      layout.widgets,
      layout.canvas,
      { x: 400, y: 300, width: 600, height: 400 },
    );
    expect(placed).toMatchObject({
      id: "clone-1",
      title: "复用说明",
      order: 8,
      textConfig: { content: "复用内容" },
      x: 460,
      y: 410,
      width: 480,
      height: 180,
    });
    expect(placed).not.toHaveProperty("colSpan");
  });

  it("preserves source pixel geometry when reusing from a v2 dashboard", () => {
    const cloned: LayoutWidget = {
      id: "clone-2",
      type: "chart",
      title: "来源图表",
      order: 3,
      colSpan: 6,
      rowSpan: 4,
      chartConfig: {
        chartType: "bar",
        chartId: "clone-2",
        mode: "sql",
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        sql: "SELECT 1",
        dimensions: [{ field: "region" }],
        metrics: [{ field: "value" }],
      },
    };
    const sourcePixel: PixelLayoutWidget = {
      id: "clone-2",
      type: "chart",
      title: "来源图表",
      order: 3,
      x: 120,
      y: 240,
      width: 600,
      height: 280,
      chartConfig: cloned.chartConfig,
    };
    const placed = placeClonedPixelWidget(
      cloned,
      layout.widgets,
      layout.canvas,
      { x: 400, y: 300, width: 600, height: 400 },
      sourcePixel,
    );
    expect(placed.width).toBe(600);
    expect(placed.height).toBe(280);
    expect(placed.title).toBe("来源图表");
  });

  it("undoes and redoes the complete v2 layout without losing metadata", () => {
    const { result } = renderHook(() =>
      usePixelLayoutHistory({ initialLayout: layout, keyboardEnabled: false }),
    );
    const changed: DashboardLayoutV2 = {
      ...layout,
      canvas: { width: 1440, height: 1200 },
      widgets: [{ ...widget, x: 420, width: 520 }],
      globalFilters: [{ id: "country" }],
    };

    act(() => result.current.setLayout(changed));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.undo());
    expect(result.current.layout).toEqual(layout);
    act(() => result.current.redo());
    expect(result.current.layout).toEqual(changed);
    act(() => result.current.markSaved());
    expect(result.current.isDirty).toBe(false);
  });

  it.each([
    ["input", <input aria-label="history-input" />],
    ["textarea", <textarea aria-label="history-textarea" />],
    ["select", <select aria-label="history-select" />],
    ["contenteditable", <div contentEditable aria-label="history-contenteditable" />],
    ["opt-out region", <div data-pixel-no-shortcut tabIndex={0} aria-label="history-opt-out" />],
  ])("ignores undo shortcuts from %s", (_, control) => {
    const { result } = renderHook(() =>
      usePixelLayoutHistory({ initialLayout: layout, keyboardEnabled: true }),
    );
    const changed = { ...layout, widgets: [{ ...widget, x: 420 }] };
    act(() => result.current.setLayout(changed));
    render(control);
    const target = screen.getByLabelText(/^history-/);
    target.focus();
    fireEvent.keyDown(target, { key: "z", ctrlKey: true });
    expect(result.current.layout).toEqual(changed);
  });

  it("ignores Cmd+Y redo from an opted-out editor region", () => {
    const { result } = renderHook(() =>
      usePixelLayoutHistory({ initialLayout: layout, keyboardEnabled: true }),
    );
    const changed = { ...layout, widgets: [{ ...widget, x: 420 }] };
    act(() => result.current.setLayout(changed));
    act(() => result.current.undo());
    render(<div data-pixel-no-shortcut tabIndex={0} aria-label="redo-opt-out" />);
    const target = screen.getByLabelText("redo-opt-out");
    target.focus();
    fireEvent.keyDown(target, { key: "y", metaKey: true });
    expect(result.current.layout).toEqual(layout);
  });
});
