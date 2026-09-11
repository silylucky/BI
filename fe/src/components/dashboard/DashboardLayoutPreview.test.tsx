import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardLayoutPreview } from "./DashboardLayoutPreview";
import { resolveComponentGapRuntime } from "./componentGapRuntime";

vi.mock("./pixelCanvas", () => ({
  PixelCanvas: ({
    styleConfig,
    scaleMode,
  }: {
    styleConfig?: { gapPreset?: string; pixelGutter?: number };
    scaleMode?: string;
  }) => (
    <div
      data-testid="pixel-canvas-mock"
      data-gap-preset={styleConfig?.gapPreset ?? "unset"}
      data-pixel-gutter={styleConfig?.pixelGutter ?? "unset"}
      data-scale-mode={scaleMode ?? "unset"}
    />
  ),
}));

const pixelLayout = {
  version: 2 as const,
  canvas: { width: 1440, height: 900 },
  widgets: [
    {
      id: "w1",
      type: "chart" as const,
      title: "图表",
      order: 0,
      x: 0,
      y: 0,
      width: 480,
      height: 300,
    },
  ],
  globalFilters: [],
};

afterEach(cleanup);

describe("DashboardLayoutPreview", () => {
  it("prefers live styleConfig override over stale layout.styleConfig for gap", () => {
    render(
      <DashboardLayoutPreview
        layout={{
          ...pixelLayout,
          styleConfig: { gapPreset: "none", widgetGap: 0, pixelGutter: 0 },
        }}
        styleConfig={{ gapPreset: "md", widgetGap: 8, pixelGutter: 5 }}
      />,
    );

    const mock = screen.getByTestId("pixel-canvas-mock");
    expect(mock).toHaveAttribute("data-gap-preset", "md");
    expect(mock).toHaveAttribute("data-pixel-gutter", "5");
    expect(
      resolveComponentGapRuntime({ gapPreset: "md", pixelGutter: 5 }, "pixel").shellPaddingPx,
    ).toBe(5);
  });

  it("bootstraps legacy widgetGap without implying pixel shell gap", () => {
    render(
      <DashboardLayoutPreview
        layout={{
          ...pixelLayout,
          styleConfig: { widgetGap: 8 },
        }}
      />,
    );

    const mock = screen.getByTestId("pixel-canvas-mock");
    expect(mock).toHaveAttribute("data-gap-preset", "none");
    expect(mock).toHaveAttribute("data-pixel-gutter", "0");
  });

  it("defaults view scale to canvas width-fill even when layout stores component", () => {
    render(
      <DashboardLayoutPreview
        layout={{
          ...pixelLayout,
          styleConfig: { scaleMode: "component" },
        }}
      />,
    );

    expect(screen.getByTestId("pixel-canvas-mock")).toHaveAttribute("data-scale-mode", "canvas");
  });

  it("honors explicit scaleMode prop for thumbnail-style previews", () => {
    render(
      <DashboardLayoutPreview
        layout={pixelLayout}
        scaleMode="component"
      />,
    );

    expect(screen.getByTestId("pixel-canvas-mock")).toHaveAttribute("data-scale-mode", "component");
  });
});
