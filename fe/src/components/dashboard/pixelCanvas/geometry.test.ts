import { describe, expect, it } from "vitest";
import {
  applyPixelInteraction,
  clampPixelRectToCanvas,
  clientPointToCanvasFromStage,
  resolveStageVisualScale,
  RESIZE_CURSORS,
  resolvePixelCanvasMeasureElement,
  pixelShapeZIndex,
  PIXEL_MARK_LINE_Z_INDEX,
  PIXEL_SHAPE_SELECTED_Z_BOOST,
  resolveScaleDesignHeight,
  findTopLevelWidgetsAtCanvasPoint,
  preferAdvancedResizeRect,
  resolveNextStackedWidgetAtPoint,
  snapScaledContentWidth,
  scaledCanvasMetrics,
  screenDeltaToCanvas,
  type PixelRect,
} from "./geometry";

const rect: PixelRect = { x: 100, y: 80, width: 300, height: 200 };

describe("pixel canvas geometry", () => {
  it("converts screen movement into canonical canvas coordinates", () => {
    expect(screenDeltaToCanvas({ x: 90, y: 45 }, 0.5)).toEqual({ x: 180, y: 90 });
  });

  it("maps screen coordinates from scaled stage bounding rect", () => {
    const stage = {
      getBoundingClientRect: () =>
        ({
          left: 120,
          top: 80,
          width: 720,
          height: 450,
          right: 840,
          bottom: 530,
          x: 120,
          y: 80,
          toJSON: () => ({}),
        }) as DOMRect,
    };
    expect(clientPointToCanvasFromStage(stage, 220, 180, 0.5)).toEqual({ x: 200, y: 200 });
  });

  it("derives visual scale from stage rect when outer viewport scales the canvas", () => {
    const stage = {
      getBoundingClientRect: () =>
        ({
          left: 580,
          top: 377,
          width: 683,
          height: 384,
          right: 1263,
          bottom: 761,
          x: 580,
          y: 377,
          toJSON: () => ({}),
        }) as DOMRect,
    };
    const visualScale = resolveStageVisualScale(stage, 1920, 1080);
    expect(visualScale).toBeCloseTo(Math.min(683 / 1920, 384 / 1080), 5);
    expect(clientPointToCanvasFromStage(stage, 580 + 100, 377 + 50, visualScale)).toEqual({
      x: 100 / visualScale,
      y: 50 / visualScale,
    });
  });

  it.each([
    ["n", { x: 0, y: -40 }, { x: 100, y: 40, width: 300, height: 240 }],
    ["ne", { x: 40, y: -40 }, { x: 100, y: 40, width: 340, height: 240 }],
    ["e", { x: 40, y: 0 }, { x: 100, y: 80, width: 340, height: 200 }],
    ["se", { x: 40, y: 40 }, { x: 100, y: 80, width: 340, height: 240 }],
    ["s", { x: 0, y: 40 }, { x: 100, y: 80, width: 300, height: 240 }],
    ["sw", { x: -40, y: 40 }, { x: 60, y: 80, width: 340, height: 240 }],
    ["w", { x: -40, y: 0 }, { x: 60, y: 80, width: 340, height: 200 }],
    ["nw", { x: -40, y: -40 }, { x: 60, y: 40, width: 340, height: 240 }],
  ] as const)("resizes toward %s while keeping the opposite edges fixed", (direction, delta, expected) => {
    expect(
      applyPixelInteraction(rect, delta, direction, {
        width: 1440,
        height: 900,
      }),
    ).toEqual(expected);
  });

  it("computes scaled content metrics for a narrow host", () => {
    expect(scaledCanvasMetrics(645, 420, 1440, 900, 900, 0)).toEqual({
      scale: 645 / 1440,
      contentWidth: 645,
      contentHeight: 420,
      stageLeft: 0,
      centerContent: false,
      scrollX: false,
    });
  });

  it("extends dot-grid background to host height without upscaling widgets", () => {
    const metrics = scaledCanvasMetrics(740, 699, 1440, 320, 320, 0);
    expect(metrics.scale).toBeCloseTo(740 / 1440, 5);
    expect(metrics.contentHeight).toBe(699);
    expect(metrics.contentWidth).toBe(740);
    expect(metrics.centerContent).toBe(false);
    expect(metrics.scrollX).toBe(false);
  });

  it("uses width-fit scale and ceil height when content exceeds the viewport", () => {
    const metrics = scaledCanvasMetrics(800, 600, 1440, 2000, 2000, 0);
    expect(metrics.scale).toBeCloseTo(800 / 1440, 5);
    expect(metrics.contentWidth).toBe(800);
    expect(metrics.contentHeight).toBe(Math.ceil((2000 * 800) / 1440));
    expect(metrics.centerContent).toBe(false);
    expect(metrics.scrollX).toBe(false);
  });

  it("clamps edit scale floor and enables horizontal scroll when host is very narrow", () => {
    const metrics = scaledCanvasMetrics(855, 354, 2176, 900, 900, 0, "canvas", 0.5);
    expect(metrics.scale).toBe(0.5);
    expect(metrics.contentWidth).toBe(Math.ceil(2176 * 0.5));
    expect(metrics.scrollX).toBe(true);
  });

  it("does not clamp when raw scale is above edit floor", () => {
    const metrics = scaledCanvasMetrics(855, 354, 1440, 900, 900, 0, "canvas", 0.5);
    expect(metrics.scale).toBeCloseTo(855 / 1440, 5);
    expect(metrics.scrollX).toBe(false);
  });

  it("letterboxes component scale without leaving a wide empty content strip", () => {
    const metrics = scaledCanvasMetrics(1189, 400, 1440, 900, 900, 0, "component");
    expect(metrics.scale).toBeCloseTo(400 / 900, 5);
    expect(metrics.contentWidth).toBe(Math.ceil((1440 * 400) / 900));
    expect(metrics.contentHeight).toBe(Math.ceil(400));
    expect(metrics.centerContent).toBe(true);
    expect(metrics.stageLeft).toBe(0);
    expect(metrics.scrollX).toBe(false);
  });

  it("fits data-screen 1920x1080 inside host without scroll", () => {
    const metrics = scaledCanvasMetrics(1024, 718, 1920, 1080, 1080, 0, "component", 0);
    expect(metrics.scrollX).toBe(false);
    expect(metrics.scale).toBeCloseTo(1024 / 1920, 5);
    expect(metrics.contentHeight).toBeLessThanOrEqual(718);
    expect(metrics.contentWidth).toBe(1024);
    expect(metrics.scrollX).toBe(false);
  });

  it("snaps component width when within sub-pixel gap of the host", () => {
    const available = 766;
    const scale = available / 1440;
    const metrics = scaledCanvasMetrics(available, 700, 1440, 900, 900, 0, "component");
    expect(metrics.scale).toBeCloseTo(scale, 5);
    expect(metrics.contentWidth).toBe(available);
    expect(metrics.centerContent).toBe(false);
  });

  it("uses design canvas height for component scale even when content is taller", () => {
    expect(resolveScaleDesignHeight(2000)).toBe(900);
    const metrics = scaledCanvasMetrics(1189, 836, 1440, 900, 2000, 0, "component");
    const scale = Math.min(1189 / 1440, 836 / 900);
    expect(metrics.scale).toBeCloseTo(scale, 5);
    expect(metrics.contentWidth).toBe(Math.min(Math.ceil(1440 * scale), 1189));
    expect(metrics.contentHeight).toBe(Math.ceil(2000 * scale));
    expect(metrics.centerContent).toBe(metrics.contentWidth < 1188.5);
  });

  it("allows vertical growth when bottom growth is enabled", () => {
    expect(
      applyPixelInteraction(
        { x: 61, y: 6, width: 1379, height: 894 },
        { x: 100, y: 100 },
        "move",
        { width: 1440, height: 900 },
        { allowBottomGrowth: true },
      ),
    ).toEqual({ x: 61, y: 106, width: 1379, height: 894 });
  });

  it("clamps rects that overflow after canvas shrink", () => {
    expect(
      clampPixelRectToCanvas({ x: 1500, y: 900, width: 400, height: 300 }, { width: 1200, height: 800 }),
    ).toEqual({ x: 800, y: 500, width: 400, height: 300 });
    expect(
      clampPixelRectToCanvas({ x: 0, y: 0, width: 1800, height: 1000 }, { width: 1200, height: 800 }),
    ).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
  });

  it("clamps movement to canvas bounds by default", () => {
    expect(
      applyPixelInteraction(rect, { x: 1400, y: 900 }, "move", {
        width: 1440,
        height: 900,
      }),
    ).toEqual({ ...rect, x: 1140, y: 700 });
  });

  it("uses the standard cursor for every resize direction", () => {
    expect(RESIZE_CURSORS).toEqual({
      n: "ns-resize",
      ne: "nesw-resize",
      e: "ew-resize",
      se: "nwse-resize",
      s: "ns-resize",
      sw: "nesw-resize",
      w: "ew-resize",
      nw: "nwse-resize",
    });
  });

  it.each([
    ["w", { x: -500, y: 0 }, { x: 0, y: 80, width: 400, height: 200 }],
    ["e", { x: 2000, y: 0 }, { x: 100, y: 80, width: 1340, height: 200 }],
    ["n", { x: 0, y: -500 }, { x: 100, y: 0, width: 300, height: 280 }],
    ["s", { x: 0, y: 2000 }, { x: 100, y: 80, width: 300, height: 820 }],
  ] as const)("clamps the %s edge to the canvas", (direction, delta, expected) => {
    expect(applyPixelInteraction(rect, delta, direction, { width: 1440, height: 900 })).toEqual(
      expected,
    );
  });

  it("enforces minimum width and height while preserving opposite edges", () => {
    expect(
      applyPixelInteraction(rect, { x: 500, y: 500 }, "nw", {
        width: 1440,
        height: 900,
      }),
    ).toEqual({ x: 280, y: 200, width: 120, height: 80 });
  });

  it("prefers pixel-canvas-host as the measure element when present", () => {
    const surface = document.createElement("div");
    surface.className = "dashboard-canvas-surface";
    Object.defineProperty(surface, "clientWidth", { value: 766 });
    Object.defineProperty(surface, "clientHeight", { value: 540 });

    const host = document.createElement("div");
    host.className = "pixel-canvas-host";
    Object.defineProperty(host, "clientWidth", { value: 751 });
    Object.defineProperty(host, "clientHeight", { value: 540 });
    surface.appendChild(host);

    expect(resolvePixelCanvasMeasureElement(host)).toBe(host);
  });

  it("prefers dashboard-canvas-surface as the stable measure element", () => {
    const surface = document.createElement("div");
    surface.className = "dashboard-canvas-surface";
    Object.defineProperty(surface, "clientWidth", { value: 960 });
    Object.defineProperty(surface, "clientHeight", { value: 540 });

    const growing = document.createElement("div");
    Object.defineProperty(growing, "clientWidth", { value: 23098 });
    Object.defineProperty(growing, "clientHeight", { value: 19561 });
    surface.appendChild(growing);

    const host = document.createElement("div");
    growing.appendChild(host);

    expect(resolvePixelCanvasMeasureElement(host)).toBe(surface);
  });

  it("elevates selected widget z-index above normal order", () => {
    expect(pixelShapeZIndex(3, false)).toBe(13);
    expect(pixelShapeZIndex(3, true)).toBeGreaterThan(pixelShapeZIndex(99, false));
  });

  it("keeps auxiliary grid below unselected shapes", () => {
    expect(pixelShapeZIndex(0, false)).toBeGreaterThan(1);
  });

  it("keeps mark-line overlay above selected shapes", () => {
    expect(PIXEL_MARK_LINE_Z_INDEX).toBeGreaterThan(
      pixelShapeZIndex(999_999, true),
    );
    expect(PIXEL_MARK_LINE_Z_INDEX).toBeGreaterThan(PIXEL_SHAPE_SELECTED_Z_BOOST);
  });
});

