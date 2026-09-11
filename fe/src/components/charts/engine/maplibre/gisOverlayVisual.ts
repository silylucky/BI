import type { ExpressionSpecification } from "maplibre-gl";
import type { GisBasemapFlavor, ResolvedGisOverlayStyle } from "@/components/charts/engine/maplibre/gisProject";

export type GisHeatmapPreset = "ember" | "night" | "scientific";

const EMBER_HEAT_COLOR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(0, 0, 0, 0)",
  0.04,
  "rgba(0, 0, 0, 0)",
  0.15,
  "rgba(255, 110, 35, 0.18)",
  0.35,
  "rgba(255, 155, 45, 0.52)",
  0.58,
  "rgba(255, 195, 70, 0.78)",
  0.78,
  "rgba(255, 230, 130, 0.9)",
  1,
  "rgba(255, 252, 220, 0.98)",
];

const NIGHT_HEAT_COLOR: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(0, 0, 0, 0)",
  0.08,
  "rgba(34, 211, 238, 0)",
  0.22,
  "rgba(34, 211, 238, 0.48)",
  0.48,
  "rgba(167, 139, 250, 0.72)",
  0.72,
  "rgba(251, 113, 133, 0.88)",
  0.9,
  "rgba(255, 220, 180, 0.94)",
  1,
  "rgba(255, 255, 255, 0.98)",
];

function scientificHeatColor(chartColors?: string[]): ExpressionSpecification {
  const c0 = chartColors?.[0] ?? "#60a5fa";
  const c1 = chartColors?.[1] ?? "#22d3ee";
  const c2 = chartColors?.[2] ?? "#fde047";
  const c3 = chartColors?.[3] ?? "#fb7185";
  return [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(0, 0, 0, 0)",
    0.12,
    c0,
    0.38,
    c1,
    0.62,
    c2,
    0.85,
    c3,
    1,
    "rgba(255, 255, 255, 0.96)",
  ];
}

export function buildHeatmapColorExpression(
  preset: GisHeatmapPreset,
  chartColors?: string[],
): ExpressionSpecification {
  if (preset === "scientific") return scientificHeatColor(chartColors);
  if (preset === "night") return NIGHT_HEAT_COLOR;
  return EMBER_HEAT_COLOR;
}

function metricSizeInput(resolved: ResolvedGisOverlayStyle): ExpressionSpecification {
  const metric = ["coalesce", ["get", "sizeNorm"], 0.45] as ExpressionSpecification;
  if (resolved.sizeCurve === "linear") return metric;
  return ["sqrt", metric];
}

function emissiveGlowOpacity(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity: number,
  tier: "halo" | "glow" | "core",
): ExpressionSpecification {
  const glow = resolved.glowStrength;
  const base = resolved.opacity * layerOpacity;
  const tiers = {
    halo: { z2: 0.48, z5: 0.62, z8: 0.68 },
    glow: { z2: 0.58, z5: 0.78, z8: 0.85 },
    core: { z2: 0.62, z5: 0.88, z8: 0.98 },
  } as const;
  const t = tiers[tier];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    base * glow * t.z2,
    5,
    base * glow * t.z5,
    8,
    base * (tier === "core" ? t.z8 : glow * t.z8),
  ];
}

export function buildScatterRadiusExpression(
  resolved: ResolvedGisOverlayStyle,
  scale = 1,
): ExpressionSpecification {
  const metricRadius = [
    "interpolate",
    ["linear"],
    metricSizeInput(resolved),
    0,
    resolved.radiusMin * scale,
    1,
    resolved.radiusMax * scale,
  ] as ExpressionSpecification;

  if (!resolved.scaleByMetric) {
    const fixed = ((resolved.radiusMin + resolved.radiusMax) / 2) * scale;
    return ["interpolate", ["linear"], ["zoom"], 2, fixed * 0.65, 8, fixed, 14, fixed * 1.15];
  }

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    [
      "interpolate",
      ["linear"],
      metricSizeInput(resolved),
      0,
      resolved.radiusMin * 0.55 * scale,
      1,
      resolved.radiusMax * 0.55 * scale,
    ],
    7,
    metricRadius,
    14,
    [
      "interpolate",
      ["linear"],
      metricSizeInput(resolved),
      0,
      resolved.radiusMin * 1.1 * scale,
      1,
      resolved.radiusMax * 1.35 * scale,
    ],
  ];
}

