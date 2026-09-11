import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CanvasScaleViewport } from "./CanvasScaleViewport";

describe("CanvasScaleViewport", () => {
  it("pins canvas to top-left when pinTopLeft is enabled", () => {
    const { container } = render(
      <div style={{ width: 960, height: 540 }}>
        <CanvasScaleViewport canvasWidth={1920} canvasHeight={1080} mode="fitWidth" pinTopLeft>
          <div data-testid="stage-child">canvas</div>
        </CanvasScaleViewport>
      </div>,
    );

    const stage = container.querySelector("[data-canvas-scale-viewport] > div") as HTMLElement | null;
    expect(stage?.style.transform).toMatch(/translate\(0px, 0px\)/);
  });
});
