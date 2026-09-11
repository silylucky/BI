import type { ChartDeStyle, ChartGeoAreaMappingEntry } from "@/lib/chartDeStyle";
import { readChartGeoStyle } from "@/lib/chartDeStyle";

export type { ChartGeoAreaMappingEntry } from "@/lib/chartDeStyle";

/** 过滤空行并规范化 from/to（trim）；保留 id 供 React key 使用 */
export function normalizeAreaMappingEntries(
  entries: ChartGeoAreaMappingEntry[] | undefined,
): ChartGeoAreaMappingEntry[] {
  if (!entries?.length) return [];
  return entries
    .map((entry) => ({
      id: entry.id,
      from: String(entry.from ?? "").trim(),
      to: String(entry.to ?? "").trim(),
    }))
    .filter((entry) => entry.from.length > 0 && entry.to.length > 0);
}

/** 有效映射条数（非空 from/to） */
export function countEffectiveAreaMappings(entries: ChartGeoAreaMappingEntry[] | undefined): number {
  return normalizeAreaMappingEntries(entries).length;
}

/** 重复 from 时后者覆盖前者 */
export function buildAreaMappingLookup(
  entries: ChartGeoAreaMappingEntry[] | undefined,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const entry of normalizeAreaMappingEntries(entries)) {
    map.set(entry.from, entry.to);
  }
  return map;
}

export function readChartGeoAreaMapping(
  deStyle: ChartDeStyle | undefined,
): ChartGeoAreaMappingEntry[] {
  return normalizeAreaMappingEntries(readChartGeoStyle(deStyle ?? {}).areaMapping);
}

export function readChartGeoAreaMappingLookup(
  deStyle: ChartDeStyle | undefined,
): ReadonlyMap<string, string> {
  return buildAreaMappingLookup(readChartGeoAreaMapping(deStyle));
}

/** 用于地图 contentKey，映射变更须触发重绘 */
export function buildAreaMappingContentSig(
  lookup?: ReadonlyMap<string, string> | null,
): string {
  if (!lookup?.size) return "";
  return [...lookup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
    .map(([from, to]) => `${from}=>${to}`)
    .join("|");
}

/** 对用户维度 raw 查表；非 string 或空 lookup 原样返回 */
export function applyAreaMapping(
  raw: unknown,
  lookup?: ReadonlyMap<string, string> | null,
): unknown {
  if (!lookup?.size) return raw;
  const key = String(raw ?? "").trim();
  if (!key) return raw;
  return lookup.get(key) ?? raw;
}
