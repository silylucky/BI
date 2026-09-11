import { describe, expect, it } from "vitest";
import { validateManualGeoMapDrillStack } from "@/lib/geoMapRegionPicker";
import {
  findMapDrillFilterValue,
  ensureOfflineGeoMap,
  isOfflineGeoMapReady,
  lookupProvinceAdcode,
  resolveGeoMapLevelContext,
} from "./geoMapLevels";
import { getOfflineGeoMap, registerOfflineGeoMap } from "@/components/charts/engine/geo/OfflineGeoPort";
import { VS_REGIONS_MAP_ID } from "./geoMapChart";

describe("lookupProvinceAdcode", () => {
  it("resolves province full and short names", () => {
    expect(lookupProvinceAdcode("广东省")).toBe(440000);
    expect(lookupProvinceAdcode("广东")).toBe(440000);
    expect(lookupProvinceAdcode("北京市")).toBe(110000);
  });
});

describe("resolveGeoMapLevelContext", () => {
  it("returns national map at depth 0", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map",
        dimensions: [{ field: "province" }, { field: "city" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [],
    });
    expect(ctx.mapId).toBe(VS_REGIONS_MAP_ID);
    expect(ctx.drillDepth).toBe(0);
    expect(ctx.knownRegionNames).toContain("广东省");
  });

  it("loads city map after province drill", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map",
        dimensions: [{ field: "province" }, { field: "city" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [{ field: "province", value: "广东省", label: "广东省" }],
    });
    expect(ctx.mapId).toBe("vs-geo-440000");
    expect(ctx.drillDepth).toBe(1);
    expect(ctx.levelLabel).toBe("市级");
    expect(ctx.knownRegionNames).toContain("广州市");
  });

  it("loads hunan city map after province drill", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map-3d",
        dimensions: [{ field: "province" }, { field: "city" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [{ field: "province", value: "湖南省", label: "湖南省" }],
    });
    expect(ctx.mapId).toBe("vs-geo-430000");
    expect(ctx.drillDepth).toBe(1);
    expect(isOfflineGeoMapReady("vs-geo-430000")).toBe(true);
    expect(getOfflineGeoMap("vs-geo-430000")?.features?.length).toBeGreaterThan(0);
  });

  it("loads district map after province and city drill", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map",
        dimensions: [{ field: "province" }, { field: "city" }, { field: "district" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [
        { field: "province", value: "广东省", label: "广东省" },
        { field: "city", value: "广州市", label: "广州市" },
      ],
    });
    expect(ctx.mapId).toBe("vs-geo-440100");
    expect(ctx.drillDepth).toBe(2);
    expect(ctx.levelLabel).toBe("区县级");
    expect(ctx.knownRegionNames).toContain("天河区");
  });

  it("shows municipality districts at depth 1", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map",
        dimensions: [{ field: "province" }, { field: "city" }, { field: "district" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [{ field: "province", value: "北京市", label: "北京市" }],
    });
    expect(ctx.mapId).toBe("vs-geo-110000");
    expect(ctx.drillDepth).toBe(1);
    expect(ctx.levelLabel).toBe("区县级");
    expect(ctx.knownRegionNames.length).toBeGreaterThan(0);
  });

  it("reports missing city asset for Taiwan", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map",
        dimensions: [{ field: "province" }, { field: "city" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [{ field: "province", value: "台湾省", label: "台湾省" }],
    });
    expect(ctx.missingAsset).toBe("台湾省暂无市级离线边界资产");
    expect(ctx.drillDepth).toBe(0);
  });

  it("reports missing district asset and stays at city level", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map",
        dimensions: [{ field: "province" }, { field: "city" }, { field: "district" }],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [
        { field: "province", value: "广东省", label: "广东省" },
        { field: "city", value: "东莞市", label: "东莞市" },
      ],
    });
    expect(ctx.mapId).toBe("vs-geo-440000");
    expect(ctx.drillDepth).toBe(1);
    expect(ctx.missingAsset).toContain("东莞市");
    expect(ctx.missingAsset).toContain("区县离线边界");
  });

  it("drills to city map even when dimension slots are not configured", async () => {
    const ctx = await resolveGeoMapLevelContext({
      config: {
        chartType: "map-3d",
        dimensions: [],
        metrics: [{ field: "total" }],
      } as never,
      drillStack: [{ field: "province", value: "广东省", label: "广东省" }],
    });
    expect(ctx.mapId).toBe("vs-geo-440000");
    expect(ctx.drillDepth).toBe(1);
    expect(ctx.knownRegionNames).toContain("广州市");
  });

  it("allows manual drill validation without dimension slots", async () => {
    const result = await validateManualGeoMapDrillStack(
      {
        chartType: "map-3d",
        dimensions: [],
        metrics: [{ field: "total" }],
      } as never,
      [{ field: "province", value: "广东省", label: "广东省" }],
    );
    expect(result.ok).toBe(true);
  });
});

describe("ensureOfflineGeoMap", () => {
  it("recovers province map after registry was cleared", async () => {
    const mapId = "vs-geo-430000";
    expect(await ensureOfflineGeoMap(mapId)).toBe(true);
    const featureCount = getOfflineGeoMap(mapId)?.features?.length ?? 0;
    expect(featureCount).toBeGreaterThan(0);

    registerOfflineGeoMap(mapId, { features: [] });
    expect(getOfflineGeoMap(mapId)?.features?.length).toBe(0);

    expect(await ensureOfflineGeoMap(mapId)).toBe(true);
    expect(getOfflineGeoMap(mapId)?.features?.length).toBeGreaterThan(0);
  });
});

describe("findMapDrillFilterValue", () => {
  it("maps clicked map label to row value", () => {
    const rows = [
      ["广东", 100],
      ["北京市", 80],
    ];
    const columns = ["province", "total"];
    const known = ["广东省", "北京市", "上海市"];
    expect(findMapDrillFilterValue("广东省", "province", rows, columns, known)).toBe("广东");
  });

  it("returns original business value when areaMapping resolves row", () => {
    const rows = [["EAST_01", 100]];
    const columns = ["province", "total"];
    const known = ["江苏省", "北京市"];
    const lookup = new Map([["EAST_01", "江苏省"]]);
    expect(
      findMapDrillFilterValue("江苏省", "province", rows, columns, known, lookup),
    ).toBe("EAST_01");
  });
});
