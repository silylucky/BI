import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import { getOfflineGeoMap } from "@/components/charts/engine/geo/OfflineGeoPort";
import { resolveMapRegionNameAtLevel } from "@/components/charts/engine/geo/geoMapChart";
import { applyAreaMapping } from "@/lib/chartGeoAreaMapping";
import {
  ensureOfflineGeoMap,
  listBundledCityProvinceAdcodes,
} from "@/components/charts/engine/geo/geoMapLevels";
import {
  listDemoMysqlRegionAncestorNames,
} from "@/lib/demoMysqlRegions";

export type RegionAnchorLngLat = [number, number];

type GeoFeatureProps = {
  name?: string;
  centroid?: number[];
  center?: number[];
};

type RegionsGeo = {
  features?: Array<{ properties?: GeoFeatureProps }>;
};

const REGION_SUFFIX_RE =
  /(?:特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市|区|县)$/u;
const REGION_ID_FIELD_PATTERN = /(?:^|_)(region_id|adcode|area_code|geo_id)(?:$|_)|^id$|_id$/i;

let nationalAnchorMap: Map<string, RegionAnchorLngLat> | null = null;
let nationalAnchorFullNames: string[] | null = null;
let nationalAnchorPromise: Promise<Map<string, RegionAnchorLngLat>> | null = null;

function readFeatureLngLat(properties?: GeoFeatureProps): RegionAnchorLngLat | null {
  const raw = properties?.centroid ?? properties?.center;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lng = Number(raw[0]);
  const lat = Number(raw[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function registerAnchor(
  map: Map<string, RegionAnchorLngLat>,
  fullNames: string[],
  name: string,
  lngLat: RegionAnchorLngLat,
): void {
  const fullName = name.trim();
  if (!fullName) return;
  map.set(fullName, lngLat);
  fullNames.push(fullName);
  const shortName = fullName.replace(REGION_SUFFIX_RE, "");
  if (shortName && shortName !== fullName && !map.has(shortName)) {
    map.set(shortName, lngLat);
  }
}

function ingestGeoFeatures(
  map: Map<string, RegionAnchorLngLat>,
  fullNames: string[],
  geo: RegionsGeo | null | undefined,
): void {
  for (const feature of geo?.features ?? []) {
    const name = feature.properties?.name?.trim();
    const lngLat = readFeatureLngLat(feature.properties);
    if (!name || !lngLat) continue;
    registerAnchor(map, fullNames, name, lngLat);
  }
}

async function buildNationalRegionAnchorMap(): Promise<Map<string, RegionAnchorLngLat>> {
  const map = new Map<string, RegionAnchorLngLat>();
  const fullNames: string[] = [];
  ingestGeoFeatures(map, fullNames, chinaProvincesGeo as RegionsGeo);

  const provinceAdcodes = listBundledCityProvinceAdcodes();
  await Promise.all(
    provinceAdcodes.map(async (adcode) => {
      const mapId = `vs-geo-${adcode}`;
      await ensureOfflineGeoMap(mapId);
      ingestGeoFeatures(map, fullNames, getOfflineGeoMap(mapId) as RegionsGeo | undefined);
    }),
  );

  nationalAnchorFullNames = fullNames;
  return map;
}

/** 全国省/市标注点索引（热力贴图按数据行最细粒度落点，上层地图可显示下级市州） */
export async function ensureNationalRegionAnchorMap(): Promise<Map<string, RegionAnchorLngLat>> {
  if (nationalAnchorMap) return nationalAnchorMap;
  if (!nationalAnchorPromise) {
    nationalAnchorPromise = buildNationalRegionAnchorMap().then((built) => {
      nationalAnchorMap = built;
      return built;
    });
  }
  return nationalAnchorPromise;
}

export function resetNationalRegionAnchorMapForTests(): void {
  nationalAnchorMap = null;
  nationalAnchorFullNames = null;
  nationalAnchorPromise = null;
}

function listAnchorFullNames(anchors: Map<string, RegionAnchorLngLat>): string[] {
  if (nationalAnchorFullNames && anchors === nationalAnchorMap) {
    return nationalAnchorFullNames;
  }
  return [...anchors.keys()].filter((name) => REGION_SUFFIX_RE.test(name));
}

/** 精确匹配地区名（全名/简称/别名表），禁止前缀模糊扫描 */
export function lookupAnchorName(
  raw: string,
  anchors: Map<string, RegionAnchorLngLat>,
): RegionAnchorLngLat | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const direct = anchors.get(trimmed);
  if (direct) return direct;

  const stripped = trimmed.replace(REGION_SUFFIX_RE, "");
  const fromShort = anchors.get(stripped);
  if (fromShort) return fromShort;

  const resolved = resolveMapRegionNameAtLevel(trimmed, listAnchorFullNames(anchors));
  if (resolved.matched) {
    return anchors.get(resolved.name) ?? null;
  }
  return null;
}

export function resolveRowRegionAnchorLngLat(
  regionField: string,
  raw: unknown,
  anchors: Map<string, RegionAnchorLngLat>,
  areaMapping?: ReadonlyMap<string, string>,
): RegionAnchorLngLat | null {
  const mappedRaw = applyAreaMapping(raw, areaMapping);
  const candidates: string[] = [];
  if (REGION_ID_FIELD_PATTERN.test(regionField)) {
    candidates.push(...listDemoMysqlRegionAncestorNames(mappedRaw));
  } else {
    const trimmed = String(mappedRaw ?? "").trim();
    if (trimmed) candidates.push(trimmed);
  }

  for (const candidate of candidates) {
    const hit = lookupAnchorName(candidate, anchors);
    if (hit) return hit;
  }
  return null;
}
