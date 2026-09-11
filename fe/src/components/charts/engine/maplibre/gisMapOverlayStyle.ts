import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";
import {
  buildClusterCirclePaint,
  buildClusterCountLayout,
  buildClusterCountPaint,
  buildClusterGlowPaint,
  buildClusterHaloPaint,
  buildScatterCorePaint,
  buildScatterGlowPaint,
  buildScatterHaloPaint,
  buildScatterRadiusExpression,
} from "@/components/charts/engine/maplibre/gisOverlayVisual";
import {
  GIS_OVERLAY_CIRCLE_LAYER_ID,
  GIS_OVERLAY_CLUSTER_COUNT_LAYER_ID,
  GIS_OVERLAY_CLUSTER_FILTER,
  GIS_OVERLAY_CLUSTER_GLOW_LAYER_ID,
  GIS_OVERLAY_CLUSTER_HALO_LAYER_ID,
  GIS_OVERLAY_CLUSTER_LAYER_ID,
  GIS_OVERLAY_GLOW_LAYER_ID,
  GIS_OVERLAY_LABEL_LAYER_ID,
  GIS_OVERLAY_SCATTER_HALO_LAYER_ID,
  GIS_OVERLAY_SOURCE_ID,
  GIS_OVERLAY_UNCLUSTERED_FILTER,
} from "@/components/charts/engine/maplibre/gisMapStyle";
import type { GisBasemapFlavor, GisProjectOverlay } from "@/components/charts/engine/maplibre/gisProject";
import {
  DEFAULT_GIS_OVERLAY,
  resolveGisOverlayStyle,
  type ResolvedGisOverlayStyle,
} from "@/components/charts/engine/maplibre/gisProject";
import { whenGisMapStyleReady } from "@/components/charts/engine/maplibre/gisMapRuntime";

type MapLibreMap = import("maplibre-gl").Map;

export type GisOverlayLayerOptions = {
  flavor: GisBasemapFlavor;
  overlay?: GisProjectOverlay;
  chartColors?: string[];
};

export function buildGisOverlayCircleRadius(resolved: ResolvedGisOverlayStyle): number | ExpressionSpecification {
  return buildScatterRadiusExpression(resolved);
}

export function buildGisOverlayCirclePaint(
  resolved: ResolvedGisOverlayStyle,
  chartColors?: string[],
  flavor?: GisBasemapFlavor,
): Record<string, unknown> {
  return buildScatterCorePaint(resolved, 1, chartColors, flavor);
}

export { buildClusterCirclePaint, buildClusterCountLayout, buildClusterCountPaint, buildClusterGlowPaint, buildClusterHaloPaint };

function overlayLabelPaint(flavor: GisBasemapFlavor) {
  const darkBasemap = flavor === "dark" || flavor === "black";
  return {
    "text-color": darkBasemap ? "#f8fafc" : "#0f172a",
  };
}

function clusterCountPaint(chartColors?: string[]): Record<string, unknown> {
  return buildClusterCountPaint(chartColors);
}

export function buildGisOverlayLabelLayout(
  resolved: ResolvedGisOverlayStyle,
): Record<string, unknown> {
  return {
    visibility: resolved.showLabels ? "visible" : "none",
    "text-field": ["coalesce", ["get", "label"], ["to-string", ["get", "value"]]],
    "text-size": 12,
    "text-offset": [0, 0.85],
    "text-anchor": "top",
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "text-optional": true,
    "text-max-width": 8,
  };
}

export function buildGisOverlayLabelPaint(flavor: GisBasemapFlavor): Record<string, unknown> {
  return overlayLabelPaint(flavor);
}

function buildHaloLayer(
  resolved: ResolvedGisOverlayStyle,
  options: GisOverlayLayerOptions,
  filter?: typeof GIS_OVERLAY_UNCLUSTERED_FILTER,
): LayerSpecification {
  return {
    id: GIS_OVERLAY_SCATTER_HALO_LAYER_ID,
    type: "circle",
    source: GIS_OVERLAY_SOURCE_ID,
    ...(filter ? { filter } : {}),
    paint: buildScatterHaloPaint(resolved, 1, options.chartColors),
  };
}

