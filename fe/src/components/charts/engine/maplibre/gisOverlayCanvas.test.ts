import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOverlayCanvasLayout,
  readMapOverlayPaintSize,
  readOverlayLayoutSize,
  syncOverlayCanvasSize,
} from "@/components/charts/engine/maplibre/gisOverlayCanvas";

describe("readMapOverlayPaintSize", () => {
  it("prefers map canvas client size when canvas-container has no layout height", () => {
    const container = document.createElement("div");
    const mapCanvas = document.createElement("canvas");
    Object.defineProperty(mapCanvas, "clientWidth", { value: 990, configurable: true });
    Object.defineProperty(mapCanvas, "clientHeight", { value: 792, configurable: true });
    Object.defineProperty(container, "clientWidth", { value: 990, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 0, configurable: true });

    const map = { getCanvas: () => mapCanvas } as import("maplibre-gl").Map;
    expect(readMapOverlayPaintSize(map, container)).toEqual({ width: 990, height: 792 });
    expect(readOverlayLayoutSize(container)).toEqual({ width: 990, height: 1 });
  });
});

describe("applyOverlayCanvasLayout", () => {
  it("sets explicit px size so h-full does not collapse on canvas-container", () => {
    const canvas = document.createElement("canvas");
    canvas.className = "pointer-events-none absolute h-full w-full";
    applyOverlayCanvasLayout(canvas, 990, 792);
    expect(canvas.style.width).toBe("990px");
    expect(canvas.style.height).toBe("792px");
    expect(canvas.style.top).toBe("0px");
    expect(canvas.style.left).toBe("0px");
  });
});

describe("syncOverlayCanvasSize", () => {
  it("updates canvas bitmap when container grows", () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const lastSize = { width: 0, height: 0 };

    expect(syncOverlayCanvasSize(canvas, ctx, 320, 240, lastSize)).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    expect(lastSize).toEqual({ width: 320, height: 240 });

    const widthBefore = canvas.width;
    expect(syncOverlayCanvasSize(canvas, ctx, 320, 240, lastSize)).toBe(false);
    expect(canvas.width).toBe(widthBefore);

    expect(syncOverlayCanvasSize(canvas, ctx, 640, 480, lastSize)).toBe(true);
    expect(canvas.width).toBeGreaterThan(widthBefore);
    expect(lastSize).toEqual({ width: 640, height: 480 });
  });
});

describe("gis overlay resize regression", () => {
  it("starfield syncs canvas size during paint, not only on ResizeObserver", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/charts/engine/maplibre/gisStarfield.ts"),
      "utf8",
    );
    expect(source).toContain("syncCanvasSize(width, height)");
    expect(source).not.toContain("canvas.style.width");
  });
});
