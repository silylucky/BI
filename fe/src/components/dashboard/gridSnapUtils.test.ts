import { describe, expect, it } from "vitest";
import {
  gridLayoutToWidgets,
  placeNewWidget,
  widgetsToGridLayout,
} from "@/components/dashboard/gridLayoutAdapter";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";
import {
  compactLayoutVertical,
  findFirstFreeSlot,
  normalizeGridLayout,
  snapLayoutToGrid,
} from "./gridSnapUtils";

describe("gridSnapUtils", () => {
  it("T-DASH-GRID-01: compactLayoutVertical removes vertical gaps", () => {
    const layout = [
      { i: "a", x: 0, y: 0, w: 6, h: 3 },
      { i: "b", x: 0, y: 5, w: 6, h: 3 },
    ];
    const compacted = compactLayoutVertical(layout);
    expect(compacted[1].y).toBe(3);
  });

  it("T-DASH-GRID-02: findFirstFreeSlot places second widget beside first 6-col item", () => {
    const layout = [{ i: "a", x: 0, y: 0, w: 6, h: 3 }];
    const slot = findFirstFreeSlot(layout, 6, 3);
    expect(slot).toEqual({ x: 6, y: 0 });
  });

  it("T-DASH-GRID-03: snapLayoutToGrid snaps x for half-width widgets", () => {
    const snapped = snapLayoutToGrid([{ i: "a", x: 4, y: 0, w: 6, h: 3 }]);
    expect(snapped[0].x).toBe(6);
    expect(snapped[0].w).toBe(6);
  });

  it("T-DASH-GRID-06: normalizeGridLayout keeps arbitrary column widths", () => {
    const normalized = normalizeGridLayout([{ i: "a", x: 1, y: 0, w: 5, h: 4 }]);
    expect(normalized[0].w).toBe(5);
    expect(normalized[0].x).toBe(1);
  });
});

describe("placeNewWidget flow", () => {
  const base: LayoutWidget = {
    id: "w1",
    type: "chart",
    title: "A",
    colSpan: 6,
    rowSpan: 3,
    order: 0,
    gridX: 0,
    gridY: 0,
    chartConfig: defaultChartConfig("line"),
  };

  it("T-DASH-GRID-04: second widget flows to same row when space allows", () => {
    const second: LayoutWidget = {
      ...base,
      id: "w2",
      title: "B",
      order: 1,
      gridX: undefined,
      gridY: undefined,
      chartConfig: defaultChartConfig("bar"),
    };
    const placed = placeNewWidget([base], second);
    expect(placed.gridX).toBe(6);
    expect(placed.gridY).toBe(0);
  });

  it("T-DASH-GRID-05: normalizeGridLayout compacts after snap", () => {
    const layout = widgetsToGridLayout([
      base,
      { ...base, id: "w2", order: 1, gridX: 0, gridY: 8 },
    ]);
    const normalized = normalizeGridLayout(layout);
    expect(normalized[1].y).toBeLessThan(8);
  });

  it("T-DASH-GRID-07: toGrid → toWidgets → toGrid preserves positioned coordinates", () => {
    const widgets = [
      { ...base, id: "w1", gridX: 6, gridY: 4, order: 0 },
      { ...base, id: "w2", gridX: 0, gridY: 9, order: 1 },
    ];

    const initialGrid = widgetsToGridLayout(widgets);
    const roundTripped = gridLayoutToWidgets(initialGrid, widgets);
    const finalGrid = widgetsToGridLayout(roundTripped);

    expect(finalGrid.map(({ i, x, y }) => ({ i, x, y }))).toEqual(
      initialGrid.map(({ i, x, y }) => ({ i, x, y })),
    );
    expect(roundTripped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "w1", gridX: 6, gridY: 4 }),
        expect.objectContaining({ id: "w2", gridX: 0, gridY: 9 }),
      ]),
    );
  });

  it("T-DASH-GRID-08: missing coordinates retain flow-layout fallback", () => {
    const layout = widgetsToGridLayout([
      { ...base, id: "w1", gridX: 6, gridY: 4, order: 0 },
      { ...base, id: "w2", gridX: undefined, gridY: undefined, order: 1 },
    ]);

    expect(layout.map(({ i, x, y }) => ({ i, x, y }))).toEqual([
      { i: "w1", x: 0, y: 0 },
      { i: "w2", x: 6, y: 0 },
    ]);
  });
});
