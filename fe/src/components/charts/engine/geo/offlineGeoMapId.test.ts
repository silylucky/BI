import { describe, expect, it } from "vitest";
import {
  getOfflineGeoMap,
  resolveOfflineGeoMapId,
  registerOfflineGeoMap,
} from "@/components/charts/engine/geo/OfflineGeoPort";
import {
  ensureOfflineGeoMap,
  loadOfflineGeoMap,
} from "@/components/charts/engine/geo/geoMapLevels";
import { VS_REGIONS_MAP_ID } from "@/components/charts/engine/geo/geoConstants";

describe("offline geo map id resolution", () => {
  it("coerces empty mapId to national", () => {
    expect(resolveOfflineGeoMapId("")).toBe(VS_REGIONS_MAP_ID);
    expect(resolveOfflineGeoMapId("   ")).toBe(VS_REGIONS_MAP_ID);
    expect(resolveOfflineGeoMapId(null)).toBe(VS_REGIONS_MAP_ID);
    expect(resolveOfflineGeoMapId(undefined)).toBe(VS_REGIONS_MAP_ID);
  });

  it("always has national features", async () => {
    expect(await ensureOfflineGeoMap(VS_REGIONS_MAP_ID)).toBe(true);
    expect(await ensureOfflineGeoMap("")).toBe(true);
    const geo = getOfflineGeoMap("");
    expect(geo?.features?.length).toBeGreaterThan(30);
  });

  it("does not pretend unknown ids are national", async () => {
    expect(await ensureOfflineGeoMap("not-a-map")).toBe(false);
  });

  it("loads hunan city map and can return to national", async () => {
    expect(await ensureOfflineGeoMap("vs-geo-430000")).toBe(true);
    const hunan = getOfflineGeoMap("vs-geo-430000");
    expect(hunan?.features?.length).toBeGreaterThan(0);
    // 下钻资产不得被当成全国省级
    const nationalNames = new Set(
      (getOfflineGeoMap(VS_REGIONS_MAP_ID)?.features ?? [])
        .map((f) => f.properties?.name)
        .filter(Boolean),
    );
    const hunanNames = (hunan?.features ?? []).map((f) => f.properties?.name).filter(Boolean);
    expect(hunanNames.some((n) => n && !nationalNames.has(n))).toBe(true);
    expect(await ensureOfflineGeoMap(VS_REGIONS_MAP_ID)).toBe(true);
  });

  it("loads qinghai city map (vs-geo-630000)", async () => {
    const geo = await loadOfflineGeoMap("vs-geo-630000");
    expect(geo?.features?.length).toBeGreaterThan(0);
    expect(geo?.features?.some((f) => f.properties?.name === "西宁市")).toBe(true);
  });

  it("recovers qinghai after empty registry overwrite", async () => {
    expect(await ensureOfflineGeoMap("vs-geo-630000")).toBe(true);
    registerOfflineGeoMap("vs-geo-630000", { features: [] });
    expect(getOfflineGeoMap("vs-geo-630000")?.features?.length ?? 0).toBe(0);
    const geo = await loadOfflineGeoMap("vs-geo-630000");
    expect(geo?.features?.length).toBeGreaterThan(0);
  });

  it("recovers changsha district map after empty registry overwrite", async () => {
    const mapId = "vs-geo-430100";
    expect(await ensureOfflineGeoMap(mapId)).toBe(true);
    registerOfflineGeoMap(mapId, { features: [] });
    expect(getOfflineGeoMap(mapId)?.features?.length ?? 0).toBe(0);
    const geo = await loadOfflineGeoMap(mapId);
    expect(geo?.features?.length).toBeGreaterThan(0);
  });
});
