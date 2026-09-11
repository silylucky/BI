import { describe, expect, it } from "vitest";
import {
  analyzeGeoMapMatch,
  buildGeoHeatmapEchartsOption,
  buildGeoHeatmapPlaceholderEchartsOption,
  buildGeoMapEchartsOption,
  buildGeoMapPlaceholderEchartsOption,
  isGeoHeatmapPlaceholderOption,
  isNumericRegionIdDimension,
  resolveDemoMysqlRegionId,
  resolveEmbeddedGeoRoam,
  resolveMapRegionName,
  resolveRegionMetricValue,
  listVsRegionNames,
  VS_GEO_HEATMAP_PLACEHOLDER_FLAG,
  VS_GEO_MAP_PLACEHOLDER_FLAG,
} from "./geoMapChart";
import { buildAreaMappingLookup } from "./chartGeoAreaMapping";

describe("resolveMapRegionName", () => {
  it("matches province names with administrative suffixes", () => {
    expect(resolveMapRegionName("北京市").name).toBe("北京市");
    expect(resolveMapRegionName("广东省").name).toBe("广东省");
    expect(resolveMapRegionName("上海").name).toBe("上海市");
    expect(resolveMapRegionName("上海").matched).toBe(true);
  });

  it("resolves region codes and adcodes", () => {
    expect(resolveMapRegionName("BJ").name).toBe("北京市");
    expect(resolveMapRegionName("110000").name).toBe("北京市");
  });

  it("applies user areaMapping before built-in rules", () => {
    const lookup = buildAreaMappingLookup([{ id: "1", from: "EAST_01", to: "江苏省" }]);
    expect(resolveMapRegionName("EAST_01", undefined, lookup).name).toBe("江苏省");
    expect(resolveMapRegionName("EAST_01", undefined, lookup).matched).toBe(true);
  });
});

describe("analyzeGeoMapMatch", () => {
  it("flags unmatched numeric region ids without demo mapping", () => {
    const stats = analyzeGeoMapMatch(
      [
        [99, 100],
        [98, 80],
      ],
      ["region_id", "value"],
      "region_id",
    );
    expect(stats.matched).toBe(0);
    expect(stats.unmatched.length).toBeGreaterThan(0);
  });

  it("counts rows matched via areaMapping", () => {
    const lookup = buildAreaMappingLookup([{ id: "1", from: "EAST_01", to: "江苏省" }]);
    const stats = analyzeGeoMapMatch(
      [["EAST_01", 100]],
      ["province", "value"],
      "province",
      undefined,
      0,
      lookup,
    );
    expect(stats.matched).toBe(1);
  });
});

describe("resolveRegionMetricValue with areaMapping", () => {
  it("maps business codes to province names", () => {
    const lookup = buildAreaMappingLookup([{ id: "1", from: "EAST_01", to: "江苏省" }]);
    const resolved = resolveRegionMetricValue(
      "province",
      "EAST_01",
      listVsRegionNames(),
      0,
      lookup,
    );
    expect(resolved.name).toBe("江苏省");
    expect(resolved.matched).toBe(true);
  });
});

describe("resolveEmbeddedGeoRoam", () => {
  it("keeps roam enabled by default for embedded dashboard", () => {
    expect(resolveEmbeddedGeoRoam(true)).toBe(true);
    expect(resolveEmbeddedGeoRoam(undefined)).toBe(true);
    expect(resolveEmbeddedGeoRoam(false)).toBe(false);
  });
});

describe("resolveDemoMysqlRegionId", () => {
  it("maps demo sales.region_id to province names", () => {
    expect(resolveDemoMysqlRegionId(7)?.name).toBe("北京市");
    expect(resolveDemoMysqlRegionId(8)?.matched).toBe(true);
    expect(resolveDemoMysqlRegionId(99)).toBeNull();
  });
});

describe("buildGeoMapPlaceholderEchartsOption", () => {
  it("renders china silhouette without visualMap", () => {
    const option = buildGeoMapPlaceholderEchartsOption();
    expect(option[VS_GEO_MAP_PLACEHOLDER_FLAG]).toBe(true);
    expect(option.visualMap).toBeUndefined();
    const series = option.series as Array<Record<string, unknown>>;
    expect(series[0].type).toBe("map");
    expect(series[0].roam).toBe(true);
    expect(series[0].scaleLimit).toEqual({ min: 0.4, max: 4 });
    expect(series[0].data).toEqual([]);
  });
});

