import chinaProvincesGeo from "@/assets/geo/china-provinces.json";
import { chartPalette } from "@/lib/chartPalette";
import type { NumberFormatConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  isDemoMysqlRegionId,
  resolveDemoMysqlRegionByDrillDepth,
} from "@/lib/demoMysqlRegions";
import { formatChartValue } from "@/lib/chartValueFormat";
import { applyAreaMapping } from "@/lib/chartGeoAreaMapping";
import {
  DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT,
  DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  GEO_MAP_SCALE_LIMIT,
  MAP_REGION_NAME_HINT,
  resolveEmbeddedGeoRoam,
  VS_GEO_HEATMAP_PLACEHOLDER_FLAG,
  VS_GEO_MAP_PLACEHOLDER_FLAG,
  VS_REGIONS_MAP_ID,
} from "@/components/charts/engine/geo/geoConstants";

/** GEO-IRON-01：仅离线中国省级 GeoJSON；禁止在线瓦片/境外底图。见 `.cursor/rules/geo-map-offline-china.mdc` */

export {
  DEFAULT_GEO_HEATMAP_PLACEHOLDER_HINT,
  DEFAULT_GEO_MAP_PLACEHOLDER_HINT,
  GEO_MAP_SCALE_LIMIT,
  MAP_REGION_NAME_HINT,
  resolveEmbeddedGeoRoam,
  VS_GEO_HEATMAP_PLACEHOLDER_FLAG,
  VS_GEO_MAP_PLACEHOLDER_FLAG,
  VS_REGIONS_MAP_ID,
} from "@/components/charts/engine/geo/geoConstants";

export function isNumericRegionIdDimension(
  regionField: string,
  columns: string[],
  rows: unknown[][],
): boolean {
  if (!/region[_-]?id$/i.test(regionField)) return false;
  const colIdx = columns.indexOf(regionField);
  if (colIdx < 0 || rows.length === 0) return false;
  const sample = rows[0]?.[colIdx];
  if (typeof sample === "number") return true;
  if (typeof sample === "string") {
    const trimmed = sample.trim();
    return trimmed !== "" && !Number.isNaN(Number(trimmed));
  }
  return false;
}

export type GeoChartStyle = {
  /** 地图缩放/平移（对标 DE 地图交互） */
  roam?: boolean;
  /** 区域名称标签 */
  showRegionLabel?: boolean;
  /** 数值映射色带（地图/热力） */
  visualMap?: boolean;
  /** 热力图单元格数值标签 */
  showCellLabel?: boolean;
};

export const DEFAULT_GEO_CHART_STYLE: Required<GeoChartStyle> = {
  roam: true,
  showRegionLabel: false,
  visualMap: true,
  showCellLabel: false,
};

type GeoFeatureProps = {
  name?: string;
  adcode?: number;
  level?: string;
};
type GeoJsonFeature = { properties?: GeoFeatureProps };
type RegionsGeo = { features?: GeoJsonFeature[] };

/** 演示库 regions.code → 省级全称（docker/demo-mysql） */
const REGION_CODE_ALIASES: Record<string, string> = {
  SH: "上海市",
  BJ: "北京市",
  GD: "广东省",
  JS: "江苏省",
  SC: "四川省",
  ZJ: "浙江省",
  SD: "山东省",
  HN: "河南省",
  HB: "湖北省",
  FJ: "福建省",
};

