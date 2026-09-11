import type { ChartGeo3dStyle } from "@/lib/chartDeStyle";
import type { Geo3dStylePreset } from "@/components/charts/engine/three/geo3dVisualStyle";
import { resolveGeo3dStylePreset } from "@/components/charts/engine/three/geo3dVisualStyle";

export type PointEffectLayerFlags = {
  heatBlob: boolean;
  pointPillar: boolean;
  floatingLabels: boolean;
};

export type ResolvedPointEffectsStyle = {
  enabled: boolean;
  layers: PointEffectLayerFlags;
  heatBlobOpacity: number;
  heatBlobRadius: number;
  heatBlobBlur: number;
  heatBlobLift: number;
  heatBlobColor: string;
  heatBlobDimChoropleth: number;
  pointPillarColorTop: string;
  pointPillarColorBottom: string;
  pointPillarOpacity: number;
  pointPillarHeightScale: number;
  pointPillarBaseRingOpacity: number;
  pointPillarBaseRingScale: number;
  pointPillarRingSpeed: number;
  floatingLabelFontSize: number;
  floatingLabelTextColor: string;
  floatingLabelBgColor: string;
  floatingLabelBorderColor: string;
  floatingLabelOffset: number;
};

export const DEFAULT_HEAT_BLOB_OPACITY = 1;
export const DEFAULT_HEAT_BLOB_RADIUS = 15;
export const MIN_HEAT_BLOB_RADIUS = 3;
export const MAX_HEAT_BLOB_RADIUS = 40;
export const DEFAULT_HEAT_BLOB_BLUR = 1.2;
export const DEFAULT_HEAT_BLOB_LIFT = 8;
export const DEFAULT_HEAT_BLOB_COLOR = "#ffffff";
export const DEFAULT_HEAT_BLOB_DIM_CHOROPLETH = 0.55;

export const DEFAULT_POINT_PILLAR_COLOR_TOP = "#fbdf88";
export const DEFAULT_POINT_PILLAR_COLOR_BOTTOM = "#ea580c";
export const DEFAULT_POINT_PILLAR_OPACITY = 1;
export const DEFAULT_POINT_PILLAR_HEIGHT_SCALE = 3.8;
export const DEFAULT_POINT_PILLAR_BASE_RING_OPACITY = 0.6;
export const DEFAULT_POINT_PILLAR_BASE_RING_SCALE = 0.6;
export const DEFAULT_POINT_PILLAR_RING_SPEED = 0.9;

export const DEFAULT_FLOATING_LABEL_FONT_SIZE = 13;
export const DEFAULT_FLOATING_LABEL_TEXT_COLOR = "#fdb961";
export const DEFAULT_FLOATING_LABEL_BG_COLOR = "#ffffff";
export const DEFAULT_FLOATING_LABEL_BORDER_COLOR = "#fdb961";
export const DEFAULT_FLOATING_LABEL_OFFSET = 0.05;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clamp01(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || !HEX_COLOR.test(trimmed)) return fallback;
  return trimmed.toLowerCase();
}

function presetPointEffectsEnabled(_preset: Geo3dStylePreset): boolean {
  return true;
}

function presetPillarBottom(_preset: Geo3dStylePreset, _isDark: boolean): string {
  return DEFAULT_POINT_PILLAR_COLOR_BOTTOM;
}

export function resolveGeo3dPointEffects(style: ChartGeo3dStyle): boolean {
  const preset = resolveGeo3dStylePreset(style);
  return style.pointEffects ?? presetPointEffectsEnabled(preset);
}