describe("buildGeoMapEchartsOption", () => {
  it("builds choropleth map with visualMap and roam", () => {
    const option = buildGeoMapEchartsOption({
      rows: [
        ["北京市", 120],
        ["上海", 80],
        ["广东", 200],
      ],
      columns: ["region", "value"],
      regionField: "region",
      metricField: "value",
    });
    const series = option.series as Array<Record<string, unknown>>;
    expect(series[0].type).toBe("map");
    expect(series[0].roam).toBe(true);
    expect(series[0].scaleLimit).toEqual({ min: 0.4, max: 4 });
    expect(series[0].layoutSize).toBe("92%");
    expect(option.visualMap).toBeTruthy();
    const data = series[0].data as Array<{ name: string; value: number }>;
    expect(data[0].name).toBe("北京市");
    expect(data[2].name).toBe("广东省");
  });

  it("aggregates duplicate regions", () => {
    const option = buildGeoMapEchartsOption({
      rows: [
        ["北京", 10],
        ["北京市", 20],
        ["上海", 5],
      ],
      columns: ["region", "value"],
      regionField: "region",
      metricField: "value",
    });
    const data = (option.series as Array<{ data: Array<{ name: string; value: number }> }>)[0].data;
    const beijing = data.find((item) => item.name === "北京市");
    expect(beijing?.value).toBe(30);
  });

  it("maps demo region_id values to provinces", () => {
    const option = buildGeoMapEchartsOption({
      rows: [
        [5, 100],
        [7, 200],
      ],
      columns: ["region_id", "amount"],
      regionField: "region_id",
      metricField: "amount",
    });
    const data = (option.series as Array<{ data: Array<{ name: string; value: number }> }>)[0].data;
    expect(data.map((item) => item.name).sort()).toEqual(["北京市", "广东省"]);
  });
});

describe("isNumericRegionIdDimension", () => {
  it("detects numeric region_id samples", () => {
    expect(isNumericRegionIdDimension("region_id", ["region_id", "v"], [[5, 1]])).toBe(true);
    expect(isNumericRegionIdDimension("region", ["region", "v"], [["北京", 1]])).toBe(false);
  });
});

describe("analyzeGeoMapMatch with demo region_id", () => {
  it("counts matched rows when demo ids map to provinces", () => {
    const stats = analyzeGeoMapMatch(
      [
        [5, 100],
        [7, 80],
      ],
      ["region_id", "value"],
      "region_id",
    );
    expect(stats.matched).toBe(2);
  });

  it("rolls up district region_id to province at national level", () => {
    const stats = analyzeGeoMapMatch(
      [
        [811, 100],
        [1611, 80],
        [521, 50],
      ],
      ["region_id", "value"],
      "region_id",
      undefined,
      0,
    );
    expect(stats.matched).toBe(3);
    expect(stats.total).toBe(3);
  });

  it("skips unmapped numeric region_id values", () => {
    const stats = analyzeGeoMapMatch(
      [
        [99, 100],
        [7, 80],
      ],
      ["region_id", "value"],
      "region_id",
    );
    expect(stats.matched).toBe(1);
    expect(stats.unmatched).toContain("99");
  });
});

describe("buildGeoHeatmapPlaceholderEchartsOption", () => {
  it("renders empty category heatmap grid", () => {
    const option = buildGeoHeatmapPlaceholderEchartsOption();
    expect(option[VS_GEO_HEATMAP_PLACEHOLDER_FLAG]).toBe(true);
    expect(isGeoHeatmapPlaceholderOption(option)).toBe(true);
    const series = option.series as Array<Record<string, unknown>>;
    expect(series[0].type).toBe("heatmap");
    expect(series[0].data).toEqual([]);
  });
});

describe("buildGeoHeatmapEchartsOption", () => {
  it("uses category indices for heatmap cells", () => {
    const option = buildGeoHeatmapEchartsOption({
      rows: [
        ["A", "Y1", 10],
        ["B", "Y1", 20],
        ["A", "Y2", 5],
      ],
      columns: ["x", "y", "v"],
      xField: "x",
      yField: "y",
      metricField: "v",
    });
    const series = option.series as Array<{ data: Array<[number, number, number]> }>;
    expect(series[0].data[0]).toEqual([0, 0, 10]);
    expect(series[0].data[1]).toEqual([1, 0, 20]);
  });

  it("aggregates duplicate heatmap cells", () => {
    const option = buildGeoHeatmapEchartsOption({
      rows: [
        ["A", "Y1", 10],
        ["A", "Y1", 15],
      ],
      columns: ["x", "y", "v"],
      xField: "x",
      yField: "y",
      metricField: "v",
    });
    const series = option.series as Array<{ data: Array<[number, number, number]> }>;
    expect(series[0].data).toEqual([[0, 0, 25]]);
  });

  it("returns placeholder when rows are empty", () => {
    const option = buildGeoHeatmapEchartsOption({
      rows: [],
      columns: ["x", "y", "v"],
      xField: "x",
      yField: "y",
      metricField: "v",
    });
    expect(isGeoHeatmapPlaceholderOption(option)).toBe(true);
  });
});
