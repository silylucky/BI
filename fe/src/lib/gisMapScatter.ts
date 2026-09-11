import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { ensureChartSlotCapacity } from "@/components/dashboard/chartFieldSlots";
import { resolveSampleDbDatasource, type SampleDatasourceItem } from "@/lib/mapChartSalesGeo";

/** sample_db · de_map_heat：区县坐标 + 销售额（GIS 散点官方示例） */
export const GIS_MAP_SCATTER_SAMPLE_SQL = `SELECT point_name, lng, lat, amount, province, city
FROM de_map_heat
WHERE lng IS NOT NULL AND lat IS NOT NULL
LIMIT 500`;

export const DEMO_MAP_SCATTER_DATASET_ID = "demo-map-scatter";

const LNG_NAME_PATTERN = /(?:^|_)(lng|lon|longitude|经度|x_coord)(?:$|_)/i;
const LAT_NAME_PATTERN = /(?:^|_)(lat|latitude|纬度|y_coord)(?:$|_)/i;
const GEO_NAME_PATTERN =
  /(?:^|_)(region|province|city|district|area|country|state|county|name|route|地区|省份|城市|区县|国家)(?:$|_)/i;

export function looksLikeGisLngField(field: string): boolean {
  return LNG_NAME_PATTERN.test(field.trim());
}

export function looksLikeGisLatField(field: string): boolean {
  return LAT_NAME_PATTERN.test(field.trim());
}

export function looksLikeGisGeoLabelField(field: string): boolean {
  const trimmed = field.trim();
  return GEO_NAME_PATTERN.test(trimmed) && !looksLikeGisLngField(trimmed) && !looksLikeGisLatField(trimmed);
}

export function applyGisMapScatterConfig(
  cfg: ChartViewConfig,
  dataSourceId?: string,
  configId?: string,
): ChartViewConfig {
  return ensureChartSlotCapacity({
    ...cfg,
    axes: undefined,
    mode: "dataset",
    sql: undefined,
    datasetId: DEMO_MAP_SCATTER_DATASET_ID,
    configId: configId ?? cfg.configId,
    dataSourceId: dataSourceId ?? cfg.dataSourceId,
    bindingId: undefined,
    dimensions: [{ field: "lng" }, { field: "lat" }, { field: "point_name" }],
    metrics: [{ field: "amount" }],
  });
}

export function isGisMapScatterConfig(cfg: ChartViewConfig): boolean {
  const dims = cfg.dimensions?.map((d) => d.field?.trim()) ?? [];
  return (
    cfg.datasetId === DEMO_MAP_SCATTER_DATASET_ID ||
    (dims[0] === "lng" && dims[1] === "lat" && Boolean(cfg.configId))
  );
}

export { resolveSampleDbDatasource, type SampleDatasourceItem };
