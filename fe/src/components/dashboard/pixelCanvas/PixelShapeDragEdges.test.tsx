import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PixelShapeDragEdges } from "./PixelShapeDragEdges";

describe("PixelShapeDragEdges", () => {
  afterEach(() => cleanup());

  it("renders transparent DE-style drag edges with top aria label", () => {
    const onDrag = vi.fn();
    render(
      <PixelShapeDragEdges widgetId="w1" scale={1} onDragPointerDown={onDrag} />,
    );

    const top = screen.getByTestId("pixel-drag-edge-top-w1");
    expect(top).toHaveAttribute("aria-label", "拖动组件");
    expect(screen.getByTestId("pixel-drag-edge-left-w1")).toBeInTheDocument();
    expect(screen.getByTestId("pixel-drag-edge-right-w1")).toBeInTheDocument();
    expect(screen.getByTestId("pixel-drag-edge-bottom-w1")).toBeInTheDocument();

    fireEvent.pointerDown(top, { pointerId: 1, button: 0 });
    expect(onDrag).toHaveBeenCalledTimes(1);
  });
});
