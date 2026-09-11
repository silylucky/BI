import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { patchChartDeStyleNested, readChartDeStyle } from "@/lib/chartDeStyle";
import { readChartGeoAreaMapping } from "@/lib/chartGeoAreaMapping";

describe("chartGeoAreaMapping persist round-trip", () => {
  it("survives JSON serialize/deserialize like dashboard save", () => {
    let cfg = defaultChartConfig("map");
    cfg = patchChartDeStyleNested(cfg, "geo", {
      areaMapping: [{ id: "m1", from: "EAST_01", to: "江苏省" }],
    });

    const roundtripped = JSON.parse(JSON.stringify(cfg)) as typeof cfg;
    expect(readChartGeoAreaMapping(readChartDeStyle(roundtripped))).toEqual([
      { id: "m1", from: "EAST_01", to: "江苏省" },
    ]);
  });
});
