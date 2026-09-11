import type { JoinedMapFeature } from "@/components/charts/engine/three/geo3dRegionCentroid";
import { resolveRegionAnchorProjected } from "@/components/charts/engine/three/geo3dRegionCentroid";
import {
  ensureNationalRegionAnchorMap,
  resolveRowRegionAnchorLngLat,
} from "@/components/charts/engine/geo/geoHeatRegionAnchors";

export type HeatBlobSample = { x: number; y: number; value: number };

export type HeatBlobRowBuildResult = {
  samples: HeatBlobSample[];
  unmatchedRows: number;
};

const LNG_ALIASES = new Set(["lng", "lon", "long", "longitude", "经度"]);
const LAT_ALIASES = new Set(["lat", "latitude", "纬度"]);
const POSITION_KEY_PRECISION = 4;

function normalizeColumnKey(column: string): string {
  return column.trim().toLowerCase();
}

function positionKey(x: number, y: number): string {
  return `${x.toFixed(POSITION_KEY_PRECISION)}:${y.toFixed(POSITION_KEY_PRECISION)}`;
}

/** 同投影坐标多样本求和，与 choropleth join 聚合语义一致 */
export function aggregateHeatBlobSamplesByPosition(samples: HeatBlobSample[]): HeatBlobSample[] {
  const bucket = new Map<string, HeatBlobSample>();
  for (const sample of samples) {
    const key = positionKey(sample.x, sample.y);
    const existing = bucket.get(key);
    if (existing) {
      existing.value += sample.value;
    } else {
      bucket.set(key, { ...sample });
    }
  }
  return [...bucket.values()];
}

function warnUnmatchedHeatRows(unmatchedRows: number, totalRows: number): void {
  if (!import.meta.env.DEV || unmatchedRows <= 0) return;
  console.warn(
    `[map-3d] heat blob: ${unmatchedRows}/${totalRows} rows could not resolve region anchors`,
  );
}

/** 识别数据表中的经纬度列（大小写不敏感） */
export function resolveHeatCoordColumnIndexes(
  columns: string[],
): { lng: number; lat: number } | null {
  let lng = -1;
  let lat = -1;
  columns.forEach((column, index) => {
    const key = normalizeColumnKey(column);
    if (LNG_ALIASES.has(key)) lng = index;
    if (LAT_ALIASES.has(key)) lat = index;
  });
  return lng >= 0 && lat >= 0 ? { lng, lat } : null;
}

/** 每行一个热力点；同坐标会在聚合阶段求和 */
export function buildHeatBlobSamplesFromRows(
  rows: unknown[][],
  columns: string[],
  metricField: string,
  project: (coord: [number, number]) => [number, number] | null,
): HeatBlobSample[] | null {
  const coordCols = resolveHeatCoordColumnIndexes(columns);
  const mi = columns.indexOf(metricField);
  if (!coordCols || mi < 0) return null;

  const samples: HeatBlobSample[] = [];
  for (const row of rows) {
    const lng = Number(row[coordCols.lng]);
    const lat = Number(row[coordCols.lat]);
    const raw = Number(row[mi] ?? 0);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const value = Number.isFinite(raw) ? raw : 0;
    const projected = project([lng, lat]);
    if (!projected) continue;
    samples.push({ x: projected[0], y: projected[1], value });
  }
  if (samples.length === 0) return null;
  return aggregateHeatBlobSamplesByPosition(samples);
}

export function buildHeatBlobSamplesFromFeatures(
  features: JoinedMapFeature[],
  project: (coord: [number, number]) => [number, number] | null,
): HeatBlobSample[] {
  const samples: HeatBlobSample[] = [];
  for (const feature of features) {
    const projected = resolveRegionAnchorProjected(feature, project);
    if (!projected) continue;
    samples.push({ x: projected[0], y: projected[1], value: feature.value });
  }
  return samples;
}

export function resolveHeatBlobValueRange(
  samples: HeatBlobSample[],
  fallbackMin: number,
  fallbackMax: number,
): { min: number; max: number } {
  if (samples.length === 0) {
    return { min: fallbackMin, max: Math.max(fallbackMax, fallbackMin + 1e-6) };
  }
  const values = samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max: Math.max(max, min + 1e-6) };
}

export function buildHeatBlobSamplesFromRowRegions(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  metricField: string,
  anchors: Map<string, [number, number]>,
  project: (coord: [number, number]) => [number, number] | null,
  areaMapping?: ReadonlyMap<string, string>,
): HeatBlobRowBuildResult {
  const ri = columns.indexOf(regionField);
  const mi = columns.indexOf(metricField);
  if (ri < 0 || mi < 0) return { samples: [], unmatchedRows: rows.length };

  const rawSamples: HeatBlobSample[] = [];
  let unmatchedRows = 0;
  for (const row of rows) {
    const lngLat = resolveRowRegionAnchorLngLat(regionField, row[ri], anchors, areaMapping);
    if (!lngLat) {
      unmatchedRows += 1;
      continue;
    }
    const projected = project(lngLat);
    if (!projected) {
      unmatchedRows += 1;
      continue;
    }
    const raw = Number(row[mi] ?? 0);
    const value = Number.isFinite(raw) ? raw : 0;
    rawSamples.push({ x: projected[0], y: projected[1], value });
  }

  return {
    samples: aggregateHeatBlobSamplesByPosition(rawSamples),
    unmatchedRows,
  };
}

/**
 * 优先经纬度列；否则按数据行地区名在全国省/市锚点索引落点（上层地图可显示下级市州）；
 * 最后回退为当前层级每行政区一个质心点。
 */
export async function buildHeatBlobSamplesForMap(
  rows: unknown[][],
  columns: string[],
  regionField: string,
  metricField: string,
  features: JoinedMapFeature[],
  project: (coord: [number, number]) => [number, number] | null,
  areaMapping?: ReadonlyMap<string, string>,
): Promise<HeatBlobSample[]> {
  const fromCoordCols = buildHeatBlobSamplesFromRows(rows, columns, metricField, project);
  if (fromCoordCols) return fromCoordCols;

  const anchors = await ensureNationalRegionAnchorMap();
  const { samples, unmatchedRows } = buildHeatBlobSamplesFromRowRegions(
    rows,
    columns,
    regionField,
    metricField,
    anchors,
    project,
    areaMapping,
  );
  warnUnmatchedHeatRows(unmatchedRows, rows.length);
  if (samples.length > 0) return samples;

  return buildHeatBlobSamplesFromFeatures(features, project);
}

/**
 * @deprecated 请使用 {@link buildHeatBlobSamplesForMap}（支持上层地图展示下级热力点）
 */
export function buildHeatBlobSamples(
  rows: unknown[][],
  columns: string[],
  metricField: string,
  features: JoinedMapFeature[],
  project: (coord: [number, number]) => [number, number] | null,
): HeatBlobSample[] {
  const fromCoordCols = buildHeatBlobSamplesFromRows(rows, columns, metricField, project);
  if (fromCoordCols) return fromCoordCols;
  return buildHeatBlobSamplesFromFeatures(features, project);
}
