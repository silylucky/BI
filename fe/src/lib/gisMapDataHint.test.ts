import { describe, expect, it } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { resolveGisMapDataHint, shouldShowGisMapOverlayHint } from "@/lib/gisMapDataHint";
import type { ChartViewConfig } from "@/lib/chartViewConfig";

function gisConfigWithTile(patch: Partial<ChartViewConfig> = {}): ChartViewConfig {
  return {
    ...defaultChartConfig("gis-map"),
    nativeBody: {
      gisProject: {
        tileServiceId: "planet-z15",
      },
    },
    ...patch,
  };
}

describe("resolveGisMapDataHint", () => {
  it("warns when tile service is not connected", () => {
    const hint = resolveGisMapDataHint(defaultChartConfig("gis-map"), []);
    expect(hint.tone).toBe("warn");
    expect(hint.message).toContain("连接全球 PMTiles");
    expect(hint.overlayMessage).toContain("尚未连接");
  });

  it("warns when province is bound as longitude", () => {
    const config = gisConfigWithTile({
      dimensions: [{ field: "province" }],
      metrics: [{ field: "amount" }],
    });
    const hint = resolveGisMapDataHint(config, ["province", "city", "amount"]);
    expect(hint.tone).toBe("warn");
    expect(hint.message).toContain("province");
    expect(hint.message).toContain("区域地图");
  });

  it("warns when dataset only has geo names and nothing is bound", () => {
    const hint = resolveGisMapDataHint(gisConfigWithTile(), ["province", "city", "amount"]);
    expect(hint.tone).toBe("warn");
    expect(hint.message).toContain("区域地图");
  });

  it("includes sample sql when unbound but tile service is connected", () => {
    const hint = resolveGisMapDataHint(gisConfigWithTile(), []);
    expect(hint.sampleSql).toContain("de_map_heat");
  });

  it("warns when only longitude is bound", () => {
    const config = gisConfigWithTile({
      dimensions: [{ field: "longitude" }],
    });
    const hint = resolveGisMapDataHint(config, ["longitude", "latitude", "amount"]);
    expect(hint.tone).toBe("warn");
    expect(hint.message).toContain("纬度");
  });

  it("ok when lng/lat are configured", () => {
    const config = gisConfigWithTile({
      dimensions: [{ field: "longitude" }, { field: "latitude" }],
      metrics: [{ field: "amount" }],
    });
    const hint = resolveGisMapDataHint(config, ["longitude", "latitude", "amount"]);
    expect(hint.tone).toBe("ok");
  });
});

describe("shouldShowGisMapOverlayHint", () => {
  it("shows overlay hint for warn tone without geojson", () => {
    const hint = resolveGisMapDataHint(
      gisConfigWithTile({ dimensions: [{ field: "province" }] }),
      ["province", "amount"],
    );
    expect(shouldShowGisMapOverlayHint(hint, false)).toBe(true);
    expect(shouldShowGisMapOverlayHint(hint, true)).toBe(false);
  });
});