const REGION_SUFFIX_RE =
  /(?:特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$/u;

let mapRegistered = false;
let provinceFullNames: string[] | null = null;
let adcodeToFullName: Map<number, string> | null = null;
let shortToFullName: Map<string, string> | null = null;

function getProvinceIndex() {
  if (provinceFullNames && adcodeToFullName && shortToFullName) {
    return { provinceFullNames, adcodeToFullName, shortToFullName };
  }

  const geo = chinaProvincesGeo as RegionsGeo;
  const features = (geo.features ?? []).filter(
    (feature) => feature.properties?.level === "province" && feature.properties.name,
  );

  const fullNames: string[] = [];
  const adcodeMap = new Map<number, string>();
  const shortMap = new Map<string, string>();

  for (const feature of features) {
    const fullName = feature.properties!.name!.trim();
    fullNames.push(fullName);
    if (typeof feature.properties?.adcode === "number") {
      adcodeMap.set(feature.properties.adcode, fullName);
    }
    const shortName = fullName.replace(REGION_SUFFIX_RE, "");
    if (shortName && shortName !== fullName) {
      shortMap.set(shortName, fullName);
    }
    shortMap.set(fullName, fullName);
  }

  provinceFullNames = fullNames;
  adcodeToFullName = adcodeMap;
  shortToFullName = shortMap;
  return { provinceFullNames: fullNames, adcodeToFullName: adcodeMap, shortToFullName: shortMap };
}

export function ensureVsRegionsMapRegistered(): void {
  if (mapRegistered) return;
  mapRegistered = true;
}

export function listVsRegionNames(): string[] {
  return [...getProvinceIndex().provinceFullNames];
}

/** @deprecated 使用 resolveMapRegionName */
export function normalizeRegionName(raw: string, knownNames = listVsRegionNames()): string {
  return resolveMapRegionName(raw, knownNames).name;
}

export type GeoMapRegionResolve = {
  name: string;
  matched: boolean;
};

/** 演示库 regions.id → code（docker/demo-mysql；生产请 JOIN regions 取 name） */
export const DEMO_MYSQL_REGION_ID_TO_CODE: Record<number, string> = {
  5: "GD",
  6: "JS",
  7: "BJ",
  8: "SH",
  9: "SC",
  10: "ZJ",
};

export function isDemoMysqlRegionIdValue(raw: unknown): boolean {
  return isDemoMysqlRegionId(raw);
}

function isNumericRegionIdRaw(raw: unknown): boolean {
  if (typeof raw === "number") return Number.isFinite(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed !== "" && !Number.isNaN(Number(trimmed));
  }
  return false;
}

export function resolveDemoMysqlRegionId(raw: unknown, drillDepth = 0): GeoMapRegionResolve | null {
  const fromHierarchy = resolveDemoMysqlRegionByDrillDepth(raw, drillDepth);
  if (fromHierarchy) return fromHierarchy;
  const id =
    typeof raw === "number"
      ? raw
      : Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(id)) return null;
  const code = DEMO_MYSQL_REGION_ID_TO_CODE[Math.round(id)];
  if (!code) return null;
  return resolveMapRegionName(code);
}

const REGION_ID_FIELD_PATTERN = /(?:^|_)(region_id|adcode|area_code|geo_id)(?:$|_)|^id$|_id$/i;

/** 地图维度取值：地名 / adcode / 演示库 region_id */
export function resolveMapDimensionValue(
  regionField: string,
  raw: unknown,
  knownNames = listVsRegionNames(),
  drillDepth = 0,
): GeoMapRegionResolve {
  if (REGION_ID_FIELD_PATTERN.test(regionField)) {
    const demo = resolveDemoMysqlRegionId(raw, drillDepth);
    if (demo) return demo;
    if (isNumericRegionIdRaw(raw)) {
      return { name: "", matched: false };
    }
  }
  return resolveMapRegionName(raw, knownNames);
}

function resolveAdcodeName(raw: string, adcodeMap: Map<number, string>): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const code = Number(digits);
  if (!Number.isFinite(code)) return null;

  if (adcodeMap.has(code)) return adcodeMap.get(code)!;

  const provinceCode = Math.floor(code / 10000) * 10000;
  if (provinceCode >= 110000 && adcodeMap.has(provinceCode)) {
    return adcodeMap.get(provinceCode)!;
  }

  if (code > 0 && code < 100) {
    const padded = code * 10000;
    if (adcodeMap.has(padded)) return adcodeMap.get(padded)!;
  }

  return null;
}

