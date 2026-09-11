import { describe, expect, it } from "vitest";
import {
  resolveHubWidgetFilter,
  WIDGET_TYPE_FILTERS,
} from "@/components/dashboard/viz-components/componentLabels";
import { DE_PALETTE_CATEGORY_SECTIONS } from "@/lib/chartPaletteTaxonomy";

describe("viz component hub filters", () => {
  it("expands chart palette categories instead of a single 图表 tab", () => {
    const labels = WIDGET_TYPE_FILTERS.map((item) => item.label);
    expect(labels).toContain("全部类型");
    expect(labels).not.toContain("图表");
    for (const section of DE_PALETTE_CATEGORY_SECTIONS) {
      expect(labels).toContain(section.label);
    }
    expect(labels).toContain("筛选器");
    expect(labels).toContain("富文本");
    expect(labels).toContain("媒体");
  });

  it("maps palette category filters to chart widget + chartPaletteCategory", () => {
    expect(resolveHubWidgetFilter("trend")).toEqual({
      widgetType: "chart",
      chartPaletteCategory: "trend",
    });
    expect(resolveHubWidgetFilter("filter")).toEqual({ widgetType: "filter" });
    expect(resolveHubWidgetFilter("all")).toEqual({});
  });
});
