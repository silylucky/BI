import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import {
  applyGisMapScatterConfig,
  DEMO_MAP_SCATTER_DATASET_ID,
  GIS_MAP_SCATTER_SAMPLE_SQL,
  isGisMapScatterConfig,
} from "@/lib/gisMapScatter";

describe("gisMapScatter", () => {
  it("binds demo-map-scatter dataset with lng/lat slots", () => {
    const next = applyGisMapScatterConfig(defaultChartConfig("gis-map"), "ds-1");
    expect(next.mode).toBe("dataset");
    expect(next.datasetId).toBe(DEMO_MAP_SCATTER_DATASET_ID);
    expect(next.dimensions?.map((d) => d.field)).toEqual(["lng", "lat", "point_name"]);
    expect(next.metrics?.[0]?.field).toBe("amount");
    expect(next.sql).toBeUndefined();
    expect(isGisMapScatterConfig(next)).toBe(true);
  });

  it("sample sql references de_map_heat", () => {
    expect(GIS_MAP_SCATTER_SAMPLE_SQL).toContain("de_map_heat");
    expect(GIS_MAP_SCATTER_SAMPLE_SQL).toContain("lng");
  });
});
