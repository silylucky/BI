import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { activeFieldRefs } from "@/lib/chartConfigState";
import { parseMetricValue } from "@/lib/buildChartRenderModel";
import type { GisProjectLayerBinding } from "@/components/charts/engine/maplibre/gisProjectLayers";
import type { GisProjectOverlay } from "@/components/charts/engine/maplibre/gisProject";

export type GisOverlayPoint = {
  lng: number;
  lat: number;
  label?: string;
  value?: number;
  category?: string;
  color?: string;
};

export type BuildGisOverlayGeoJsonOptions = {
  binding?: GisProjectLayerBinding;
  overlayStyle?: GisProjectOverlay;
};

const DEFAULT_POINT_COLOR = "#2563eb";

function assignCategoryColors(
  categories: Array<string | undefined>,
  chartColors?: string[],
): Map<string, string> {
  const palette = chartColors?.length ? chartColors : [DEFAULT_POINT_COLOR];
  const map = new Map<string, string>();
  let index = 0;
  for (const category of categories) {
    if (!category || map.has(category)) continue;
    map.set(category, palette[index % palette.length] ?? DEFAULT_POINT_COLOR);
    index += 1;
  }
  return map;
}

function resolveOverlayFieldNames(
  config: ChartViewConfig,
  binding?: GisProjectLayerBinding,
): { lngField?: string; latField?: string; labelField?: string; metricField?: string } {
  const dims = activeFieldRefs(config.dimensions);
  const metrics = activeFieldRefs(config.metrics);
  return {
    lngField: binding?.lngField ?? dims[0]?.field,
    latField: binding?.latField ?? dims[1]?.field,
    labelField: binding?.labelField ?? dims[2]?.field,
    metricField: binding?.metricField ?? metrics[0]?.field,
  };
}

export function buildGisOverlayGeoJson(
  config: ChartViewConfig,
  columns: string[],
  rows: (string | number | boolean | null)[][],
  chartColors?: string[],
  options?: BuildGisOverlayGeoJsonOptions,
): GeoJSON.FeatureCollection | null {
  const { lngField, latField, labelField, metricField } = resolveOverlayFieldNames(
    config,
    options?.binding,
  );
  if (!lngField || !latField || rows.length === 0) return null;

  const lngIdx = columns.indexOf(lngField);
  const latIdx = columns.indexOf(latField);
  if (lngIdx < 0 || latIdx < 0) return null;

  const labelIdx = labelField ? columns.indexOf(labelField) : -1;
  const metricIdx = metricField ? columns.indexOf(metricField) : -1;
  const overlayStyle = options?.overlayStyle ?? config.nativeBody?.gisProject?.overlay;
  const colorByCategory = overlayStyle?.colorByCategory !== false;

  const points: GisOverlayPoint[] = [];

  for (const row of rows) {
    const lng = Number(row[lngIdx]);
    const lat = Number(row[latIdx]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const labelRaw = labelIdx >= 0 ? row[labelIdx] : undefined;
    const valueRaw = metricIdx >= 0 ? row[metricIdx] : undefined;
    const value = valueRaw == null ? undefined : parseMetricValue(valueRaw) ?? undefined;
    const label = labelRaw == null ? undefined : String(labelRaw);
    points.push({ lng, lat, label, value, category: label });
  }

  if (!points.length) return null;

  const categoryColorMap = colorByCategory
    ? assignCategoryColors(points.map((point) => point.category), chartColors)
    : new Map<string, string>();

  const metricValues = points
    .map((point) => point.value)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const minValue = metricValues.length ? Math.min(...metricValues) : undefined;
  const maxValue = metricValues.length ? Math.max(...metricValues) : undefined;
  const fallbackColor = chartColors?.[0] ?? DEFAULT_POINT_COLOR;

  const features = points.map((point, index) => {
    let sizeNorm: number | undefined;
    if (point.value != null && minValue != null && maxValue != null) {
      sizeNorm = maxValue === minValue ? 0.5 : (point.value - minValue) / (maxValue - minValue);
    }
    const categoryColor =
      point.category && colorByCategory ? categoryColorMap.get(point.category) : undefined;
    return {
      type: "Feature" as const,
      id: index,
      geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
      properties: {
        label: point.label,
        value: point.value,
        category: point.category,
        sizeNorm,
        weightNorm: sizeNorm,
        color: categoryColor ?? fallbackColor,
      },
    };
  });
  return { type: "FeatureCollection", features };
}
