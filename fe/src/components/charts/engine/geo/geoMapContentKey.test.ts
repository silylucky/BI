import { describe, expect, it } from "vitest";
import { buildGeoMapContentKey } from "./geoMapContentKey";

describe("buildGeoMapContentKey", () => {
  it("同一下钻与数据生成稳定 key", () => {
    const input = {
      chartType: "map-3d",
      mapId: "340000",
      drillDepth: 1,
      drillStack: [{ field: "province", value: "安徽省" }],
      rowCount: 16,
      regionField: "city",
      rowsSample: [{ city: "合肥市" }, { city: "芜湖市" }],
      depthVisual: "off",
      isDark: false,
    };
    expect(buildGeoMapContentKey(input)).toBe(buildGeoMapContentKey(input));
  });

  it("下钻或 mapId 变化时 key 不同", () => {
    const base = {
      chartType: "map-3d",
      mapId: "100000",
      drillDepth: 0,
      drillStack: [] as { field: string; value: string }[],
      rowCount: 34,
      regionField: "province",
      rowsSample: [{ province: "安徽省" }],
      depthVisual: "off",
      isDark: false,
    };
    const national = buildGeoMapContentKey(base);
    const drilled = buildGeoMapContentKey({
      ...base,
      mapId: "340000",
      drillDepth: 1,
      drillStack: [{ field: "province", value: "安徽省" }],
    });
    expect(national).not.toBe(drilled);
  });

  it("areaMapping 变化时 key 不同", () => {
    const base = {
      chartType: "map",
      mapId: "100000",
      drillDepth: 0,
      drillStack: [] as { field: string; value: string }[],
      rowCount: 34,
      regionField: "province",
      rowsSample: [{ province: "安徽省" }],
      depthVisual: "off",
      isDark: false,
      areaMappingSig: "EAST_01=>江苏省",
    };
    expect(
      buildGeoMapContentKey({
        ...base,
        areaMappingSig: "EAST_01=>北京市",
      }),
    ).not.toBe(buildGeoMapContentKey(base));
  });

  it("geo3d 样式签名变化时 key 不同", () => {
    const base = {
      chartType: "map-3d",
      mapId: "100000",
      drillDepth: 0,
      drillStack: [] as { field: string; value: string }[],
      rowCount: 34,
      regionField: "province",
      rowsSample: [{ province: "安徽省" }],
      depthVisual: "off",
      isDark: false,
      geo3dStyleSig: "satellite,1.15,auto,1,0,0",
    };
    const other = buildGeoMapContentKey({
      ...base,
      geo3dStyleSig: "tech,1.15,auto,1,1,1",
    });
    expect(buildGeoMapContentKey(base)).not.toBe(other);
  });
});
