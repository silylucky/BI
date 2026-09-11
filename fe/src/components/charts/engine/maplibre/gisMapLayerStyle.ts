import {
  buildClusterCirclePaint,
  buildClusterCountLayout,
  buildClusterCountPaint,
  buildClusterGlowPaint,
  buildClusterHaloPaint,
  buildHeatmapDetailCirclePaint,
  buildHeatmapDetailGlowPaint,
  buildHeatmapGlowPaint,
  buildHeatmapHaloPaint,
  buildHeatmapPaint,
  buildScatterCorePaint,
  buildScatterGlowPaint,
  buildScatterHaloPaint,
  gisLayerClusterGlowId,
  gisLayerClusterHaloId,
  gisLayerHeatmapDetailGlowId,
  gisLayerHeatmapDetailId,
  gisLayerHeatmapGlowId,
  gisLayerHeatmapHaloId,
  gisLayerScatterGlowId,
  gisLayerScatterHaloId,
} from "@/components/charts/engine/maplibre/gisOverlayVisual";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { GisProjectLayer } from "@/components/charts/engine/maplibre/gisProject";
import {
  buildGisOverlayLabelLayout,
  buildGisOverlayLabelPaint,
  buildGisOverlayLayerDefinitions,
  buildGisOverlayStyleKey,
  emptyGisOverlayGeoJson,
  type GisOverlayLayerOptions,
} from "@/components/charts/engine/maplibre/gisMapOverlayStyle";
import { whenGisMapStyleReady } from "@/components/charts/engine/maplibre/gisMapRuntime";
import { resolveGisOverlayStyle } from "@/components/charts/engine/maplibre/gisProject";

type MapLibreMap = import("maplibre-gl").Map;

export function gisLayerSourceId(layerId: string): string {
  return `vs-gis-layer-${layerId}`;
}

export function gisLayerHeatmapId(layerId: string): string {
  return `vs-gis-layer-${layerId}-heat`;
}

export {
  gisLayerClusterGlowId,
  gisLayerClusterHaloId,
  gisLayerHeatmapDetailGlowId,
  gisLayerHeatmapDetailId,
  gisLayerHeatmapGlowId,
  gisLayerHeatmapHaloId,
  gisLayerScatterGlowId,
  gisLayerScatterHaloId,
} from "@/components/charts/engine/maplibre/gisOverlayVisual";

export type GisLayerRuntimeEntry = {
  layer: GisProjectLayer;
  geoJson: GeoJSON.FeatureCollection | null;
  options: GisOverlayLayerOptions;
};

function scaleCircleOpacity(paint: Record<string, unknown>, layerOpacity: number): Record<string, unknown> {
  const opacity = paint["circle-opacity"];
  if (typeof opacity === "number") {
    return { ...paint, "circle-opacity": opacity * layerOpacity };
  }
  return paint;
}

function buildHeatmapLayers(
  layerId: string,
  sourceId: string,
  resolved: ReturnType<typeof resolveGisOverlayStyle>,
  layerOpacity: number,
  chartColors?: string[],
  visible = true,
): LayerSpecification[] {
  const visibility = visible ? "visible" : "none";
  const fade = resolved.heatmapCrossfadeZoom;
  return [
    {
      id: gisLayerHeatmapHaloId(layerId),
      type: "circle",
      source: sourceId,
      maxzoom: fade + 1,
      layout: { visibility },
      paint: buildHeatmapHaloPaint(resolved, layerOpacity, chartColors),
    },
    {
      id: gisLayerHeatmapGlowId(layerId),
      type: "circle",
      source: sourceId,
      maxzoom: fade + 1,
      layout: { visibility },
      paint: buildHeatmapGlowPaint(resolved, layerOpacity, chartColors),
    },
    {
      id: gisLayerHeatmapId(layerId),
      type: "heatmap",
      source: sourceId,
      maxzoom: fade + 1,
      layout: { visibility },
      paint: buildHeatmapPaint(resolved, layerOpacity, chartColors),
    },
    {
      id: gisLayerHeatmapDetailGlowId(layerId),
      type: "circle",
      source: sourceId,
      minzoom: fade - 0.5,
      layout: { visibility },
      paint: buildHeatmapDetailGlowPaint(resolved, layerOpacity, chartColors),
    },
    {
      id: gisLayerHeatmapDetailId(layerId),
      type: "circle",
      source: sourceId,
      minzoom: fade - 0.5,
      layout: { visibility },
      paint: buildHeatmapDetailCirclePaint(resolved, layerOpacity, chartColors),
    },
  ];
}

