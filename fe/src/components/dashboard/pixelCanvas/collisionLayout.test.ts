import { describe, expect, it } from "vitest";
import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";
import {
  applyActiveWidgetRect,
  findNextOpenSlot,
  layoutsOverlap,
  packPixelLayoutSeamless,
  rectsOverlap,
  hasShallowOverlap,
  shouldRevertPixelDragCommit,
  resolvePixelCollisions,
  resolvePixelLayoutWithActiveRect,
} from "./collisionLayout";
import { insertPixelPaletteWidget, insertPixelPaletteWidgetAt } from "./createPixelWidget";

const baseLayout = (widgets: PixelLayoutWidget[]): DashboardLayoutV2 => ({
  version: 2,
  canvas: { width: 1440, height: 900 },
  widgets,
  globalFilters: [],
});

const widget = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  order: number,
): PixelLayoutWidget => ({
  id,
  type: "chart",
  title: id,
  order,
  x,
  y,
  width,
  height,
});

describe("collisionLayout", () => {
  it("treats edge contact without gap as non-overlap", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 100, y: 0, width: 100, height: 100 }, 0)).toBe(
      false,
    );
  });

  it("ignores shallow overlap below the collision buffer", () => {
    const active = { x: 0, y: 90, width: 100, height: 100 };
    const other = { x: 0, y: 0, width: 100, height: 100 };
    expect(rectsOverlap(active, other, 0, 40)).toBe(false);
    expect(hasShallowOverlap(active, other, 40)).toBe(true);
    expect(rectsOverlap({ x: 0, y: 59, width: 100, height: 100 }, other, 0, 40)).toBe(true);
  });

  it("reverts commit while still in the shallow overlap zone", () => {
    const start = { x: 100, y: 100, width: 300, height: 200 };
    const final = { x: 100, y: 110, width: 300, height: 200 };
    const other = { x: 120, y: 270, width: 300, height: 200 };
    expect(shouldRevertPixelDragCommit(final, start, [other], 40)).toBe(true);
    expect(
      shouldRevertPixelDragCommit(
        { x: 100, y: 130, width: 300, height: 200 },
        start,
        [other],
        40,
      ),
    ).toBe(false);
  });

  it("does not push neighbors until overlap exceeds the buffer", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 261, 300, 200, 2),
    ]);
    const shallow = resolvePixelCollisions(layout, "a", { x: 100, y: 100, width: 300, height: 200 });
    expect(shallow.widgets.find((item) => item.id === "b")).toMatchObject({ y: 261 });
    const deep = resolvePixelCollisions(layout, "a", { x: 100, y: 110, width: 300, height: 200 });
    expect(deep.widgets.find((item) => item.id === "b")!.y).toBeGreaterThan(261);
  });

  it("pushes neighbors on commit when overlap is below the preview buffer", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 261, 300, 200, 2),
    ]);
    const preview = resolvePixelCollisions(
      layout,
      "a",
      { x: 100, y: 100, width: 300, height: 200 },
      { minOverlap: 40 },
    );
    expect(preview.widgets.find((item) => item.id === "b")).toMatchObject({ y: 261 });
    const committed = resolvePixelCollisions(
      layout,
      "a",
      { x: 100, y: 100, width: 300, height: 200 },
      { minOverlap: 0 },
    );
    expect(committed.widgets.find((item) => item.id === "b")!.y).toBeGreaterThan(261);
  });

  it("pushes neighbors on palette insert when overlap is below the preview buffer", () => {
    const layout = baseLayout([
      widget("blocker", 100, 250, 300, 200, 1),
    ]);
    const resolved = insertPixelPaletteWidgetAt("bar", layout, { x: 150, y: 220 });
    const blocker = resolved.widgets.find((item) => item.id === "blocker")!;
    const inserted = resolved.widgets.find((item) => item.id !== "blocker")!;
    expect(inserted).toBeTruthy();
    expect(blocker.y).toBeGreaterThan(250);
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("keeps layout unchanged when there is no collision", () => {
    const layout = baseLayout([
      widget("a", 0, 0, 300, 200, 1),
      widget("b", 400, 0, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 20, y: 10, width: 300, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ x: 20, y: 10 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ x: 400, y: 0 });
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("does not reflow distant widgets when active moves within its column", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 700, 280, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 100, y: 190, width: 300, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ x: 700, y: 280 });
  });

  it("pushes a colliding widget down when the active widget grows taller", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 300, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 100, y: 100, width: 300, height: 320 });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ height: 320 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ y: 420 });
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("keeps the active widget and pushes a colliding widget down", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 220, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 100, y: 200, width: 300, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ x: 100, y: 200 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ x: 120, y: 400 });
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("does not lift widgets below when only width grows east", () => {
    const layout = baseLayout([
      widget("a", 0, 0, 300, 200, 1),
      widget("b", 0, 200, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 0, y: 0, width: 400, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ y: 200 });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ width: 400 });
  });

  it("lifts widgets below when the active widget moves away (DE vacate + compact)", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 320, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 100, y: 500, width: 300, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ y: 0 });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ y: 500 });
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("does not lift widgets in non-overlapping columns", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 600, 400, 300, 200, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 100, y: 500, width: 300, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ y: 400 });
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("cascades target push-down in stable order", () => {
    const layout = baseLayout([
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 220, 300, 200, 2),
      widget("c", 140, 340, 300, 200, 3),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 100, y: 300, width: 300, height: 200 });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ y: 300 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ y: 500 });
    expect(resolved.widgets.find((item) => item.id === "c")).toMatchObject({ y: 0 });
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("produces the same result regardless of widget array order", () => {
    const widgets = [
      widget("c", 140, 340, 300, 200, 3),
      widget("a", 100, 100, 300, 200, 1),
      widget("b", 120, 220, 300, 200, 2),
    ];
    const forward = resolvePixelCollisions(baseLayout(widgets), "a", { x: 100, y: 300, width: 300, height: 200 });
    const reverse = resolvePixelCollisions(
      baseLayout([...widgets].reverse()),
      "a",
      { x: 100, y: 300, width: 300, height: 200 },
    );
    const sortById = (items: PixelLayoutWidget[]) =>
      [...items].sort((left, right) => left.id.localeCompare(right.id));
    expect(sortById(forward.widgets)).toEqual(sortById(reverse.widgets));
  });

  it("grows canvas height when push chain exceeds 900px", () => {
    const layout = baseLayout([
      widget("a", 0, 800, 300, 80, 1),
      widget("b", 0, 820, 300, 80, 2),
    ]);
    const resolved = resolvePixelCollisions(layout, "a", { x: 0, y: 820, width: 300, height: 80 });
    expect(resolved.canvas.height).toBeGreaterThanOrEqual(900);
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("packs overlapping widgets seamlessly from the top-left", () => {
    const layout = baseLayout([
      widget("a", 0, 0, 300, 200, 1),
      widget("b", 20, 40, 300, 200, 2),
      widget("c", 40, 80, 300, 200, 3),
    ]);
    const packed = packPixelLayoutSeamless(layout);
    expect(layoutsOverlap(packed, 0)).toBe(false);
    expect(packed.widgets[0]).toMatchObject({ x: 0, y: 0 });
    expect(packed.widgets[1]).toMatchObject({ x: 300, y: 0 });
    expect(packed.widgets[2]).toMatchObject({ x: 600, y: 0 });
  });

  it("terminates when many widgets start fully overlapping", () => {
    const widgets = Array.from({ length: 20 }, (_, index) =>
      widget(`w${index}`, 0, 0, 240, 160, index + 1),
    );
    const resolved = packPixelLayoutSeamless(baseLayout(widgets));
    expect(layoutsOverlap(resolved, 0)).toBe(false);
    expect(resolved.widgets.at(-1)?.y).toBeGreaterThan(0);
  });

  it("finds the next open slot to the right before wrapping downward", () => {
    const occupied = [
      { x: 0, y: 0, width: 480, height: 320 },
      { x: 480, y: 0, width: 480, height: 320 },
    ];
    const slot = findNextOpenSlot({ width: 480, height: 320 }, occupied, { width: 1440, height: 900 });
    expect(slot).toEqual({ x: 960, y: 0 });
  });

  it("finds a non-overlapping slot when occupied rects already overlap", () => {
    const occupied = [
      { x: 0, y: 0, width: 480, height: 320 },
      { x: 100, y: 100, width: 480, height: 320 },
    ];
    const size = { width: 480, height: 320 };
    const canvas = { width: 1440, height: 900 };
    const slot = findNextOpenSlot(size, occupied, canvas);
    const candidate = { ...slot, ...size };
    for (const rect of occupied) {
      expect(rectsOverlap(rect, candidate, 0)).toBe(false);
    }
  });

  it("does not leave overlaps in a dense grid move", () => {
    const layout = baseLayout([
      widget("a", 0, 0, 480, 320, 1),
      widget("b", 480, 0, 480, 320, 2),
      widget("c", 0, 320, 480, 320, 3),
      widget("d", 480, 320, 480, 320, 4),
      widget("e", 240, 160, 480, 320, 5),
    ]);
    const activeRect = { x: 100, y: 200, width: 480, height: 320 };
    const resolved = resolvePixelCollisions(layout, "e", activeRect);
    expect(layoutsOverlap(resolved, 0)).toBe(false);
    expect(resolved.widgets.find((item) => item.id === "e")).toMatchObject(activeRect);
  });

  it("centers palette widgets on canvas when viewport is unavailable", () => {
    const layout = baseLayout([widget("a", 0, 0, 360, 220, 1)]);
    const resolved = insertPixelPaletteWidget("bar", layout);
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ x: 0, y: 0 });
    expect(resolved.widgets.find((item) => item.id !== "a")).toMatchObject({
      x: 480,
      y: 300,
      width: 480,
      height: 300,
    });
  });

  it("inserts palette widgets at the visible viewport center on click", () => {
    const layout = baseLayout([]);
    const viewport = { x: 400, y: 200, width: 640, height: 400 };
    const resolved = insertPixelPaletteWidget("bar", layout, viewport);
    expect(resolved.widgets[0]).toMatchObject({ x: 480, y: 250, width: 480, height: 300 });
  });

  it("centers palette widgets on an empty canvas when viewport is unavailable", () => {
    const layout = baseLayout([]);
    const resolved = insertPixelPaletteWidget("bar", layout);
    const inserted = resolved.widgets[0];
    expect(inserted).toMatchObject({ x: 480, y: 300, width: 480, height: 300 });
  });

  it("pushes tab hosts like any other widget when overlapped", () => {
    const tabs: PixelLayoutWidget = {
      id: "tabs",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 100,
      y: 200,
      width: 400,
      height: 240,
      tabsConfig: {
        activePaneId: "p1",
        panes: [{ id: "p1", title: "页签 1", childWidgetIds: [] }],
      },
    };
    const chart = widget("chart", 120, 220, 300, 180, 1);
    const layout = baseLayout([tabs, chart]);
    const resolved = resolvePixelCollisions(layout, "chart", {
      x: 100,
      y: 200,
      width: 300,
      height: 180,
    });
    const chartPos = resolved.widgets.find((w) => w.id === "chart");
    expect(chartPos).toMatchObject({ x: 100, y: 200 });
    const tabsPos = resolved.widgets.find((w) => w.id === "tabs");
    expect(tabsPos?.y).toBe(380);
    expect(layoutsOverlap(resolved, 0)).toBe(false);
  });

  it("keeps overlapping widgets in place on data-screen surfaces", () => {
    const a = widget("a", 100, 100, 300, 200, 1);
    const b = widget("b", 180, 160, 300, 200, 2);
    const screenLayout: DashboardLayoutV2 = {
      ...baseLayout([a, b]),
      styleConfig: { surfaceKind: "data-screen" },
    };
    const resolved = resolvePixelLayoutWithActiveRect(screenLayout, "a", {
      x: 120,
      y: 120,
      width: 300,
      height: 200,
    });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({ x: 120, y: 120 });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ x: 180, y: 160 });
    expect(layoutsOverlap(resolved, 0)).toBe(true);
  });

  it("applyActiveWidgetRect only mutates the active widget", () => {
    const a = widget("a", 0, 0, 200, 120, 1);
    const b = widget("b", 220, 0, 200, 120, 2);
    const resolved = applyActiveWidgetRect(baseLayout([a, b]), "a", {
      x: 40,
      y: 40,
      width: 240,
      height: 160,
    });
    expect(resolved.widgets.find((item) => item.id === "a")).toMatchObject({
      x: 40,
      y: 40,
      width: 240,
      height: 160,
    });
    expect(resolved.widgets.find((item) => item.id === "b")).toMatchObject({ x: 220, y: 0 });
  });
});