describe("stack pick at canvas point", () => {
  const stacked = [
    { id: "back", x: 0, y: 0, width: 200, height: 200, order: 0 },
    { id: "mid", x: 50, y: 50, width: 200, height: 200, order: 1 },
    { id: "front", x: 100, y: 100, width: 200, height: 200, order: 2 },
  ];

  it("returns top-to-bottom widget ids at a point", () => {
    expect(findTopLevelWidgetsAtCanvasPoint(stacked, { x: 120, y: 120 })).toEqual([
      "front",
      "mid",
      "back",
    ]);
  });

  it("cycles to the next stacked widget", () => {
    const ids = ["front", "mid", "back"];
    expect(resolveNextStackedWidgetAtPoint(ids, "front")).toBe("mid");
    expect(resolveNextStackedWidgetAtPoint(ids, "mid")).toBe("back");
    expect(resolveNextStackedWidgetAtPoint(ids, "back")).toBe("front");
  });

  it("breaks equal-order ties by id when picking stacked widgets", () => {
    const stacked = [
      { id: "a", x: 0, y: 0, width: 200, height: 200, order: 1 },
      { id: "b", x: 0, y: 0, width: 200, height: 200, order: 1 },
    ];
    expect(findTopLevelWidgetsAtCanvasPoint(stacked, { x: 10, y: 10 })).toEqual(["b", "a"]);
  });

  it("prefers the resize rect that advanced further from the start", () => {
    const start = { x: 100, y: 100, width: 300, height: 200 };
    const pending = { x: 100, y: 100, width: 340, height: 240 };
    const jittered = { x: 100, y: 100, width: 300, height: 200 };
    expect(preferAdvancedResizeRect(start, pending, jittered, "se")).toEqual(pending);
    expect(preferAdvancedResizeRect(start, jittered, pending, "se")).toEqual(pending);
  });
});
