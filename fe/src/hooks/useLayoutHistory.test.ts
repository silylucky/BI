import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLayoutHistory } from "@/hooks/useLayoutHistory";
import { defaultChartConfig, type LayoutWidget } from "@/components/dashboard/layoutUtils";

const widgetA: LayoutWidget = {
  id: "w1",
  type: "chart",
  title: "A",
  colSpan: 6,
  rowSpan: 1,
  order: 0,
  chartConfig: defaultChartConfig("table"),
};

const widgetB: LayoutWidget = {
  ...widgetA,
  id: "w2",
  title: "B",
  order: 1,
};

describe("useLayoutHistory", () => {
  it("step back and step forward traverse edit history", () => {
    const { result } = renderHook(() => useLayoutHistory({ keyboardEnabled: false }));

    act(() => {
      result.current.resetWidgets([widgetA]);
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.setWidgets([widgetA, widgetB]);
    });
    expect(result.current.widgets).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });
    expect(result.current.widgets.map((w) => w.id)).toEqual(["w1"]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.widgets.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