/** 将业务维度值解析为底图省级 properties.name */
export function resolveMapRegionName(
  raw: unknown,
  knownNames = listVsRegionNames(),
  areaMapping?: ReadonlyMap<string, string>,
): GeoMapRegionResolve {
  const mappedRaw = applyAreaMapping(raw, areaMapping);
  const { adcodeToFullName: adcodeMap, shortToFullName: shortMap } = getProvinceIndex();
  const trimmed = String(mappedRaw ?? "").trim();
  if (!trimmed) return { name: "", matched: false };

  if (knownNames.includes(trimmed)) return { name: trimmed, matched: true };

  const alias = REGION_CODE_ALIASES[trimmed.toUpperCase()];
  if (alias && knownNames.includes(alias)) return { name: alias, matched: true };

  const fromAdcode = resolveAdcodeName(trimmed, adcodeMap);
  if (fromAdcode) return { name: fromAdcode, matched: true };

  if (shortMap.has(trimmed)) {
    const full = shortMap.get(trimmed)!;
    return { name: full, matched: knownNames.includes(full) };
  }

  const stripped = trimmed.replace(REGION_SUFFIX_RE, "");
  if (shortMap.has(stripped)) {
    const full = shortMap.get(stripped)!;
    return { name: full, matched: knownNames.includes(full) };
  }

  const byPrefix = knownNames.find(
    (name) => trimmed.startsWith(name) || stripped.startsWith(name.replace(REGION_SUFFIX_RE, "")),
  );
  if (byPrefix) return { name: byPrefix, matched: true };

  return { name: stripped || trimmed, matched: false };
}

/** 在指定底图名称列表内解析区域名（市/区县层级） */
export function resolveMapRegionNameAtLevel(
  raw: unknown,
  knownNames: string[],
  areaMapping?: ReadonlyMap<string, string>,
): GeoMapRegionResolve {
  const mappedRaw = applyAreaMapping(raw, areaMapping);
  const trimmed = String(mappedRaw ?? "").trim();
  if (!trimmed) return { name: "", matched: false };
  if (knownNames.includes(trimmed)) return { name: trimmed, matched: true };

  const suffixRe = /(?:特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市|区|县)$/u;
  const stripped = trimmed.replace(suffixRe, "");
  for (const name of knownNames) {
    const short = name.replace(suffixRe, "");
    if (name === trimmed || short === trimmed || short === stripped || name.startsWith(trimmed)) {
      return { name, matched: true };
    }
  }
  return { name: stripped || trimmed, matched: false };
}

export type GeoMapMatchStats = {
  total: number;
  matched: number;
  unmatched: string[];
};

export function analyzeGeoMapMatch(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  knownNames = listVsRegionNames(),
  drillDepthOrRootLevel: number | boolean = 0,
  areaMapping?: ReadonlyMap<string, string>,
): GeoMapMatchStats {
  const drillDepth =
    typeof drillDepthOrRootLevel === "boolean"
      ? drillDepthOrRootLevel
        ? 0
        : 1
      : drillDepthOrRootLevel;
  const ri = columns.indexOf(regionField);
  const unmatched = new Set<string>();
  let matched = 0;

  for (const row of rows) {
    const resolved = resolveRegionMetricValue(
      regionField,
      row[ri],
      knownNames,
      drillDepth,
      areaMapping,
    );
    if (resolved.matched) matched += 1;
    else if (resolved.name) unmatched.add(String(row[ri] ?? ""));
    else if (REGION_ID_FIELD_PATTERN.test(regionField) && isNumericRegionIdRaw(row[ri])) {
      unmatched.add(String(row[ri] ?? ""));
    }
  }

  return {
    total: rows.length,
    matched,
    unmatched: [...unmatched].slice(0, 5),
  };
}

export type GeoMapPlaceholderInput = {
  geo?: GeoChartStyle;
  isDark?: boolean;
  /** 是否允许缩放平移（未配置占位默认关闭） */
  roam?: boolean;
};