function remapOverlayLayerId(spec: LayerSpecification, entry: GisLayerRuntimeEntry): LayerSpecification {
  const layerId = entry.layer.id;
  const id = spec.id
    .replace("vs-gis-overlay-scatter-halo", gisLayerScatterHaloId(layerId))
    .replace("vs-gis-overlay-cluster-halo", gisLayerClusterHaloId(layerId))
    .replace("vs-gis-overlay-cluster-glow", gisLayerClusterGlowId(layerId))
    .replace("vs-gis-overlay-glow", gisLayerScatterGlowId(layerId))
    .replace("vs-gis-overlay", `vs-gis-layer-${layerId}`);
  const layerOpacity = entry.layer.opacity ?? 1;
  const visible = entry.layer.visible !== false;
  const resolved = resolveGisOverlayStyle(entry.layer.style, entry.options.chartColors);
  let paint = spec.paint ?? {};
  if (spec.type === "circle") {
    if (id.endsWith("-scatter-halo")) {
      paint = buildScatterHaloPaint(resolved, layerOpacity, entry.options.chartColors);
    } else if (id.endsWith("-cluster-halo")) {
      paint = buildClusterHaloPaint(resolved, entry.options.chartColors);
      paint = scaleCircleOpacity(paint, layerOpacity);
    } else if (id.endsWith("-cluster-glow")) {
      paint = buildClusterGlowPaint(resolved, entry.options.chartColors);
      paint = scaleCircleOpacity(paint, layerOpacity);
    } else if (id.endsWith("-glow")) {
      paint = buildScatterGlowPaint(resolved, layerOpacity, entry.options.chartColors);
    } else if (id.endsWith("-circles")) {
      paint = buildScatterCorePaint(resolved, layerOpacity, entry.options.chartColors, entry.options.flavor);
    } else if (id.endsWith("-clusters")) {
      paint = buildClusterCirclePaint(resolved, entry.options.chartColors);
      paint = scaleCircleOpacity(paint, layerOpacity);
    }
  }
  return {
    ...spec,
    id,
    source: gisLayerSourceId(layerId),
    layout: {
      ...(spec.layout ?? {}),
      visibility: visible ? "visible" : "none",
    },
    paint,
  };
}

function buildLayerDefinitions(entry: GisLayerRuntimeEntry) {
  const sourceId = gisLayerSourceId(entry.layer.id);
  const data = entry.geoJson ?? emptyGisOverlayGeoJson();
  const layerOpacity = entry.layer.opacity ?? 1;
  const visible = entry.layer.visible !== false;

  if (entry.layer.kind === "heatmap") {
    const resolved = resolveGisOverlayStyle(entry.layer.style, entry.options.chartColors);
    return {
      source: {
        id: sourceId,
        spec: { type: "geojson" as const, data },
      },
      layers: buildHeatmapLayers(
        entry.layer.id,
        sourceId,
        resolved,
        layerOpacity,
        entry.options.chartColors,
        visible,
      ),
    };
  }

  const { source, layers } = buildGisOverlayLayerDefinitions(data, entry.options);
  return {
    source: { id: sourceId, spec: source.spec },
    layers: layers.map((spec) => remapOverlayLayerId(spec, entry)),
  };
}

export function appendGisProjectLayersToStyle(
  style: StyleSpecification,
  entries: GisLayerRuntimeEntry[],
): StyleSpecification {
  let next = style;
  for (const entry of entries) {
    const { source, layers } = buildLayerDefinitions(entry);
    next = {
      ...next,
      sources: {
        ...next.sources,
        [source.id]: source.spec,
      },
      layers: [...(next.layers ?? []), ...layers],
    };
  }
  return next;
}

export function syncGisProjectLayerData(
  map: MapLibreMap,
  entry: GisLayerRuntimeEntry,
): void {
  whenGisMapStyleReady(map, () => {
    const source = map.getSource(gisLayerSourceId(entry.layer.id)) as
      | import("maplibre-gl").GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(entry.geoJson ?? emptyGisOverlayGeoJson());
  });
}

function applyCirclePaint(map: MapLibreMap, layerId: string, paint: Record<string, unknown>) {
  if (!map.getLayer(layerId)) return;
  for (const [key, value] of Object.entries(paint)) {
    map.setPaintProperty(layerId, key, value);
  }
}