function buildGlowLayer(
  resolved: ResolvedGisOverlayStyle,
  options: GisOverlayLayerOptions,
  filter?: typeof GIS_OVERLAY_UNCLUSTERED_FILTER,
): LayerSpecification {
  return {
    id: GIS_OVERLAY_GLOW_LAYER_ID,
    type: "circle",
    source: GIS_OVERLAY_SOURCE_ID,
    ...(filter ? { filter } : {}),
    paint: buildScatterGlowPaint(resolved, 1, options.chartColors),
  };
}

function buildSimpleLayers(
  resolved: ResolvedGisOverlayStyle,
  flavor: GisBasemapFlavor,
  options: GisOverlayLayerOptions,
): LayerSpecification[] {
  return [
    buildHaloLayer(resolved, options),
    buildGlowLayer(resolved, options),
    {
      id: GIS_OVERLAY_CIRCLE_LAYER_ID,
      type: "circle",
      source: GIS_OVERLAY_SOURCE_ID,
      paint: buildGisOverlayCirclePaint(resolved, options.chartColors, flavor),
    },
    {
      id: GIS_OVERLAY_LABEL_LAYER_ID,
      type: "symbol",
      source: GIS_OVERLAY_SOURCE_ID,
      minzoom: resolved.labelMinZoom,
      layout: buildGisOverlayLabelLayout(resolved),
      paint: buildGisOverlayLabelPaint(flavor),
    },
  ];
}

function buildClusterLayers(
  resolved: ResolvedGisOverlayStyle,
  flavor: GisBasemapFlavor,
  options: GisOverlayLayerOptions,
): LayerSpecification[] {
  return [
    {
      id: GIS_OVERLAY_CLUSTER_HALO_LAYER_ID,
      type: "circle",
      source: GIS_OVERLAY_SOURCE_ID,
      filter: GIS_OVERLAY_CLUSTER_FILTER,
      paint: buildClusterHaloPaint(resolved, options.chartColors),
    },
    {
      id: GIS_OVERLAY_CLUSTER_GLOW_LAYER_ID,
      type: "circle",
      source: GIS_OVERLAY_SOURCE_ID,
      filter: GIS_OVERLAY_CLUSTER_FILTER,
      paint: buildClusterGlowPaint(resolved, options.chartColors),
    },
    {
      id: GIS_OVERLAY_CLUSTER_LAYER_ID,
      type: "circle",
      source: GIS_OVERLAY_SOURCE_ID,
      filter: GIS_OVERLAY_CLUSTER_FILTER,
      paint: buildClusterCirclePaint(resolved, options.chartColors),
    },
    {
      id: GIS_OVERLAY_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: GIS_OVERLAY_SOURCE_ID,
      filter: GIS_OVERLAY_CLUSTER_FILTER,
      layout: buildClusterCountLayout(),
      paint: clusterCountPaint(options.chartColors),
    },
    buildHaloLayer(resolved, options, GIS_OVERLAY_UNCLUSTERED_FILTER),
    buildGlowLayer(resolved, options, GIS_OVERLAY_UNCLUSTERED_FILTER),
    {
      id: GIS_OVERLAY_CIRCLE_LAYER_ID,
      type: "circle",
      source: GIS_OVERLAY_SOURCE_ID,
      filter: GIS_OVERLAY_UNCLUSTERED_FILTER,
      paint: buildGisOverlayCirclePaint(resolved, options.chartColors, flavor),
    },
    {
      id: GIS_OVERLAY_LABEL_LAYER_ID,
      type: "symbol",
      source: GIS_OVERLAY_SOURCE_ID,
      filter: GIS_OVERLAY_UNCLUSTERED_FILTER,
      minzoom: resolved.labelMinZoom,
      layout: buildGisOverlayLabelLayout(resolved),
      paint: buildGisOverlayLabelPaint(flavor),
    },
  ];
}

export function buildGisOverlayLayerDefinitions(
  overlay: GeoJSON.FeatureCollection,
  options: GisOverlayLayerOptions,
) {
  const resolved = resolveGisOverlayStyle(options.overlay, options.chartColors);
  const sourceSpec = resolved.cluster
    ? {
        type: "geojson" as const,
        data: overlay,
        cluster: true,
        clusterMaxZoom: resolved.clusterMaxZoom,
        clusterRadius: resolved.clusterRadius,
      }
    : { type: "geojson" as const, data: overlay };
  const layers = resolved.cluster
    ? buildClusterLayers(resolved, options.flavor, options)
    : buildSimpleLayers(resolved, options.flavor, options);
  return {
    source: { id: GIS_OVERLAY_SOURCE_ID, spec: sourceSpec },
    layers,
  };
}