export function buildMetricColorExpression(
  resolved: ResolvedGisOverlayStyle,
  chartColors?: string[],
): string | ExpressionSpecification {
  if (resolved.colorByCategory) {
    return ["coalesce", ["get", "color"], resolved.color];
  }
  if (resolved.scaleByMetric) {
    const low = chartColors?.[1] ?? "#67e8f9";
    const mid = chartColors?.[2] ?? "#fde047";
    const high = chartColors?.[3] ?? chartColors?.[0] ?? "#fb7185";
    return [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "sizeNorm"], 0.45],
      0,
      low,
      0.45,
      mid,
      1,
      high,
    ];
  }
  return resolved.color;
}

export function buildScatterOpacityExpression(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity = 1,
): ExpressionSpecification {
  return emissiveGlowOpacity(resolved, layerOpacity, "core");
}

export function buildHeatmapWeightExpression(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "weightNorm"], ["coalesce", ["get", "sizeNorm"], 0.35]],
    0,
    0.15,
    0.5,
    0.65,
    1,
    1,
  ];
}

export function buildHeatmapPaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity: number,
  chartColors?: string[],
): Record<string, unknown> {
  const radiusMax = resolved.heatmapRadiusMax;
  const intensityBase = resolved.heatmapIntensity;
  const fadeZoom = resolved.heatmapCrossfadeZoom;
  return {
    "heatmap-weight": buildHeatmapWeightExpression(),
    "heatmap-intensity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      intensityBase * 1.55,
      6,
      intensityBase * 1.15,
      fadeZoom,
      intensityBase * 0.5,
    ],
    "heatmap-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      Math.max(3, radiusMax * 0.22),
      4,
      radiusMax * 0.58,
      8,
      radiusMax * 0.95,
      12,
      radiusMax * 1.08,
    ],
    "heatmap-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      fadeZoom - 1,
      Math.min(1, resolved.opacity * layerOpacity * 1.05),
      fadeZoom + 1,
      0,
    ],
    "heatmap-color": buildHeatmapColorExpression(resolved.heatmapPreset, chartColors),
  };
}

function heatmapPointRadius(resolved: ResolvedGisOverlayStyle, scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "weightNorm"], ["get", "sizeNorm"], 0.4],
    0,
    6 * scale,
    0.5,
    18 * scale,
    1,
    32 * scale,
  ];
}

export function buildHeatmapHaloPaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity: number,
  chartColors?: string[],
): Record<string, unknown> {
  const fade = resolved.heatmapCrossfadeZoom;
  const accent = chartColors?.[0] ?? resolved.color;
  const glow = resolved.glowStrength;
  return {
    "circle-radius": heatmapPointRadius(resolved, 1.55),
    "circle-color": accent,
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      resolved.opacity * layerOpacity * glow * 0.38,
      fade - 1.5,
      resolved.opacity * layerOpacity * glow * 0.18,
      fade,
      0,
    ],
    "circle-blur": 1,
    "circle-stroke-width": 0,
  };
}

export function buildHeatmapGlowPaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity: number,
  chartColors?: string[],
): Record<string, unknown> {
  const fade = resolved.heatmapCrossfadeZoom;
  const accent = chartColors?.[1] ?? chartColors?.[0] ?? resolved.color;
  const glow = resolved.glowStrength;
  return {
    "circle-radius": heatmapPointRadius(resolved, 1.05),
    "circle-color": accent,
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      2,
      resolved.opacity * layerOpacity * glow * 0.52,
      fade - 1.5,
      resolved.opacity * layerOpacity * glow * 0.28,
      fade,
      0,
    ],
    "circle-blur": 0.92,
    "circle-stroke-width": 0,
  };
}

export function buildHeatmapDetailGlowPaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity: number,
  chartColors?: string[],
): Record<string, unknown> {
  const metricResolved = { ...resolved, scaleByMetric: true, colorByCategory: false };
  const fade = resolved.heatmapCrossfadeZoom;
  return {
    "circle-radius": buildScatterRadiusExpression(metricResolved, 2.65),
    "circle-color": buildMetricColorExpression(metricResolved, chartColors),
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      fade - 0.5,
      0,
      fade,
      resolved.opacity * layerOpacity * resolved.glowStrength * 0.72,
    ],
    "circle-blur": 0.95,
    "circle-stroke-width": 0,
  };
}

export function buildHeatmapDetailCirclePaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity: number,
  chartColors?: string[],
): Record<string, unknown> {
  const metricResolved = { ...resolved, scaleByMetric: true, colorByCategory: false };
  return {
    "circle-radius": buildScatterRadiusExpression(metricResolved),
    "circle-color": buildMetricColorExpression(metricResolved, chartColors),
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      resolved.heatmapCrossfadeZoom - 0.5,
      0,
      resolved.heatmapCrossfadeZoom,
      Math.min(1, resolved.opacity * layerOpacity * 1.02),
    ],
    "circle-stroke-color": "rgba(255, 255, 255, 0.78)",
    "circle-stroke-width": 0.55,
    "circle-blur": 0.1,
  };
}

export function buildScatterHaloPaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity = 1,
  chartColors?: string[],
): Record<string, unknown> {
  return {
    "circle-radius": buildScatterRadiusExpression(resolved, 3.5),
    "circle-color": buildMetricColorExpression(resolved, chartColors),
    "circle-opacity": emissiveGlowOpacity(resolved, layerOpacity, "halo"),
    "circle-blur": 1,
    "circle-stroke-width": 0,
  };
}

export function buildScatterGlowPaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity = 1,
  chartColors?: string[],
): Record<string, unknown> {
  return {
    "circle-radius": buildScatterRadiusExpression(resolved, 2.35),
    "circle-color": buildMetricColorExpression(resolved, chartColors),
    "circle-opacity": emissiveGlowOpacity(resolved, layerOpacity, "glow"),
    "circle-blur": 0.88,
    "circle-stroke-width": 0,
  };
}

export function buildScatterCorePaint(
  resolved: ResolvedGisOverlayStyle,
  layerOpacity = 1,
  chartColors?: string[],
  _flavor?: GisBasemapFlavor,
): Record<string, unknown> {
  const strokeWidth = resolved.strokeWidth;
  return {
    "circle-radius": buildScatterRadiusExpression(resolved),
    "circle-color": buildMetricColorExpression(resolved, chartColors),
    "circle-opacity": buildScatterOpacityExpression(resolved, layerOpacity),
    "circle-stroke-color": resolved.strokeColor,
    "circle-stroke-width": strokeWidth,
    "circle-stroke-opacity": strokeWidth > 0 ? 0.92 : 0,
    "circle-blur": resolved.circleBlur,
  };
}

function buildClusterRadiusStep(
  resolved: ResolvedGisOverlayStyle,
  outputs: { default: number; at10: number; at50: number; at200: number },
): ExpressionSpecification {
  return [
    "step",
    ["get", "point_count"],
    outputs.default,
    10,
    outputs.at10,
    50,
    outputs.at50,
    200,
    outputs.at200,
  ];
}

function clusterRadiusOutputs(resolved: ResolvedGisOverlayStyle) {
  const rMin = resolved.radiusMin;
  const rMid = rMin + (resolved.radiusMax - rMin) * 0.45;
  const rMax = resolved.radiusMax;
  return {
    default: rMin,
    at10: rMin,
    at50: rMid,
    at200: rMax,
  };
}

