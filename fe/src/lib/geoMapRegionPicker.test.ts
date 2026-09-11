import { describe, expect, it } from "vitest";
import {
  buildGeoMapDrillStackFromSelection,
  buildLinkedChartInstanceOverlay,
  formatGeoMapRegionSelectionLabel,
  parseGeoMapDrillStackSelection,
  validateManualGeoMapDrillStack,
} from "./geoMapRegionPicker";

const mapConfig = {
  chartType: "map",
  dimensions: [{ field: "province" }, { field: "city" }, { field: "district" }],
  metrics: [{ field: "total" }],
} as never;

describe("buildGeoMapDrillStackFromSelection", () => {
  it("builds province-only stack", () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, { province: "广东省" });
    expect(stack).toEqual([
      { field: "province", value: "广东省", label: "广东省" },
    ]);
  });

  it("skips city field for municipality districts", () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, {
      province: "北京市",
      district: "东城区",
    });
    expect(stack).toEqual([
      { field: "province", value: "北京市", label: "北京市" },
      { field: "district", value: "东城区", label: "东城区" },
    ]);
  });

  it("builds province-city-district stack for normal provinces", () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, {
      province: "广东省",
      city: "广州市",
      district: "天河区",
    });
    expect(stack).toEqual([
      { field: "province", value: "广东省", label: "广东省" },
      { field: "city", value: "广州市", label: "广州市" },
      { field: "district", value: "天河区", label: "天河区" },
    ]);
  });
});

describe("parseGeoMapDrillStackSelection", () => {
  it("round-trips municipality district selection", () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, {
      province: "北京市",
      district: "东城区",
    });
    expect(parseGeoMapDrillStackSelection(stack)).toEqual({
      province: "北京市",
      district: "东城区",
    });
  });
});

describe("formatGeoMapRegionSelectionLabel", () => {
  it("shows leaf region name", () => {
    expect(
      formatGeoMapRegionSelectionLabel({
        province: "北京市",
        district: "东城区",
      }),
    ).toBe("东城区");
  });

  it("falls back to national label", () => {
    expect(formatGeoMapRegionSelectionLabel(null)).toBe("全国");
    expect(formatGeoMapRegionSelectionLabel(parseGeoMapDrillStackSelection([]))).toBe("全国");
  });

  it("persists empty manualDrillStack for national selection", () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, null);
    expect(stack).toEqual([]);
  });
});

describe("buildLinkedChartInstanceOverlay", () => {
  it("keeps only manualDrillStack and viewTransforms for linked persist", () => {
    const overlay = buildLinkedChartInstanceOverlay({
      chartType: "map",
      mode: "sql",
      dataSourceId: "ds-1",
      sql: "select 1",
      dimensions: [{ field: "province" }],
      metrics: [{ field: "total" }],
      nativeBody: {
        deStyle: {
          geo: {
            manualDrillStack: [{ field: "province", value: "内蒙古自治区", label: "内蒙古自治区" }],
            viewTransforms: { "vs-regions": { x: 12, y: 8, k: 1.2 } },
            showZoomControl: true,
          },
        },
      },
    } as never);
    expect(overlay?.chartType).toBe("map");
    expect(overlay?.dataSourceId).toBeUndefined();
    expect(overlay?.nativeBody?.deStyle?.geo?.manualDrillStack).toEqual([
      { field: "province", value: "内蒙古自治区", label: "内蒙古自治区" },
    ]);
    expect(overlay?.nativeBody?.deStyle?.geo?.viewTransforms).toEqual({
      "vs-regions": { x: 12, y: 8, k: 1.2 },
    });
    expect(overlay?.nativeBody?.deStyle?.geo?.showZoomControl).toBeUndefined();
  });
});

describe("validateManualGeoMapDrillStack", () => {
  it("accepts guangdong drill", async () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, { province: "广东省" });
    const result = await validateManualGeoMapDrillStack(mapConfig, stack);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown province", async () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, { province: "不存在省" });
    const result = await validateManualGeoMapDrillStack(mapConfig, stack);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("未识别");
    }
  });

  it("accepts city drill when district assets are missing", async () => {
    const stack = buildGeoMapDrillStackFromSelection(mapConfig, {
      province: "广东省",
      city: "东莞市",
    });
    const result = await validateManualGeoMapDrillStack(mapConfig, stack);
    expect(result.ok).toBe(true);
  });
});