export function resolvePointEffectsStyle(
  style: ChartGeo3dStyle,
  preset: Geo3dStylePreset,
  isDark: boolean,
  masterEnabled: boolean,
): ResolvedPointEffectsStyle {
  const enabled = masterEnabled && resolveGeo3dPointEffects(style);
  const layers: PointEffectLayerFlags = {
    heatBlob: enabled && style.heatBlob !== false,
    pointPillar: enabled && style.pointPillar !== false,
    floatingLabels: enabled && style.floatingLabels !== false,
  };
  return {
    enabled,
    layers,
    heatBlobOpacity: clamp01(style.heatBlobOpacity, DEFAULT_HEAT_BLOB_OPACITY),
    heatBlobRadius: clampRange(
      style.heatBlobRadius,
      DEFAULT_HEAT_BLOB_RADIUS,
      MIN_HEAT_BLOB_RADIUS,
      MAX_HEAT_BLOB_RADIUS,
    ),
    heatBlobBlur: clampRange(style.heatBlobBlur, DEFAULT_HEAT_BLOB_BLUR, 0.5, 2),
    heatBlobLift: clampRange(style.heatBlobLift, DEFAULT_HEAT_BLOB_LIFT, 0, 12),
    heatBlobColor: normalizeHex(style.heatBlobColor, DEFAULT_HEAT_BLOB_COLOR),
    heatBlobDimChoropleth: clamp01(style.heatBlobDimChoropleth, DEFAULT_HEAT_BLOB_DIM_CHOROPLETH),
    pointPillarColorTop: normalizeHex(style.pointPillarColorTop, DEFAULT_POINT_PILLAR_COLOR_TOP),
    pointPillarColorBottom: normalizeHex(
      style.pointPillarColorBottom,
      presetPillarBottom(preset, isDark),
    ),
    pointPillarOpacity: clamp01(style.pointPillarOpacity, DEFAULT_POINT_PILLAR_OPACITY),
    pointPillarHeightScale: clampRange(
      style.pointPillarHeightScale,
      DEFAULT_POINT_PILLAR_HEIGHT_SCALE,
      1,
      12,
    ),
    pointPillarBaseRingOpacity: clamp01(
      style.pointPillarBaseRingOpacity,
      DEFAULT_POINT_PILLAR_BASE_RING_OPACITY,
    ),
    pointPillarBaseRingScale: clampRange(
      style.pointPillarBaseRingScale,
      DEFAULT_POINT_PILLAR_BASE_RING_SCALE,
      0.3,
      2.5,
    ),
    pointPillarRingSpeed: clampRange(style.pointPillarRingSpeed, DEFAULT_POINT_PILLAR_RING_SPEED, 0.2, 3),
    floatingLabelFontSize: clampRange(
      style.floatingLabelFontSize,
      DEFAULT_FLOATING_LABEL_FONT_SIZE,
      10,
      22,
    ),
    floatingLabelTextColor: normalizeHex(
      style.floatingLabelTextColor,
      DEFAULT_FLOATING_LABEL_TEXT_COLOR,
    ),
    floatingLabelBgColor: normalizeHex(
      style.floatingLabelBgColor,
      DEFAULT_FLOATING_LABEL_BG_COLOR,
    ),
    floatingLabelBorderColor: normalizeHex(
      style.floatingLabelBorderColor,
      DEFAULT_FLOATING_LABEL_BORDER_COLOR,
    ),
    floatingLabelOffset: clampRange(style.floatingLabelOffset, DEFAULT_FLOATING_LABEL_OFFSET, 0, 2),
  };
}

function resolvePointEffectsSigStyle(
  style: ChartGeo3dStyle,
  masterEnabled: boolean,
): ResolvedPointEffectsStyle {
  return resolvePointEffectsStyle(
    style,
    resolveGeo3dStylePreset(style),
    true,
    masterEnabled,
  );
}

export function buildPointEffectsStructureSig(
  style: ChartGeo3dStyle,
  masterEnabled: boolean,
): string {
  const resolved = resolvePointEffectsSigStyle(style, masterEnabled);
  if (!resolved.enabled) return "off";
  return [
    resolved.layers.heatBlob ? 1 : 0,
    resolved.heatBlobRadius,
    resolved.heatBlobBlur,
    resolved.heatBlobLift,
    resolved.layers.pointPillar ? 1 : 0,
    resolved.pointPillarHeightScale,
    resolved.pointPillarBaseRingScale,
    resolved.layers.floatingLabels ? 1 : 0,
    resolved.floatingLabelOffset,
  ].join("|");
}

export function buildPointEffectsVisualSig(
  style: ChartGeo3dStyle,
  masterEnabled: boolean,
): string {
  const resolved = resolvePointEffectsSigStyle(style, masterEnabled);
  if (!resolved.enabled) return "off";
  return [
    resolved.heatBlobOpacity,
    resolved.heatBlobColor,
    resolved.heatBlobDimChoropleth,
    resolved.pointPillarColorTop,
    resolved.pointPillarColorBottom,
    resolved.pointPillarOpacity,
    resolved.pointPillarBaseRingOpacity,
    resolved.pointPillarRingSpeed,
    resolved.floatingLabelFontSize,
    resolved.floatingLabelTextColor,
    resolved.floatingLabelBgColor,
    resolved.floatingLabelBorderColor,
  ].join("|");
}

/** @deprecated 使用 structure + visual 拆分签名 */
export function buildPointEffectsContentSig(
  style: ChartGeo3dStyle,
  masterEnabled: boolean,
): string {
  return `${buildPointEffectsStructureSig(style, masterEnabled)}|${buildPointEffectsVisualSig(style, masterEnabled)}`;
}

export function hasCustomPointPillarColorTop(style: ChartGeo3dStyle): boolean {
  const v = style.pointPillarColorTop?.trim();
  return Boolean(v && HEX_COLOR.test(v));
}

export function hasCustomPointPillarColorBottom(style: ChartGeo3dStyle): boolean {
  const v = style.pointPillarColorBottom?.trim();
  return Boolean(v && HEX_COLOR.test(v));
}

export function hasCustomHeatBlobColor(style: ChartGeo3dStyle): boolean {
  const v = style.heatBlobColor?.trim();
  return Boolean(v && HEX_COLOR.test(v));
}

export function hasCustomFloatingLabelTextColor(style: ChartGeo3dStyle): boolean {
  const v = style.floatingLabelTextColor?.trim();
  return Boolean(v && HEX_COLOR.test(v));
}

export function hasCustomFloatingLabelBgColor(style: ChartGeo3dStyle): boolean {
  const v = style.floatingLabelBgColor?.trim();
  return Boolean(v && HEX_COLOR.test(v));
}

export function hasCustomFloatingLabelBorderColor(style: ChartGeo3dStyle): boolean {
  const v = style.floatingLabelBorderColor?.trim();
  return Boolean(v && HEX_COLOR.test(v));
}
