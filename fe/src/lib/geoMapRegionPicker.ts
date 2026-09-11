import type { ChartDrillFrame } from "@/lib/chartDrill";
import { getDrillChain } from "@/lib/chartDrill";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  readChartDeStyle,
  readChartGeo3dStyle,
  readChartGeoStyle,
  patchChartDeStyleNested,
  type ChartGeo3dStyle,
  type ChartGeoStyle,
} from "@/lib/chartDeStyle";
import {
  isMunicipalityAdcode,
  lookupCityAdcode,
  lookupProvinceAdcode,
  resolveGeoMapLevelContext,
} from "@/components/charts/engine/geo/geoMapLevels";

export type GeoMapRegionSelection = {
  province: string;
  city?: string;
  district?: string;
};

/** `undefined` = 未用手动地区；`[]` = 明确全国 */
export function readManualGeoMapDrillStack(
  config: ChartViewConfig,
): ChartDrillFrame[] | undefined {
  return readChartGeoStyle(readChartDeStyle(config)).manualDrillStack;
}

/** 实例级 manualDrillStack 覆盖到库内/合并后的 chartConfig */
export function applyManualGeoMapDrillOverlay(
  base: ChartViewConfig,
  instance?: ChartViewConfig | null,
): ChartViewConfig {
  return applyLinkedChartInstanceOverlay(base, instance);
}

function readLinkedChartGeoInstancePatches(config: ChartViewConfig): {
  geo?: Partial<ChartGeoStyle>;
  geo3d?: Partial<ChartGeo3dStyle>;
} {
  const deStyle = readChartDeStyle(config);
  const geo = readChartGeoStyle(deStyle);
  const geo3d = readChartGeo3dStyle(deStyle);
  const geoPatch: Partial<ChartGeoStyle> = {};
  if (geo.manualDrillStack !== undefined) {
    geoPatch.manualDrillStack = geo.manualDrillStack;
  }
  if (geo.viewTransforms && Object.keys(geo.viewTransforms).length > 0) {
    geoPatch.viewTransforms = geo.viewTransforms;
  }
  const geo3dPatch: Partial<ChartGeo3dStyle> = {};
  if (geo3d.orbitViews && Object.keys(geo3d.orbitViews).length > 0) {
    geo3dPatch.orbitViews = geo3d.orbitViews;
  }
  return {
    geo: Object.keys(geoPatch).length > 0 ? geoPatch : undefined,
    geo3d: Object.keys(geo3dPatch).length > 0 ? geo3dPatch : undefined,
  };
}

/** 关联组件落库时仅保留地图实例覆盖（下钻路径、缩放视角等） */
export function buildLinkedChartInstanceOverlay(
  config: ChartViewConfig,
): ChartViewConfig | undefined {
  const { geo, geo3d } = readLinkedChartGeoInstancePatches(config);
  if (!geo && !geo3d) return undefined;
  let next = { chartType: config.chartType } as ChartViewConfig;
  if (geo) next = patchChartDeStyleNested(next, "geo", geo);
  if (geo3d) next = patchChartDeStyleNested(next, "geo3d", geo3d);
  return next;
}

/** @deprecated 使用 buildLinkedChartInstanceOverlay */
export function buildGeoMapDrillPersistOverlay(
  config: ChartViewConfig,
): ChartViewConfig | undefined {
  return buildLinkedChartInstanceOverlay(config);
}

/** 实例级地图覆盖合并到库内/合并后的 chartConfig */
export function applyLinkedChartInstanceOverlay(
  base: ChartViewConfig,
  instance?: ChartViewConfig | null,
): ChartViewConfig {
  if (!instance) return base;
  const overlay = buildLinkedChartInstanceOverlay(instance);
  if (!overlay) return base;
  const { geo, geo3d } = readLinkedChartGeoInstancePatches(overlay);
  let next = base;
  if (geo) next = patchChartDeStyleNested(next, "geo", geo);
  if (geo3d) next = patchChartDeStyleNested(next, "geo3d", geo3d);
  return next;
}

