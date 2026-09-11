import { describe, expect, it } from "vitest";
import {
  chooseVisibleMarkLines,
  computeMarkLineSnap,
  markLineThreshold,
  resolveMarkLineDragDir,
  type DragDirection,
} from "./pixelMarkLine";
import type { PixelRect } from "./geometry";

const dragRightDown: DragDirection = { isRightward: true, isDownward: true };
const dragLeftUp: DragDirection = { isRightward: false, isDownward: false };

describe("pixelMarkLine", () => {
  it("snaps top edges within threshold and shows xt", () => {
    const active: PixelRect = { x: 100, y: 102, width: 200, height: 120 };
    const other: PixelRect = { x: 400, y: 100, width: 200, height: 80 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: dragLeftUp,
    });

    expect(result.rect.y).toBe(100);
    expect(result.guides).toEqual([{ id: "xt", position: 100 }]);
  });

  it("snaps vertical centers and shows yc", () => {
    const active: PixelRect = { x: 452, y: 50, width: 200, height: 80 };
    const other: PixelRect = { x: 400, y: 200, width: 300, height: 120 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: dragLeftUp,
    });

    expect(result.rect.x).toBe(450);
    expect(result.guides).toEqual([{ id: "yc", position: 550 }]);
  });

  it("returns no guides when outside threshold", () => {
    const active: PixelRect = { x: 100, y: 200, width: 200, height: 120 };
    const other: PixelRect = { x: 400, y: 100, width: 200, height: 120 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: dragRightDown,
    });

    expect(result.rect).toEqual(active);
    expect(result.guides).toEqual([]);
  });

  it("prefers the closest snap candidate within threshold", () => {
    const active: PixelRect = { x: 98, y: 100, width: 200, height: 120 };
    const near: PixelRect = { x: 400, y: 100, width: 200, height: 80 };
    const far: PixelRect = { x: 700, y: 104, width: 200, height: 80 };

    const result = computeMarkLineSnap(active, [far, near], {
      threshold: 8,
      dragDir: dragLeftUp,
    });

    expect(result.rect.y).toBe(100);
    expect(result.guides).toEqual([{ id: "xt", position: 100 }]);
  });

  it("snaps outer right edge flush to neighbor left within threshold", () => {
    const active: PixelRect = { x: 303, y: 50, width: 200, height: 120 };
    const other: PixelRect = { x: 0, y: 80, width: 300, height: 120 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: dragRightDown,
    });

    expect(result.rect.x).toBe(300);
    expect(result.guides).toContainEqual({ id: "yr", position: 300 });
  });

  it("snaps outer rects flush without gap midline or chrome inset", () => {
    const active: PixelRect = { x: 298, y: 50, width: 200, height: 120 };
    const other: PixelRect = { x: 0, y: 80, width: 300, height: 120 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: dragRightDown,
      gap: 5,
      chromeInset: { top: 0, right: 0, bottom: 0, left: 8 },
    });

    expect(result.rect.x).toBe(300);
    expect(result.guides).toContainEqual({ id: "yr", position: 300 });
  });

  it("aligns outer top edges and draws guide on the neighbor edge", () => {
    const active: PixelRect = { x: 100, y: 102, width: 200, height: 120 };
    const other: PixelRect = { x: 400, y: 100, width: 200, height: 80 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: dragLeftUp,
      gap: 8,
    });

    expect(result.rect.y).toBe(100);
    expect(result.guides).toEqual([{ id: "xt", position: 100 }]);
  });

  it("prefers one horizontal and one vertical guide by drag direction", () => {
    const guides = chooseVisibleMarkLines(
      [
        { id: "xt", position: 100 },
        { id: "xb", position: 220 },
        { id: "yl", position: 50 },
        { id: "yr", position: 350 },
      ],
      dragRightDown,
    );

    expect(guides).toEqual([
      { id: "xb", position: 220 },
      { id: "yr", position: 350 },
    ]);
  });

  it("prefers xt and yl when dragging left and up", () => {
    const guides = chooseVisibleMarkLines(
      [
        { id: "xt", position: 100 },
        { id: "xb", position: 220 },
        { id: "yl", position: 50 },
        { id: "yr", position: 350 },
      ],
      dragLeftUp,
    );

    expect(guides).toEqual([
      { id: "xt", position: 100 },
      { id: "yl", position: 50 },
    ]);
  });

  it("does not snap to canvas edges", () => {
    const active: PixelRect = { x: 1242, y: 100, width: 200, height: 120 };

    const result = computeMarkLineSnap(active, [], {
      threshold: 3,
      dragDir: dragRightDown,
      canvas: { width: 1440, height: 900 },
    });

    expect(result.rect).toEqual(active);
    expect(result.guides).toEqual([]);
  });

  it("converts screen threshold to canvas coords by scale", () => {
    expect(markLineThreshold(1)).toBe(10);
    expect(markLineThreshold(0.5)).toBe(20);
    expect(markLineThreshold(2)).toBe(5);
  });

  it("snaps bottom edge while resizing south", () => {
    const active: PixelRect = { x: 100, y: 100, width: 200, height: 198 };
    const other: PixelRect = { x: 400, y: 100, width: 200, height: 200 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: { isRightward: false, isDownward: true },
      interactionKind: "s",
      anchorRect: { x: 100, y: 100, width: 200, height: 120 },
    });

    expect(result.rect.height).toBe(200);
    expect(result.guides).toContainEqual({ id: "xb", position: 300 });
  });

  it("snaps right edge while resizing east", () => {
    const active: PixelRect = { x: 100, y: 100, width: 298, height: 120 };
    const other: PixelRect = { x: 400, y: 100, width: 200, height: 120 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: { isRightward: true, isDownward: false },
      interactionKind: "e",
      anchorRect: { x: 100, y: 100, width: 200, height: 120 },
    });

    expect(result.rect.width).toBe(300);
    expect(result.guides).toContainEqual({ id: "yl", position: 400 });
  });

  it("ignores left-edge snap while resizing east only", () => {
    const active: PixelRect = { x: 98, y: 100, width: 200, height: 120 };
    const other: PixelRect = { x: 500, y: 100, width: 200, height: 120 };

    const result = computeMarkLineSnap(active, [other], {
      threshold: 3,
      dragDir: { isRightward: true, isDownward: false },
      interactionKind: "e",
      anchorRect: { x: 100, y: 100, width: 200, height: 120 },
    });

    expect(result.rect.x).toBe(98);
    expect(result.guides).toEqual([]);
  });

  it("does not snap resize edge back to anchor position but still shows guide", () => {
    const anchor = { x: 100, y: 100, width: 300, height: 200 };
    const active: PixelRect = { x: 100, y: 100, width: 300, height: 218 };
    const neighborBelow: PixelRect = { x: 100, y: 300, width: 300, height: 200 };

    const result = computeMarkLineSnap(active, [neighborBelow], {
      threshold: 20,
      dragDir: { isRightward: false, isDownward: true },
      interactionKind: "s",
      anchorRect: anchor,
    });

    expect(result.rect.height).toBe(218);
    expect(result.guides).toEqual([{ id: "xt", position: 300 }]);
  });

  it("keeps stable drag direction for southwest resize when pointer crosses start", () => {
    const anchor: PixelRect = { x: 200, y: 120, width: 320, height: 200 };
    const shrunk: PixelRect = { x: 240, y: 120, width: 280, height: 160 };
    const pointerCrossed: DragDirection = { isRightward: true, isDownward: false };

    expect(resolveMarkLineDragDir("sw", shrunk, anchor, pointerCrossed)).toEqual({
      isRightward: true,
      isDownward: false,
    });
  });

  it("shows horizontal and vertical guides while resizing southwest near neighbors", () => {
    const anchor: PixelRect = { x: 80, y: 60, width: 360, height: 240 };
    const active: PixelRect = { x: 82, y: 62, width: 358, height: 238 };
    const leftNeighbor: PixelRect = { x: 20, y: 80, width: 60, height: 200 };
    const bottomNeighbor: PixelRect = { x: 100, y: 302, width: 300, height: 120 };

    const result = computeMarkLineSnap(active, [leftNeighbor, bottomNeighbor], {
      threshold: 12,
      dragDir: { isRightward: true, isDownward: false },
      interactionKind: "sw",
      anchorRect: anchor,
    });

    expect(result.guides).toHaveLength(2);
    const horizontalIds = new Set(["xt", "xc", "xb"]);
    expect(result.guides.some((guide) => horizontalIds.has(guide.id))).toBe(true);
    expect(result.guides.some((guide) => !horizontalIds.has(guide.id))).toBe(true);
  });

  it("snaps southwest resize to neighbor edges within threshold", () => {
    const anchor: PixelRect = { x: 100, y: 80, width: 300, height: 200 };
    const active: PixelRect = { x: 112, y: 80, width: 288, height: 188 };
    const leftNeighbor: PixelRect = { x: 20, y: 80, width: 80, height: 200 };
    const bottomNeighbor: PixelRect = { x: 100, y: 284, width: 300, height: 120 };

    const result = computeMarkLineSnap(active, [leftNeighbor, bottomNeighbor], {
      threshold: 16,
      dragDir: { isRightward: true, isDownward: false },
      interactionKind: "sw",
      anchorRect: anchor,
    });

    expect(result.rect).toMatchObject({ x: 100, y: 80, width: 300, height: 204 });
  });
});
