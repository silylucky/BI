import { describe, expect, it } from "vitest";
import "@/components/charts/engine/plugins/index";
import { chartStyleSectionsForType } from "./chartStyleSectionRegistry";

describe("chartStyleSectionsForType", () => {
  it("returns table sections for table-info", () => {
    expect(chartStyleSectionsForType("table-info")).toEqual([
      "tableBasic",
      "tableColor",
      "title",
      "background",
    ]);
  });

  it("returns bar sections from style profile", () => {
    expect(chartStyleSectionsForType("bar")).toEqual([
      "axis",
      "cartesianShape",
      "background",
      "palette",
      "title",
      "remark",
      "legend",
      "label",
      "tooltip",
    ]);
  });

  it("includes geo for map", () => {
    expect(chartStyleSectionsForType("map")).toContain("geo");
    expect(chartStyleSectionsForType("map")).toContain("mapBasic");
    expect(chartStyleSectionsForType("map")).not.toContain("palette");
    expect(chartStyleSectionsForType("map-3d")).toContain("geo");
    expect(chartStyleSectionsForType("map-3d")).not.toContain("palette");
    expect(chartStyleSectionsForType("map-3d")).not.toContain("mapBasic");
    expect(chartStyleSectionsForType("map-3d")).not.toContain("label");
  });

  it("returns kpi sections", () => {
    expect(chartStyleSectionsForType("kpi")).toEqual([
      "background",
      "palette",
      "title",
      "label",
      "kpiIndicator",
    ]);
  });
});