export function formatGeoMapRegionSelectionLabel(
  selection: GeoMapRegionSelection | null,
  emptyLabel = "全国",
): string {
  if (!selection?.province) return emptyLabel;
  if (selection.district) return selection.district;
  if (selection.city) return selection.city;
  return selection.province;
}

export function parseGeoMapDrillStackSelection(
  stack: ChartDrillFrame[],
): GeoMapRegionSelection | null {
  if (!stack.length) return null;
  const province = stack[0].label?.trim() || stack[0].value;
  if (stack.length === 1) return { province };

  const provinceAdcode = lookupProvinceAdcode(province);
  const municipality = provinceAdcode ? isMunicipalityAdcode(provinceAdcode) : false;
  const second = stack[1].label?.trim() || stack[1].value;

  if (stack.length >= 2 && municipality) {
    return { province, district: second };
  }

  const third = stack[2]?.label?.trim() || stack[2]?.value;
  return {
    province,
    city: second,
    district: third,
  };
}

export function buildGeoMapDrillStackFromSelection(
  config: ChartViewConfig,
  selection: GeoMapRegionSelection | null,
): ChartDrillFrame[] {
  if (!selection?.province) return [];
  const chain = resolveGeoMapDrillChain(config);
  if (!chain.length) return [];

  const frames: ChartDrillFrame[] = [
    {
      field: chain[0] ?? "province",
      value: selection.province,
      label: selection.province,
    },
  ];

  const provinceAdcode = lookupProvinceAdcode(selection.province);
  const municipality = provinceAdcode ? isMunicipalityAdcode(provinceAdcode) : false;

  if (selection.district && municipality && chain.length >= 3) {
    frames.push({
      field: chain[2] ?? "district",
      value: selection.district,
      label: selection.district,
    });
    return frames;
  }

  if (selection.city && chain.length >= 2) {
    frames.push({
      field: chain[1] ?? "city",
      value: selection.city,
      label: selection.city,
    });
  }

  if (selection.district && !municipality && chain.length >= 3) {
    frames.push({
      field: chain[2] ?? "district",
      value: selection.district,
      label: selection.district,
    });
  }

  return frames;
}

const DEFAULT_GEO_DRILL_CHAIN = ["province", "city", "district"] as const;

/** 无槽位时使用默认省/市/区县字段名，仍允许手动切换地图层级 */
export function resolveGeoMapDrillChain(config: ChartViewConfig): string[] {
  const chain = getDrillChain(config);
  if (chain.length) return chain;
  return [...DEFAULT_GEO_DRILL_CHAIN];
}

export function geoMapRegionMaxDepth(config: ChartViewConfig): number {
  const chain = resolveGeoMapDrillChain(config);
  if (!chain.length) return 0;
  return Math.max(1, Math.min(chain.length - 1, 2));
}

export type ManualGeoMapDrillResult =
  | { ok: true }
  | { ok: false; message: string };

export async function validateManualGeoMapDrillStack(
  config: ChartViewConfig,
  stack: ChartDrillFrame[],
): Promise<ManualGeoMapDrillResult> {
  if (!stack.length) return { ok: true };

  const context = await resolveGeoMapLevelContext({ config, drillStack: stack });

  if (context.drillDepth === 0) {
    return {
      ok: false,
      message: context.missingAsset ?? "无法下钻到该层级，请检查地理字段与离线边界资产",
    };
  }

  if (context.missingAsset?.includes("未识别城市")) {
    return { ok: false, message: context.missingAsset };
  }

  // 市级可选、区县资产缺失：仍允许手动下钻到市级视图
  if (context.missingAsset?.includes("区县离线边界") && stack.length > context.drillDepth) {
    return { ok: true };
  }

  if (context.missingAsset) {
    return { ok: false, message: context.missingAsset };
  }

  if (context.drillDepth !== stack.length) {
    return { ok: false, message: "无法下钻到该层级，请检查地理字段与离线边界资产" };
  }

  return { ok: true };
}

export async function resolveGeoMapCityAdcode(
  provinceName: string,
  cityName: string,
): Promise<number | null> {
  const provinceAdcode = lookupProvinceAdcode(provinceName);
  if (!provinceAdcode) return null;
  return lookupCityAdcode(cityName, provinceAdcode);
}