/** 对标 DataEase：无数据/未绑字段时仍展示中国省级轮廓底图 */
export function buildGeoMapPlaceholderEchartsOption(
  input: GeoMapPlaceholderInput = {},
): Record<string, unknown> {
  ensureVsRegionsMapRegistered();
  const isDark = input.isDark ?? false;
  const roam = resolveEmbeddedGeoRoam(input.roam ?? input.geo?.roam);
  const baseFill = isDark ? "#334155" : "#e8edf3";
  const emphasisFill = isDark ? "#475569" : "#d4dce6";
  const borderColor = isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.55)";

  return {
    [VS_GEO_MAP_PLACEHOLDER_FLAG]: true,
    tooltip: {
      trigger: "item",
      formatter: (params: { name?: string }) => params.name ?? "",
    },
    series: [
      {
        type: "map",
        map: VS_REGIONS_MAP_ID,
        roam,
        ...(roam ? { scaleLimit: GEO_MAP_SCALE_LIMIT } : {}),
        layoutCenter: ["50%", "52%"],
        layoutSize: "92%",
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: emphasisFill },
        },
        itemStyle: {
          areaColor: baseFill,
          borderColor,
          borderWidth: 0.8,
        },
        data: [],
      },
    ],
  };
}

export function isGeoMapPlaceholderOption(option: Record<string, unknown> | null | undefined): boolean {
  return Boolean(option?.[VS_GEO_MAP_PLACEHOLDER_FLAG]);
}

export function isGeoHeatmapPlaceholderOption(
  option: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(option?.[VS_GEO_HEATMAP_PLACEHOLDER_FLAG]);
}

export function resolveRegionMetricValue(
  regionField: string,
  raw: unknown,
  knownNames: string[],
  drillDepth: number,
  areaMapping?: ReadonlyMap<string, string>,
): GeoMapRegionResolve {
  const mappedRaw = applyAreaMapping(raw, areaMapping);
  if (REGION_ID_FIELD_PATTERN.test(regionField)) {
    const demo = resolveDemoMysqlRegionId(mappedRaw, drillDepth);
    if (demo) {
      if (drillDepth === 0) return demo;
      const atLevel = resolveMapRegionNameAtLevel(demo.name, knownNames);
      return atLevel.matched ? atLevel : demo;
    }
    if (isNumericRegionIdRaw(mappedRaw)) {
      return { name: "", matched: false };
    }
  }
  if (drillDepth === 0) {
    return resolveMapDimensionValue(regionField, mappedRaw, knownNames, drillDepth);
  }
  return resolveMapRegionNameAtLevel(mappedRaw, knownNames);
}

function aggregateMapRegionData(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  metricField: string,
  knownNames = listVsRegionNames(),
  drillDepth = 0,
  areaMapping?: ReadonlyMap<string, string>,
): Array<{ name: string; value: number }> {
  const ri = columns.indexOf(regionField);
  const mi = columns.indexOf(metricField);
  const bucket = new Map<string, number>();

  for (const row of rows) {
    const resolved = resolveRegionMetricValue(
      regionField,
      row[ri],
      knownNames,
      drillDepth,
      areaMapping,
    );
    if (!resolved.name) continue;
    if (drillDepth > 0 && !resolved.matched) continue;
    const raw = Number(row[mi] ?? 0);
    const value = Number.isFinite(raw) ? raw : 0;
    bucket.set(resolved.name, (bucket.get(resolved.name) ?? 0) + value);
  }

  return [...bucket.entries()].map(([name, value]) => ({ name, value }));
}

function geoMapSurfaceColors(isDark: boolean) {
  return {
    baseFill: isDark ? "#334155" : "#f1f5f9",
    emphasisFill: isDark ? "#475569" : chartPalette.brand,
    borderColor: isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.45)",
  };
}

function geoVisualMapColors(isDark: boolean): string[] {
  return isDark
    ? ["#0c4a6e", chartPalette.info, "#38bdf8"]
    : ["#e0f2fe", chartPalette.info, chartPalette.brand];
}

