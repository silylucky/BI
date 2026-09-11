import {
  listVsRegionNames,
  resolveRegionMetricValue,
} from "@/components/charts/engine/geo/geoMapChart";
import type { ChartGeoAreaMappingEntry } from "@/lib/chartDeStyle";
import { buildAreaMappingLookup } from "@/lib/chartGeoAreaMapping";

/** 数据维度中去重后的、当前无法 join 离线地图的原始取值 */
export function listUnmatchedGeoRegionValues(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  areaMapping?: ReadonlyMap<string, string>,
  drillDepth = 0,
): string[] {
  const ri = columns.indexOf(regionField);
  if (ri < 0 || !rows.length) return [];

  const knownNames = listVsRegionNames();
  const seen = new Set<string>();
  const unmatched = new Set<string>();

  for (const row of rows) {
    const raw = String(row[ri] ?? "").trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    const resolved = resolveRegionMetricValue(
      regionField,
      row[ri],
      knownNames,
      drillDepth,
      areaMapping,
    );
    if (!resolved.matched) unmatched.add(raw);
  }

  return [...unmatched].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

/** 为尚未配置的未匹配取值生成空映射行（保留已有 from） */
export function buildAreaMappingImportRows(
  existing: ChartGeoAreaMappingEntry[],
  unmatchedValues: string[],
  newId: () => string,
): ChartGeoAreaMappingEntry[] {
  const existingFrom = new Set(
    existing.map((entry) => String(entry.from ?? "").trim()).filter(Boolean),
  );
  const toAdd = unmatchedValues
    .filter((value) => !existingFrom.has(value))
    .map((from) => ({ id: newId(), from, to: "" }));
  return [...existing, ...toAdd];
}

export function countImportableUnmatchedValues(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  existing: ChartGeoAreaMappingEntry[],
  drillDepth = 0,
): number {
  const lookup = buildAreaMappingLookup(existing);
  const unmatched = listUnmatchedGeoRegionValues(
    rows,
    columns,
    regionField,
    lookup,
    drillDepth,
  );
  const existingFrom = new Set(
    existing.map((entry) => String(entry.from ?? "").trim()).filter(Boolean),
  );
  return unmatched.filter((value) => !existingFrom.has(value)).length;
}
