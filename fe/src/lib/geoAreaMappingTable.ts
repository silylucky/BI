import {
  listVsRegionNames,
  resolveRegionMetricValue,
} from "@/components/charts/engine/geo/geoMapChart";
import type { ChartGeoAreaMappingEntry } from "@/lib/chartDeStyle";
import { normalizeAreaMappingEntries } from "@/lib/chartGeoAreaMapping";

export type GeoAreaMappingViewRow = {
  id: string;
  /** 离线地图标准区域名（图形列） */
  mapRegion: string;
  /** 业务维度取值（属性列） */
  dataValue: string;
};

export function listDistinctRegionFieldValues(
  rows: unknown[][],
  columns: string[],
  regionField: string,
): string[] {
  const ri = columns.indexOf(regionField);
  if (ri < 0) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of rows) {
    const raw = String(row[ri] ?? "").trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    values.push(raw);
  }
  return values.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

/** 为地图区域名反查最匹配的业务维度取值 */
export function suggestDataValueForMapRegion(
  mapRegion: string,
  distinctValues: string[],
  regionField: string,
  lookup?: ReadonlyMap<string, string>,
): string {
  const knownNames = listVsRegionNames();
  for (const raw of distinctValues) {
    const resolved = resolveRegionMetricValue(
      regionField,
      raw,
      knownNames,
      0,
      lookup,
    );
    if (resolved.matched && resolved.name === mapRegion) {
      return String(raw ?? "").trim();
    }
  }
  for (const raw of distinctValues) {
    const trimmed = String(raw ?? "").trim();
    if (trimmed === mapRegion) return trimmed;
  }
  return "";
}

function entryIdForRegion(
  mapRegion: string,
  entries: ChartGeoAreaMappingEntry[],
): string {
  const hit = entries.find((entry) => entry.to === mapRegion);
  return hit?.id ?? `region-${mapRegion}`;
}

/** 构建「图形 | 属性」视图行（含自动建议，不落盘空行） */
export function buildGeoAreaMappingViewRows(
  mapRegions: string[],
  distinctValues: string[],
  entries: ChartGeoAreaMappingEntry[],
  regionField: string,
  lookup?: ReadonlyMap<string, string>,
): GeoAreaMappingViewRow[] {
  const normalized = normalizeAreaMappingEntries(entries);
  const byTo = new Map(normalized.map((entry) => [entry.to, entry]));

  return mapRegions.map((mapRegion) => {
    const existing = byTo.get(mapRegion);
    const dataValue =
      existing?.from ??
      suggestDataValueForMapRegion(mapRegion, distinctValues, regionField, lookup);
    return {
      id: entryIdForRegion(mapRegion, entries),
      mapRegion,
      dataValue,
    };
  });
}

/** 将属性列编辑合并回 areaMapping（仅保留非空 from/to） */
export function mergeAreaMappingAttribute(
  entries: ChartGeoAreaMappingEntry[],
  mapRegion: string,
  dataValue: string,
  newId: () => string,
): ChartGeoAreaMappingEntry[] {
  const trimmedFrom = dataValue.trim();
  const withoutRegion = entries.filter((entry) => entry.to !== mapRegion);
  if (!trimmedFrom) {
    return withoutRegion;
  }
  const existing = entries.find((entry) => entry.to === mapRegion);
  return [
    ...withoutRegion.filter((entry) => entry.from !== trimmedFrom),
    {
      id: existing?.id ?? newId(),
      from: trimmedFrom,
      to: mapRegion,
    },
  ];
}

/** 数据就绪且尚无映射时，按区域自动建议并生成可持久化条目 */
export function autoSuggestAreaMappingEntries(
  mapRegions: string[],
  distinctValues: string[],
  regionField: string,
  existing: ChartGeoAreaMappingEntry[],
  newId: () => string,
): ChartGeoAreaMappingEntry[] {
  if (normalizeAreaMappingEntries(existing).length > 0) return existing;

  const lookup = new Map<string, string>();
  const suggested: ChartGeoAreaMappingEntry[] = [];

  for (const mapRegion of mapRegions) {
    const from = suggestDataValueForMapRegion(
      mapRegion,
      distinctValues,
      regionField,
      lookup,
    );
    if (!from) continue;
    lookup.set(from, mapRegion);
    suggested.push({ id: newId(), from, to: mapRegion });
  }

  return suggested;
}

export const GEO_AREA_MAPPING_PAGE_SIZE = 10;

export function paginateMapRegions(
  regions: string[],
  page: number,
  pageSize = GEO_AREA_MAPPING_PAGE_SIZE,
): { pageRegions: string[]; totalPages: number; safePage: number } {
  const totalPages = Math.max(1, Math.ceil(regions.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageRegions: regions.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}
