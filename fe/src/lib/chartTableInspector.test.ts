import { describe, expect, it } from "vitest";
import { chartInspectorCapabilities } from "./chartInspectorCapabilities";
import { chartStyleSectionsForType } from "./chartStyleSectionRegistry";
import { tableInspectorProfile } from "./chartTableInspector";

describe("chartTableInspector", () => {
  it("differentiates table-info vs pivot style controls", () => {
    const info = tableInspectorProfile("table-info");
    const pivot = tableInspectorProfile("table-pivot");
    expect(info?.showSeriesNumber).toBe(true);
    expect(info?.showPagination).toBe(true);
    expect(pivot?.showSeriesNumber).toBe(false);
    expect(pivot?.showPagination).toBe(true);
    expect(pivot?.showSubTotals).toBe(true);
  });

  it("matrix heatmap uses geo style sections for matrix heatmap", () => {
    expect(chartStyleSectionsForType("t-heatmap")).toEqual(["background", "palette", "geo", "title"]);
  });

  it("table-info includes dedicated tableColor section", () => {
    expect(tableInspectorProfile("table-info")?.styleSections).toContain("tableColor");
  });

  it("table-info advanced enables time range", () => {
    const caps = chartInspectorCapabilities("table-info");
    expect(caps.timeRange).toBe(true);
    expect(caps.conditional).toBe(false);
  });

  it("t-heatmap advanced enables conditional", () => {
    const caps = chartInspectorCapabilities("t-heatmap");
    expect(caps.conditional).toBe(true);
  });
});