export function syncGisProjectLayerStyle(
  map: MapLibreMap,
  entry: GisLayerRuntimeEntry,
): void {
  whenGisMapStyleReady(map, () => {
    const layerOpacity = entry.layer.opacity ?? 1;
    const visible = entry.layer.visible !== false ? "visible" : "none";
    const resolved = resolveGisOverlayStyle(entry.layer.style, entry.options.chartColors);
    const chartColors = entry.options.chartColors;

    if (entry.layer.kind === "heatmap") {
      const haloId = gisLayerHeatmapHaloId(entry.layer.id);
      const glowId = gisLayerHeatmapGlowId(entry.layer.id);
      const heatId = gisLayerHeatmapId(entry.layer.id);
      const detailGlowId = gisLayerHeatmapDetailGlowId(entry.layer.id);
      const detailId = gisLayerHeatmapDetailId(entry.layer.id);
      for (const id of [haloId, glowId, heatId, detailGlowId, detailId]) {
        if (!map.getLayer(id)) continue;
        map.setLayoutProperty(id, "visibility", visible);
      }
      applyCirclePaint(map, haloId, buildHeatmapHaloPaint(resolved, layerOpacity, chartColors));
      applyCirclePaint(map, glowId, buildHeatmapGlowPaint(resolved, layerOpacity, chartColors));
      if (map.getLayer(heatId)) {
        const heatPaint = buildHeatmapPaint(resolved, layerOpacity, chartColors);
        for (const [key, value] of Object.entries(heatPaint)) {
          map.setPaintProperty(heatId, key, value);
        }
      }
      applyCirclePaint(map, detailGlowId, buildHeatmapDetailGlowPaint(resolved, layerOpacity, chartColors));
      applyCirclePaint(map, detailId, buildHeatmapDetailCirclePaint(resolved, layerOpacity, chartColors));
      return;
    }

    const haloId = gisLayerScatterHaloId(entry.layer.id);
    const clusterHaloId = gisLayerClusterHaloId(entry.layer.id);
    const clusterGlowId = gisLayerClusterGlowId(entry.layer.id);
    const glowId = gisLayerScatterGlowId(entry.layer.id);
    const circleId = `vs-gis-layer-${entry.layer.id}-circles`;
    const clusterId = `vs-gis-layer-${entry.layer.id}-clusters`;
    const clusterCountId = `vs-gis-layer-${entry.layer.id}-cluster-count`;
    const labelId = `vs-gis-layer-${entry.layer.id}-labels`;
    for (const id of [haloId, clusterHaloId, clusterGlowId, glowId, circleId, clusterId, clusterCountId, labelId]) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, "visibility", visible);
    }
    applyCirclePaint(map, haloId, buildScatterHaloPaint(resolved, layerOpacity, chartColors));
    applyCirclePaint(
      map,
      clusterHaloId,
      scaleCircleOpacity(buildClusterHaloPaint(resolved, chartColors), layerOpacity),
    );
    applyCirclePaint(
      map,
      clusterGlowId,
      scaleCircleOpacity(buildClusterGlowPaint(resolved, chartColors), layerOpacity),
    );
    applyCirclePaint(map, glowId, buildScatterGlowPaint(resolved, layerOpacity, chartColors));
    applyCirclePaint(
      map,
      circleId,
      buildScatterCorePaint(resolved, layerOpacity, chartColors, entry.options.flavor),
    );
    applyCirclePaint(
      map,
      clusterId,
      scaleCircleOpacity(buildClusterCirclePaint(resolved, chartColors), layerOpacity),
    );
    if (map.getLayer(clusterCountId)) {
      const countLayout = buildClusterCountLayout();
      for (const [key, value] of Object.entries(countLayout)) {
        map.setLayoutProperty(clusterCountId, key, value);
      }
      const countPaint = buildClusterCountPaint(chartColors);
      for (const [key, value] of Object.entries(countPaint)) {
        map.setPaintProperty(clusterCountId, key, value);
      }
    }
    if (map.getLayer(labelId)) {
      const labelLayout = buildGisOverlayLabelLayout(resolved);
      for (const [key, value] of Object.entries(labelLayout)) {
        map.setLayoutProperty(labelId, key, value);
      }
      map.setLayerZoomRange(labelId, resolved.labelMinZoom, 24);
      const labelPaint = buildGisOverlayLabelPaint(entry.options.flavor);
      for (const [key, value] of Object.entries(labelPaint)) {
        map.setPaintProperty(labelId, key, value);
      }
    }
  });
}

export function buildGisLayersStyleKey(entries: GisLayerRuntimeEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => ({
      id: entry.layer.id,
      kind: entry.layer.kind,
      visible: entry.layer.visible !== false,
      opacity: entry.layer.opacity ?? 1,
      styleKey: buildGisOverlayStyleKey(entry.options),
    })),
  );
}

/** 仅图层拓扑/源结构；散点颜色/半径等走 syncGisProjectLayerStyle，避免 setStyle 漂移视角。 */
export function buildGisLayersStructuralKey(entries: GisLayerRuntimeEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => {
      const resolved = resolveGisOverlayStyle(entry.layer.style, entry.options.chartColors);
      return {
        id: entry.layer.id,
        kind: entry.layer.kind,
        flavor: entry.options.flavor,
        visible: entry.layer.visible !== false,
        cluster: resolved.cluster,
        ...(resolved.cluster
          ? { clusterMaxZoom: resolved.clusterMaxZoom, clusterRadius: resolved.clusterRadius }
          : {}),
        ...(entry.layer.kind === "heatmap"
          ? { heatmapCrossfadeZoom: resolved.heatmapCrossfadeZoom }
          : {}),
      };
    }),
  );
}

export function gisScatterInteractionLayerIds(layerId: string, cluster: boolean): string[] {
  const prefix = `vs-gis-layer-${layerId}`;
  return cluster
    ? [`${prefix}-clusters`, `${prefix}-circles`]
    : [`${prefix}-circles`];
}

export function syncGisProjectLayers(
  map: MapLibreMap,
  entries: GisLayerRuntimeEntry[],
): void {
  for (const entry of entries) {
    syncGisProjectLayerData(map, entry);
    syncGisProjectLayerStyle(map, entry);
  }
}
