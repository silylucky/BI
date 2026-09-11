import { describe, expect, it, vi } from "vitest";
import {
  collectGeometryChangedWidgetIds,
  dispatchPixelLayoutGeometryCommitted,
  dispatchPixelShapeLiveResize,
  geometryCommitAffectsWidget,
  PIXEL_LAYOUT_GEOMETRY_COMMITTED,
  PIXEL_SHAPE_LIVE_RESIZE,
  resolvePixelWidgetIdFromElement,
} from "./pixelShapeLiveResize";

describe("pixelShapeLiveResize", () => {
  it("dispatches document live resize event", () => {
    const handler = vi.fn();
    document.addEventListener(PIXEL_SHAPE_LIVE_RESIZE, handler);
    dispatchPixelShapeLiveResize();
    document.removeEventListener(PIXEL_SHAPE_LIVE_RESIZE, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("scopes geometry committed to changed widget ids", () => {
    const handler = vi.fn((event: Event) => {
      expect(geometryCommitAffectsWidget(event, "w1")).toBe(true);
      expect(geometryCommitAffectsWidget(event, "w2")).toBe(false);
    });
    document.addEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, handler);
    dispatchPixelLayoutGeometryCommitted(["w1"]);
    document.removeEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("omitted or empty widgetIds do not dispatch and affect nobody", () => {
    const omitEvent = new CustomEvent(PIXEL_LAYOUT_GEOMETRY_COMMITTED, { detail: {} });
    expect(geometryCommitAffectsWidget(omitEvent, "w1")).toBe(false);

    const emptyEvent = new CustomEvent(PIXEL_LAYOUT_GEOMETRY_COMMITTED, {
      detail: { widgetIds: [] },
    });
    expect(geometryCommitAffectsWidget(emptyEvent, "w1")).toBe(false);

    const handler = vi.fn();
    document.addEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, handler);
    dispatchPixelLayoutGeometryCommitted();
    dispatchPixelLayoutGeometryCommitted([]);
    document.removeEventListener(PIXEL_LAYOUT_GEOMETRY_COMMITTED, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("fail-closed when listener cannot resolve widgetId", () => {
    const event = new CustomEvent(PIXEL_LAYOUT_GEOMETRY_COMMITTED, {
      detail: { widgetIds: ["w1"] },
    });
    expect(geometryCommitAffectsWidget(event, null)).toBe(false);
    expect(geometryCommitAffectsWidget(event, undefined)).toBe(false);
  });

  it("collectGeometryChangedWidgetIds only tracks size, not position", () => {
    const before = [
      { id: "a", x: 0, y: 0, width: 100, height: 80 },
      { id: "b", x: 120, y: 0, width: 100, height: 80 },
    ];
    const movedOnly = [
      { id: "a", x: 10, y: 0, width: 100, height: 80 },
      { id: "b", x: 200, y: 40, width: 100, height: 80 },
    ];
    expect(collectGeometryChangedWidgetIds(before, movedOnly)).toEqual([]);
    expect(collectGeometryChangedWidgetIds(before, movedOnly, "a")).toEqual([]);

    const resized = [
      { id: "a", x: 0, y: 0, width: 140, height: 80 },
      { id: "b", x: 120, y: 0, width: 100, height: 80 },
    ];
    expect(collectGeometryChangedWidgetIds(before, resized)).toEqual(["a"]);
    expect(collectGeometryChangedWidgetIds(before, resized, "a")).toEqual(["a"]);
  });

  it("resolvePixelWidgetIdFromElement reads data-component-id", () => {
    const outer = document.createElement("div");
    outer.setAttribute("data-component-id", "chart-9");
    const inner = document.createElement("div");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(resolvePixelWidgetIdFromElement(inner)).toBe("chart-9");
    outer.remove();
  });
});
