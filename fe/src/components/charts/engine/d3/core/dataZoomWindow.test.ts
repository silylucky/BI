import { describe, expect, it } from "vitest";
import {
  brushSelectionFromWindow,
  clampDataZoomWindow,
  defaultDataZoomWindow,
  panDataZoomWindow,
  sliceByDataZoomWindow,
  sparklineByCategory,
  windowFromBrushSelection,
  rowsInCategories,
  zoomDataZoomWindow,
} from "./dataZoomWindow";

describe("dataZoomWindow", () => {
  it("defaults to the full category range", () => {
    expect(clampDataZoomWindow({ start: 0, end: 1 }, 12)).toEqual({ start: 0, end: 1 });
  });

  it("snaps the window to category edges so the main chart matches the slider", () => {
    const cats = ["一月", "二月", "三月", "四月", "五月", "六月"];
    const window = clampDataZoomWindow({ start: 0.2, end: 0.55 }, cats.length);
    expect(sliceByDataZoomWindow(cats, window)).toEqual(["二月", "三月", "四月"]);
  });

  it("keeps at least one category when the brush collapses", () => {
    const window = clampDataZoomWindow({ start: 0.48, end: 0.49 }, 10);
    expect(sliceByDataZoomWindow(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"], window).length).toBeGreaterThanOrEqual(1);
  });

  it("round-trips brush pixels to the same window", () => {
    const innerW = 400;
    const window = clampDataZoomWindow({ start: 0.25, end: 0.75 }, 8);
    const sel = brushSelectionFromWindow(window, innerW);
    expect(windowFromBrushSelection(sel, innerW, 8)).toEqual(window);
  });

  it("restores the previous window when brush selection is cleared", () => {
    const prev = { start: 0.1, end: 0.4 };
    expect(windowFromBrushSelection(null, 400, 10, prev)).toEqual(clampDataZoomWindow(prev, 10));
  });

  it("aggregates sparkline values by category so the overview matches source data", () => {
    expect(
      sparklineByCategory(
        ["A", "B", "C"],
        [
          { category: "A", value: 10 },
          { category: "A", value: 5 },
          { category: "C", value: 7 },
        ],
      ),
    ).toEqual([15, 0, 7]);
  });

  it("filters rows to the visible category window", () => {
    expect(
      rowsInCategories(
        [
          { __category__: "A", __value__: 1 },
          { __category__: "B", __value__: 2 },
          { __category__: "C", __value__: 3 },
        ],
        ["B", "C"],
      ).map((row) => row.__category__),
    ).toEqual(["B", "C"]);
  });

  it("defaults a local window when there are many categories so the slider can pan", () => {
    expect(defaultDataZoomWindow(6)).toEqual({ start: 0, end: 1 });
    expect(sliceByDataZoomWindow(
      Array.from({ length: 24 }, (_, i) => String(i)),
      defaultDataZoomWindow(24),
    )).toHaveLength(12);
  });

  it("pans the window left and right without changing its span", () => {
    const window = { start: 0.25, end: 0.5 };
    expect(panDataZoomWindow(window, 0.25, 8)).toEqual({ start: 0.5, end: 0.75 });
    expect(panDataZoomWindow({ start: 0, end: 0.25 }, -0.5, 8)).toEqual({ start: 0, end: 0.25 });
    expect(panDataZoomWindow({ start: 0.75, end: 1 }, 0.5, 8)).toEqual({ start: 0.75, end: 1 });
  });

  it("zooms the window around an anchor while staying in 0-1", () => {
    const zoomed = zoomDataZoomWindow({ start: 0, end: 1 }, 0.5, 0.5, 10);
    expect(zoomed.end - zoomed.start).toBeLessThan(1);
    expect(zoomed.start).toBeGreaterThanOrEqual(0);
    expect(zoomed.end).toBeLessThanOrEqual(1);
  });
});
