import { describe, expect, it } from "vitest";
import {
  createLayoutHistoryStacks,
  layoutFingerprint,
  pushLayoutHistory,
  redoLayout,
  undoLayout,
} from "./layoutHistory";
import { defaultChartConfig, type LayoutWidget } from "./layoutUtils";

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

describe("layoutHistory", () => {
  it("pushLayoutHistory skips duplicate fingerprint", () => {
    const stacks = createLayoutHistoryStacks();
    const afterFirst = pushLayoutHistory(stacks, [widgetA]);
    expect(afterFirst.past).toHaveLength(1);
    const afterDup = pushLayoutHistory(afterFirst, [widgetA]);
    expect(afterDup.past).toHaveLength(1);
  });

  it("undo restores previous snapshot and redo reapplies", () => {
    let stacks = createLayoutHistoryStacks();
    const initial = [widgetA];
    const changed = [widgetA, widgetB];
    stacks = pushLayoutHistory(stacks, initial);
    const undone = undoLayout(stacks, changed);
    expect(undone?.widgets.map((w) => w.id)).toEqual(["w1"]);
    const redone = redoLayout(undone!.stacks, undone!.widgets);
    expect(redone?.widgets.map((w) => w.id)).toEqual(["w1", "w2"]);
  });

  it("layoutFingerprint is stable for sorted widgets", () => {
    const fp = layoutFingerprint([widgetB, widgetA]);
    expect(fp).toBe(layoutFingerprint([widgetA, widgetB]));
  });
});
