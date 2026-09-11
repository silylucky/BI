import { describe, expect, it } from "vitest";
import { ensureChartSlotCapacity } from "@/components/dashboard/chartFieldSlots";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

describe("ensureChartSlotCapacity", () => {
  it("trims extra dimensions when switching to timeline", () => {
    const cfg: ChartViewConfig = {
      chartType: "timeline",
      styleVariant: "default",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT 1",
      dimensions: [{ field: "t" }, { field: "cat" }],
      metrics: [{ field: "v" }],
    };
    const next = ensureChartSlotCapacity(cfg);
    expect(next.dimensions).toHaveLength(1);
    expect(next.dimensions?.[0]?.field).toBe("t");
  });
});