export type GeoMapRowsInput = {
  rows: unknown[][];
  columns: string[];
  regionField: string;
  metricField: string;
  geo?: GeoChartStyle;
  showLabel?: boolean;
  isDark?: boolean;
  embedEdit?: boolean;
  valueFormat?: NumberFormatConfig;
  mapId?: string;
  knownRegionNames?: string[];
  areaMapping?: ReadonlyMap<string, string>;
};

export function buildGeoMapEchartsOption(input: GeoMapRowsInput): Record<string, unknown> {
  ensureVsRegionsMapRegistered();
  const geo = { ...DEFAULT_GEO_CHART_STYLE, ...input.geo };
  const showLabel = input.showLabel ?? geo.showRegionLabel;
  const roam = resolveEmbeddedGeoRoam(geo.roam);
  const isDark = input.isDark ?? false;
  const surface = geoMapSurfaceColors(isDark);
  const mapId = input.mapId ?? VS_REGIONS_MAP_ID;
  const drillDepth = mapId === VS_REGIONS_MAP_ID ? 0 : 1;
  const knownNames = input.knownRegionNames ?? listVsRegionNames();

  const data = aggregateMapRegionData(
    input.rows,
    input.columns,
    input.regionField,
    input.metricField,
    knownNames,
    drillDepth,
    input.areaMapping,
  );
  const values = data.map((item) => item.value);
  const max = values.length ? Math.max(...values) : 1;
  const min = values.length ? Math.min(...values, 0) : 0;
  const formatValue = (value: unknown) =>
    formatChartValue(value, input.valueFormat);

  const option: Record<string, unknown> = {
    tooltip: {
      trigger: "item",
      formatter: (params: { name?: string; value?: number }) =>
        `${params.name ?? ""}: ${formatValue(params.value ?? 0)}`,
    },
    series: [
      {
        type: "map",
        map: mapId,
        roam,
        ...(roam ? { scaleLimit: GEO_MAP_SCALE_LIMIT } : {}),
        layoutCenter: ["50%", "52%"],
        layoutSize: "92%",
        label: { show: showLabel, fontSize: 11, color: isDark ? "#e2e8f0" : "#475569" },
        emphasis: {
          label: { show: showLabel },
          itemStyle: { areaColor: surface.emphasisFill },
        },
        itemStyle: {
          borderColor: surface.borderColor,
          borderWidth: 0.6,
          areaColor: surface.baseFill,
        },
        data,
      },
    ],
  };

  if (geo.visualMap) {
    option.visualMap = {
      min,
      max: max === min ? min + 1 : max,
      left: 16,
      bottom: 16,
      calculable: true,
      text: ["高", "低"],
      inRange: { color: geoVisualMapColors(isDark) },
      textStyle: { fontSize: 11, color: isDark ? "#cbd5e1" : "#475569" },
      formatter: (value: number) => formatValue(value),
    };
  }

  return option;
}

export type GeoHeatmapPlaceholderInput = {
  geo?: GeoChartStyle;
  isDark?: boolean;
};

/** 对标 DataEase：未绑字段/无数据时展示空热力网格 */
export function buildGeoHeatmapPlaceholderEchartsOption(
  input: GeoHeatmapPlaceholderInput = {},
): Record<string, unknown> {
  const isDark = input.isDark ?? false;
  const geo = { ...DEFAULT_GEO_CHART_STYLE, ...input.geo };
  const xCats = ["维度 A", "维度 B", "维度 C", "维度 D"];
  const yCats = ["维度 1", "维度 2", "维度 3"];
  const axisColor = isDark ? "#94a3b8" : "#667085";
  const splitColor = isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.2)";

  return {
    [VS_GEO_HEATMAP_PLACEHOLDER_FLAG]: true,
    grid: { containLabel: true, left: 48, right: 24, top: 24, bottom: geo.visualMap ? 56 : 24 },
    xAxis: {
      type: "category",
      data: xCats,
      splitArea: { show: true, areaStyle: { color: [splitColor, "transparent"] } },
      axisLabel: { color: axisColor, fontSize: 11 },
      axisLine: { lineStyle: { color: splitColor } },
    },
    yAxis: {
      type: "category",
      data: yCats,
      splitArea: { show: true, areaStyle: { color: [splitColor, "transparent"] } },
      axisLabel: { color: axisColor, fontSize: 11 },
      axisLine: { lineStyle: { color: splitColor } },
    },
    series: [
      {
        type: "heatmap",
        data: [],
        label: { show: false },
        itemStyle: { borderColor: isDark ? "#1e293b" : "#fff", borderWidth: 1 },
      },
    ],
  };
}

