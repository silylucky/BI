import { describe, expect, it } from "vitest";
import {
  listBundledCityProvinceAdcodes,
  listBundledDistrictCityAdcodes,
  resolveGeoMapLevelContext,
} from "@/lib/geoMapLevels";
import { VS_REGIONS_MAP_ID } from "@/lib/geoMapChart";

const drillConfig = {
  chartType: "map-3d" as const,
  dimensions: [{ field: "province" }, { field: "city" }, { field: "district" }],
  metrics: [{ field: "total" }],
};

describe("geo map 3d asset audit", () => {
  it("bundles 33 provincial city maps", () => {
    expect(listBundledCityProvinceAdcodes()).toHaveLength(33);
  });

  it("bundles district maps for major cities", () => {
    const districts = listBundledDistrictCityAdcodes();
    expect(districts.length).toBeGreaterThanOrEqual(300);
    expect(districts).toContain(440100);
    expect(districts).toContain(440300);
  });
});

describe("map-3d resolveGeoMapLevelContext", () => {
  it("starts at national provinces", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: drillConfig as never,
      drillStack: [],
    });
    expect(ctx.mapId).toBe(VS_REGIONS_MAP_ID);
    expect(ctx.drillDepth).toBe(0);
    expect(ctx.levelLabel).toBe("省级");
  });

  it("loads guangdong city map at depth 1", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: drillConfig as never,
      drillStack: [{ field: "province", value: "广东省", label: "广东省" }],
    });
    expect(ctx.mapId).toBe("vs-geo-440000");
    expect(ctx.drillDepth).toBe(1);
    expect(ctx.knownRegionNames).toContain("深圳市");
  });

  it("loads guangzhou district map at depth 2", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: drillConfig as never,
      drillStack: [
        { field: "province", value: "广东省", label: "广东省" },
        { field: "city", value: "广州市", label: "广州市" },
      ],
    });
    expect(ctx.mapId).toBe("vs-geo-440100");
    expect(ctx.drillDepth).toBe(2);
    expect(ctx.levelLabel).toBe("区县级");
  });

  it("reports Taiwan missing city asset", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: drillConfig as never,
      drillStack: [{ field: "province", value: "台湾省", label: "台湾省" }],
    });
    expect(ctx.missingAsset).toBe("台湾省暂无市级离线边界资产");
  });
});
