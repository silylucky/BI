import { describe, expect, it } from "vitest";
import {
  GEO_MAP_LEVEL_LOAD_FAILED_MSG,
  isGeoMapLevelReady,
} from "@/hooks/useGeoMapLevel";
import { VS_REGIONS_MAP_ID } from "@/lib/geoMapChart";

describe("isGeoMapLevelReady", () => {
  const national = {
    mapId: VS_REGIONS_MAP_ID,
    knownRegionNames: [],
    drillDepth: 0,
    levelLabel: "省级",
  };

  it("blocks while resolving", () => {
    expect(isGeoMapLevelReady([], national, true)).toBe(false);
  });

  it("allows national when stack empty and depth 0", () => {
    expect(isGeoMapLevelReady([], national, false)).toBe(true);
  });

  it("blocks when stack advanced but level still national", () => {
    expect(
      isGeoMapLevelReady(
        [{ field: "province", value: "湖南省" }],
        national,
        false,
      ),
    ).toBe(false);
  });

  it("allows province drill when depth matches", () => {
    expect(
      isGeoMapLevelReady(
        [{ field: "province", value: "湖南省" }],
        {
          mapId: "vs-geo-430000",
          knownRegionNames: [],
          drillDepth: 1,
          levelLabel: "市级",
        },
        false,
      ),
    ).toBe(true);
  });

  it("allows failed drill with missing asset", () => {
    expect(
      isGeoMapLevelReady(
        [{ field: "province", value: "台湾省" }],
        {
          ...national,
          missingAsset: "台湾省暂无市级离线边界资产",
        },
        false,
      ),
    ).toBe(true);
  });

  it("allows resolve failure context to exit loading gate", () => {
    expect(
      isGeoMapLevelReady(
        [{ field: "province", value: "湖南省" }],
        {
          ...national,
          missingAsset: GEO_MAP_LEVEL_LOAD_FAILED_MSG,
        },
        false,
      ),
    ).toBe(true);
  });
});