export type GeoHeatmapRowsInput = {
  rows: unknown[][];
  columns: string[];
  xField: string;
  yField: string;
  metricField: string;
  geo?: GeoChartStyle;
  isDark?: boolean;
  valueFormat?: NumberFormatConfig;
};

export function buildGeoHeatmapEchartsOption(input: GeoHeatmapRowsInput): Record<string, unknown> {
  if (input.rows.length === 0) {
    return buildGeoHeatmapPlaceholderEchartsOption({
      geo: input.geo,
      isDark: input.isDark,
    });
  }

  const xi = input.columns.indexOf(input.xField);
  const yi = input.columns.indexOf(input.yField);
  const mi = input.columns.indexOf(input.metricField);
  const geo = { ...DEFAULT_GEO_CHART_STYLE, ...input.geo };
  const isDark = input.isDark ?? false;
  const formatValue = (value: unknown) =>
    formatChartValue(value, input.valueFormat);

  const xCats = [...new Set(input.rows.map((row) => String(row[xi] ?? "")))];
  const yCats = [...new Set(input.rows.map((row) => String(row[yi] ?? "")))];
  const cellBucket = new Map<string, number>();

  for (const row of input.rows) {
    const xKey = String(row[xi] ?? "");
    const yKey = String(row[yi] ?? "");
    const raw = Number(row[mi] ?? 0);
    const value = Number.isFinite(raw) ? raw : 0;
    const key = `${xKey}\0${yKey}`;
    cellBucket.set(key, (cellBucket.get(key) ?? 0) + value);
  }

  const data = [...cellBucket.entries()].map(([key, value]) => {
    const [xKey, yKey] = key.split("\0");
    return [xCats.indexOf(xKey), yCats.indexOf(yKey), value] as [number, number, number];
  });
  const values = data.map((item) => item[2]);
  const max = values.length ? Math.max(...values) : 1;
  const min = values.length ? Math.min(...values, 0) : 0;
  const axisColor = isDark ? "#94a3b8" : "#667085";
  const splitColor = isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.2)";

  const option: Record<string, unknown> = {
    tooltip: {
      position: "top",
      formatter: (params: { data?: [number, number, number] }) => {
        const tuple = params.data;
        if (!tuple) return "";
        const [xIndex, yIndex, value] = tuple;
        return `${xCats[xIndex] ?? ""} × ${yCats[yIndex] ?? ""}: ${formatValue(value)}`;
      },
    },
    grid: { containLabel: true, left: 48, right: 24, top: 24, bottom: geo.visualMap ? 56 : 24 },
    xAxis: {
      type: "category",
      data: xCats,
      splitArea: { show: true, areaStyle: { color: [splitColor, "transparent"] } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: yCats,
      splitArea: { show: true, areaStyle: { color: [splitColor, "transparent"] } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    series: [
      {
        type: "heatmap",
        data,
        label: {
          show: geo.showCellLabel === true,
          formatter: (params: { data?: [number, number, number] }) => {
            const value = params.data?.[2];
            return value == null ? "" : formatValue(value);
          },
          color: isDark ? "#e2e8f0" : "#344054",
          fontSize: 10,
        },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" } },
        itemStyle: { borderColor: isDark ? "#1e293b" : "#fff", borderWidth: 1 },
      },
    ],
  };

  if (geo.visualMap) {
    option.visualMap = {
      min,
      max: max === min ? min + 1 : max,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      inRange: { color: geoVisualMapColors(isDark) },
      textStyle: { color: isDark ? "#cbd5e1" : "#475569" },
      formatter: (value: number) => formatValue(value),
    };
  }

  return option;
}