export function buildClusterHaloPaint(
  resolved: ResolvedGisOverlayStyle,
  chartColors?: string[],
): Record<string, unknown> {
  const accent = chartColors?.[0] ?? resolved.color;
  const warm = chartColors?.[2] ?? "#fbbf24";
  return {
    "circle-color": [
      "interpolate",
      ["linear"],
      ["get", "point_count"],
      2,
      accent,
      40,
      warm,
    ],
    "circle-radius": buildClusterRadiusStep(resolved, {
      default: 26,
      at10: 32,
      at50: 40,
      at200: 48,
    }),
    "circle-opacity": resolved.opacity * resolved.glowStrength * 0.38,
    "circle-blur": 1,
    "circle-stroke-width": 0,
  };
}

export function buildClusterGlowPaint(
  resolved: ResolvedGisOverlayStyle,
  chartColors?: string[],
): Record<string, unknown> {
  const accent = chartColors?.[1] ?? chartColors?.[0] ?? resolved.color;
  const warm = chartColors?.[2] ?? "#fde047";
  return {
    "circle-color": [
      "interpolate",
      ["linear"],
      ["get", "point_count"],
      2,
      accent,
      40,
      warm,
    ],
    "circle-radius": buildClusterRadiusStep(resolved, {
      default: 18,
      at10: 22,
      at50: 28,
      at200: 34,
    }),
    "circle-opacity": resolved.opacity * resolved.glowStrength * 0.58,
    "circle-blur": 0.82,
    "circle-stroke-width": 0,
  };
}

export function buildClusterCirclePaint(
  resolved: ResolvedGisOverlayStyle,
  chartColors?: string[],
): Record<string, unknown> {
  const accent = chartColors?.[0] ?? resolved.color;
  const warm = chartColors?.[2] ?? "#fbbf24";
  const hot = chartColors?.[3] ?? "#fb7185";
  const strokeWidth = resolved.strokeWidth;
  const radius = clusterRadiusOutputs(resolved);
  return {
    "circle-color": [
      "interpolate",
      ["linear"],
      ["get", "point_count"],
      2,
      accent,
      24,
      warm,
      100,
      hot,
    ],
    "circle-opacity": Math.min(1, resolved.opacity * 0.72),
    "circle-stroke-color": resolved.strokeColor,
    "circle-stroke-width": strokeWidth > 0 ? strokeWidth : 0,
    "circle-stroke-opacity": strokeWidth > 0 ? 0.88 : 0,
    "circle-blur": resolved.circleBlur,
    "circle-radius": buildClusterRadiusStep(resolved, radius),
  };
}

export function buildClusterCountLayout(): Record<string, unknown> {
  return {
    "text-field": ["get", "point_count_abbreviated"],
    "text-size": ["step", ["get", "point_count"], 11, 20, 12, 100, 13],
    "text-allow-overlap": true,
    "text-font": ["Noto Sans Bold"],
  };
}

export function buildClusterCountPaint(_chartColors?: string[]): Record<string, unknown> {
  return {
    "text-color": "#ffffff",
    "text-opacity": 0.98,
  };
}

export function gisLayerHeatmapDetailId(layerId: string): string {
  return `vs-gis-layer-${layerId}-heat-points`;
}

export function gisLayerHeatmapDetailGlowId(layerId: string): string {
  return `vs-gis-layer-${layerId}-heat-detail-glow`;
}

export function gisLayerHeatmapHaloId(layerId: string): string {
  return `vs-gis-layer-${layerId}-heat-halo`;
}

export function gisLayerHeatmapGlowId(layerId: string): string {
  return `vs-gis-layer-${layerId}-heat-glow`;
}

export function gisLayerScatterHaloId(layerId: string): string {
  return `vs-gis-layer-${layerId}-scatter-halo`;
}

export function gisLayerScatterGlowId(layerId: string): string {
  return `vs-gis-layer-${layerId}-glow`;
}

export function gisLayerClusterGlowId(layerId: string): string {
  return `vs-gis-layer-${layerId}-cluster-glow`;
}

export function gisLayerClusterHaloId(layerId: string): string {
  return `vs-gis-layer-${layerId}-cluster-halo`;
}