export function emptyGisOverlayGeoJson(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

export function syncGisOverlayData(map: MapLibreMap, geoJson: GeoJSON.FeatureCollection | null) {
  whenGisMapStyleReady(map, () => {
    const source = map.getSource(GIS_OVERLAY_SOURCE_ID) as import("maplibre-gl").GeoJSONSource | undefined;
    if (!source) return;
    source.setData(geoJson ?? emptyGisOverlayGeoJson());
  });
}

function applyCirclePaint(map: MapLibreMap, layerId: string, paint: Record<string, unknown>) {
  if (!map.getLayer(layerId)) return;
  for (const [key, value] of Object.entries(paint)) {
    map.setPaintProperty(layerId, key, value);
  }
}

function applyLabelStyle(
  map: MapLibreMap,
  resolved: ResolvedGisOverlayStyle,
  flavor: GisBasemapFlavor,
) {
  if (!map.getLayer(GIS_OVERLAY_LABEL_LAYER_ID)) return;
  const labelLayout = buildGisOverlayLabelLayout(resolved);
  for (const [key, value] of Object.entries(labelLayout)) {
    map.setLayoutProperty(GIS_OVERLAY_LABEL_LAYER_ID, key, value);
  }
  map.setLayerZoomRange(GIS_OVERLAY_LABEL_LAYER_ID, resolved.labelMinZoom, 24);
  const labelPaint = buildGisOverlayLabelPaint(flavor);
  for (const [key, value] of Object.entries(labelPaint)) {
    map.setPaintProperty(GIS_OVERLAY_LABEL_LAYER_ID, key, value);
  }
}

export function syncGisOverlayStyle(map: MapLibreMap, options: GisOverlayLayerOptions) {
  whenGisMapStyleReady(map, () => {
    if (!map.getLayer(GIS_OVERLAY_CIRCLE_LAYER_ID) && !map.getLayer(GIS_OVERLAY_CLUSTER_LAYER_ID)) {
      return;
    }
    const resolved = resolveGisOverlayStyle(options.overlay, options.chartColors);
    applyCirclePaint(
      map,
      GIS_OVERLAY_SCATTER_HALO_LAYER_ID,
      buildScatterHaloPaint(resolved, 1, options.chartColors),
    );
    applyCirclePaint(map, GIS_OVERLAY_GLOW_LAYER_ID, buildScatterGlowPaint(resolved, 1, options.chartColors));
    applyCirclePaint(
      map,
      GIS_OVERLAY_CLUSTER_HALO_LAYER_ID,
      buildClusterHaloPaint(resolved, options.chartColors),
    );
    applyCirclePaint(
      map,
      GIS_OVERLAY_CLUSTER_GLOW_LAYER_ID,
      buildClusterGlowPaint(resolved, options.chartColors),
    );
    applyCirclePaint(map, GIS_OVERLAY_CLUSTER_LAYER_ID, buildClusterCirclePaint(resolved, options.chartColors));
    if (map.getLayer(GIS_OVERLAY_CLUSTER_COUNT_LAYER_ID)) {
      const countLayout = buildClusterCountLayout();
      for (const [key, value] of Object.entries(countLayout)) {
        map.setLayoutProperty(GIS_OVERLAY_CLUSTER_COUNT_LAYER_ID, key, value);
      }
      const countPaint = clusterCountPaint(options.chartColors);
      for (const [key, value] of Object.entries(countPaint)) {
        map.setPaintProperty(GIS_OVERLAY_CLUSTER_COUNT_LAYER_ID, key, value);
      }
    }
    applyCirclePaint(
      map,
      GIS_OVERLAY_CIRCLE_LAYER_ID,
      buildGisOverlayCirclePaint(resolved, options.chartColors, options.flavor),
    );
    applyLabelStyle(map, resolved, options.flavor);
  });
}

export function buildGisOverlayStyleKey(options: GisOverlayLayerOptions): string {
  const resolved = resolveGisOverlayStyle(options.overlay, options.chartColors);
  return JSON.stringify({ ...resolved, flavor: options.flavor });
}

export { DEFAULT_GIS_OVERLAY };
