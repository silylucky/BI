import { describe, expect, it } from "vitest";
import { placeWidgetExact } from "@/components/dashboard/gridLayoutAdapter";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";
import { gridLayoutToWidgets, widgetsToGridLayout } from "@/components/dashboard/gridLayoutAdapter";
import { normalizeGridLayout } from "@/components/dashboard/gridSnapUtils";
import { PALETTE_DROP_ITEM_ID } from "@/components/dashboard/dashboardGridRgl";

describe("Dashboard grid interaction", () => {
  const base: LayoutWidget = {
    id: "w-new",
    type: "chart",
    title: "新图表",
    colSpan: 6,
    rowSpan: 3,
    order: 0,
    chartConfig: defaultChartConfig("bar"),
  };

  it("T-GRID-INT-01: placeWidgetExact keeps RGL drop coordinates", () => {
    const placed = placeWidgetExact(base, { gridX: 6, gridY: 2, colSpan: 6, rowSpan: 4 });
    expect(placed.gridX).toBe(6);
    expect(placed.gridY).toBe(2);
    expect(placed.colSpan).toBe(6);
    expect(placed.rowSpan).toBe(4);
  });

  it("T-GRID-INT-02: drag stop layout round-trip updates widget geometry", () => {
    const widgets: LayoutWidget[] = [
      {
        ...base,
        id: "w1",
        gridX: 0,
        gridY: 0,
        order: 0,
      },
    ];
    const layout = widgetsToGridLayout(widgets);
    const moved = layout.map((item) => (item.i === "w1" ? { ...item, x: 6, y: 0, w: 6, h: 4 } : item));
    const normalized = normalizeGridLayout(moved);
    const next = gridLayoutToWidgets(normalized, widgets);
    expect(next[0].gridX).toBe(6);
    expect(next[0].colSpan).toBe(6);
    expect(next[0].rowSpan).toBe(4);
  });

  it("T-GRID-INT-03: palette drop placeholder id is stable", () => {
    expect(PALETTE_DROP_ITEM_ID).toBe("__palette_drop__");
  });
});
