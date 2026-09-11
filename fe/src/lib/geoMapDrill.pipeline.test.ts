import { describe, expect, it } from "vitest";
import type { ChartDrillFrame } from "@/lib/chartDrill";
import { drillBreadcrumbLabels } from "@/lib/chartDrill";
import { applyMapChartDrillPipeline, getMapDrillDisplayField } from "@/lib/geoMapDrill";
import { resolveGeoMapLevelContext } from "@/lib/geoMapLevels";
import { VS_REGIONS_MAP_ID } from "@/lib/geoMapChart";

const mapConfig = {
  chartType: "map",
  dimensions: [{ field: "province" }, { field: "city" }, { field: "district" }],
  metrics: [{ field: "total" }],
} as never;

const rows = [
  ["广东省", "广州市", "天河区", 100],
  ["广东省", "广州市", "越秀区", 80],
  ["广东省", "东莞市", "东莞市", 50],
  ["北京市", "北京市", "朝阳区", 60],
];
const columns = ["province", "city", "district", "total"];

async function expectDrillLevel(
  stack: ChartDrillFrame[],
  expected: { mapId: string; drillDepth: number; displayField: string },
) {
  const ctx = await resolveGeoMapLevelContext({ config: mapConfig, drillStack: stack });
  expect(ctx.mapId).toBe(expected.mapId);
  expect(ctx.drillDepth).toBe(expected.drillDepth);
  expect(getMapDrillDisplayField(mapConfig, stack)).toBe(expected.displayField);
}

describe("map drill pipeline verification", () => {
  it("walks guangdong → guangzhou → district with aggregated rows", async () => {
    await expectDrillLevel([], {
      mapId: VS_REGIONS_MAP_ID,
      drillDepth: 0,
      displayField: "province",
    });

    const provinceStack: ChartDrillFrame[] = [
      { field: "province", value: "广东省", label: "广东省" },
    ];
    await expectDrillLevel(provinceStack, {
      mapId: "vs-geo-440000",
      drillDepth: 1,
      displayField: "city",
    });

    const cityStack: ChartDrillFrame[] = [
      ...provinceStack,
      { field: "city", value: "广州市", label: "广州市" },
    ];
    await expectDrillLevel(cityStack, {
      mapId: "vs-geo-440100",
      drillDepth: 2,
      displayField: "district",
    });

    const pipeline = applyMapChartDrillPipeline(mapConfig, columns, rows, cityStack);
    expect(pipeline.displayField).toBe("district");
    expect(pipeline.rows).toEqual([
      ["广东省", "广州市", "天河区", 100],
      ["广东省", "广州市", "越秀区", 80],
    ]);
  });

  it("skips city slot for municipalities in display field", async () => {
    const stack: ChartDrillFrame[] = [
      { field: "province", value: "北京市", label: "北京市" },
    ];
    await expectDrillLevel(stack, {
      mapId: "vs-geo-110000",
      drillDepth: 1,
      displayField: "district",
    });
  });

  it("builds breadcrumb labels for guangdong drill stack", () => {
    const stack: ChartDrillFrame[] = [
      { field: "province", value: "广东省", label: "广东省" },
      { field: "city", value: "广州市", label: "广州市" },
    ];
    expect(drillBreadcrumbLabels(stack)).toEqual(["广东省", "广州市"]);
  });
});
