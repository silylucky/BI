import { describe, expect, it } from "vitest";
import {
  expandCustomVizFieldSlotsForUi,
  parseCustomVizFieldSlotGroupsForUi,
} from "./customVizFieldSlots";

describe("parseCustomVizFieldSlotGroupsForUi", () => {
  it("uses multi mode when dimensions.max > 1", () => {
    const groups = parseCustomVizFieldSlotGroupsForUi({
      dimensions: { min: 1, max: 6, label: "明细列" },
      metrics: { min: 0, max: 0, label: "数值列" },
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.uiMode).toBe("multi");
    expect(groups[0]?.label).toBe("明细列");
  });

  it("omits metric group when max is 0", () => {
    const groups = parseCustomVizFieldSlotGroupsForUi({
      dimensions: { min: 1, max: 1, label: "类别" },
      metrics: { min: 0, max: 0, label: "数值" },
    });
    expect(groups.map((g) => g.kind)).toEqual(["dimension"]);
  });
});

describe("expandCustomVizFieldSlotsForUi", () => {
  it("uses default dimension and metric slots when manifest fieldSlots is omitted", () => {
    const slots = expandCustomVizFieldSlotsForUi(undefined);
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.kind)).toEqual(["dimension", "metric"]);
  });

  it("expands metrics.max into indexed UI slots", () => {
    const slots = expandCustomVizFieldSlotsForUi({
      dimensions: { min: 1, max: 1, label: "类别" },
      metrics: { min: 1, max: 2, label: "数值" },
    });
    expect(slots).toHaveLength(3);
    expect(slots.filter((s) => s.kind === "dimension").map((s) => s.index)).toEqual([0]);
    expect(slots.filter((s) => s.kind === "metric").map((s) => s.index)).toEqual([0, 1]);
    expect(slots[2]?.label).toBe("数值 2");
  });

  it("falls back when manifest label is corrupted encoding", () => {
    const slots = expandCustomVizFieldSlotsForUi({
      dimensions: { min: 1, max: 1, label: "??" },
      metrics: { min: 1, max: 1, label: "???" },
    });
    expect(slots[0]?.label).toBe("维度");
    expect(slots[1]?.label).toBe("指标");
  });
});
