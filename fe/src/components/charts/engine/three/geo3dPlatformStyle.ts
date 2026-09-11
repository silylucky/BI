import type { ChartGeo3dStyle } from "@/lib/chartDeStyle";
import type { Geo3dStylePreset } from "@/components/charts/engine/three/geo3dVisualStyle";
import { resolveGeo3dStylePreset } from "@/components/charts/engine/three/geo3dVisualStyle";

export type PlatformLayerFlags = {
  highlight: boolean;
  rings: boolean;
  grid: boolean;
  ripple: boolean;
  glow: boolean;
  pulse: boolean;
  sweep: boolean;
};

export type PlatformAccentColors = {
  highlight: string;
  grid: string;
  ripple: string;
  glow: string;
  pulse: string;
  sweep: string;
};

export type PlatformGridStyle = "texture" | "square";

export type ResolvedPlatformEffectsStyle = {
  layers: PlatformLayerFlags;
  colors: PlatformAccentColors;
  highlightOpacity: number;
  ringOpacity: readonly [number, number];
  gridOpacity: number;
  rippleOpacity: number;
  glowOpacity: number;
  pulseOpacity: number;
  sweepOpacity: number;
  sizeScale: number;
  gridStyle: PlatformGridStyle;
  gridDensity: number;
  rippleSpeed: number;
  rippleFrequency: number;
  ringSpeed: number;
  pulseSpeed: number;
  sweepSpeed: number;
};

export const DEFAULT_PLATFORM_HIGHLIGHT_OPACITY = 0.7;
export const DEFAULT_PLATFORM_RING_OPACITY = 0.7;
export const DEFAULT_PLATFORM_GRID_OPACITY = 0.1;
export const DEFAULT_PLATFORM_RIPPLE_OPACITY = 0.85;
export const DEFAULT_PLATFORM_GLOW_OPACITY = 0.55;
export const DEFAULT_PLATFORM_PULSE_OPACITY = 0.65;
export const DEFAULT_PLATFORM_SWEEP_OPACITY = 0.45;
export const DEFAULT_PLATFORM_SIZE_SCALE = 1.35;
export const DEFAULT_PLATFORM_GRID_DENSITY = 1.25;
export const DEFAULT_PLATFORM_RIPPLE_SPEED = 0.7;
export const DEFAULT_PLATFORM_RIPPLE_FREQUENCY = 1;
export const DEFAULT_PLATFORM_RING_SPEED = 2.5;
export const DEFAULT_PLATFORM_PULSE_SPEED = 1;
export const DEFAULT_PLATFORM_SWEEP_SPEED = 1;
export const DEFAULT_PLATFORM_SQUARE_GRID_CELLS = 160;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function clamp01(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function clampSizeScale(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PLATFORM_SIZE_SCALE;
  return Math.min(1.6, Math.max(0.4, value));
}

function clampGridDensity(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PLATFORM_GRID_DENSITY;
  return Math.min(3, Math.max(0.5, value));
}

function clampRippleSpeed(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PLATFORM_RIPPLE_SPEED;
  return Math.min(3, Math.max(0.2, value));
}

function clampEffectSpeed(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(3, Math.max(0.2, value));
}

function clampRippleFrequency(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PLATFORM_RIPPLE_FREQUENCY;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function resolvePlatformGridStyle(style: ChartGeo3dStyle): PlatformGridStyle {
  return style.platformGridStyle === "square" ? "square" : "texture";
}

function normalizeHex(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !HEX_COLOR.test(trimmed)) return undefined;
  return trimmed.toLowerCase();
}

function paletteForMapPreset(preset: Geo3dStylePreset, isDark: boolean): PlatformAccentColors {
  if (preset === "classic") {
    return {
      highlight: "#fbdf88",
      grid: "#fbdf88",
      ripple: "#ea580c",
      glow: "#fbbf24",
      pulse: "#f97316",
      sweep: "#fcd34d",
    };
  }
  if (preset === "tech") {
    return isDark
      ? {
          highlight: "#7dd3fc",
          grid: "#38bdf8",
          ripple: "#0ea5e9",
          glow: "#22d3ee",
          pulse: "#38bdf8",
          sweep: "#a78bfa",
        }
      : {
          highlight: "#bae6fd",
          grid: "#38bdf8",
          ripple: "#0284c7",
          glow: "#67e8f9",
          pulse: "#0ea5e9",
          sweep: "#818cf8",
        };
  }
  if (preset === "minimal") {
    return isDark
      ? {
          highlight: "#64748b",
          grid: "#475569",
          ripple: "#94a3b8",
          glow: "#94a3b8",
          pulse: "#64748b",
          sweep: "#cbd5e1",
        }
      : {
          highlight: "#cbd5e1",
          grid: "#94a3b8",
          ripple: "#64748b",
          glow: "#e2e8f0",
          pulse: "#94a3b8",
          sweep: "#cbd5e1",
        };
  }
  if (preset === "glass") {
    return isDark
      ? {
          highlight: "#67e8f9",
          grid: "#22d3ee",
          ripple: "#06b6d4",
          glow: "#22d3ee",
          pulse: "#38bdf8",
          sweep: "#a5f3fc",
        }
      : {
          highlight: "#bae6fd",
          grid: "#38bdf8",
          ripple: "#0284c7",
          glow: "#67e8f9",
          pulse: "#0ea5e9",
          sweep: "#7dd3fc",
        };
  }
  if (preset === "glass-warm") {
    return {
      highlight: "#fcd34d",
      grid: "#fbbf24",
      ripple: "#f97316",
      glow: "#fb923c",
      pulse: "#ea580c",
      sweep: "#fde68a",
    };
  }
  if (preset === "glass-night") {
    return {
      highlight: "#93c5fd",
      grid: "#60a5fa",
      ripple: "#3b82f6",
      glow: "#818cf8",
      pulse: "#6366f1",
      sweep: "#c4b5fd",
    };
  }
  return isDark
    ? {
        highlight: "#93c5fd",
        grid: "#60a5fa",
        ripple: "#3b82f6",
        glow: "#60a5fa",
        pulse: "#38bdf8",
        sweep: "#c084fc",
      }
    : {
        highlight: "#dbeafe",
        grid: "#60a5fa",
        ripple: "#2563eb",
        glow: "#93c5fd",
        pulse: "#3b82f6",
        sweep: "#a78bfa",
      };
}

export function resolvePlatformLayerFlags(style: ChartGeo3dStyle, effectsOn: boolean): PlatformLayerFlags {
  if (!effectsOn) {
    return {
      highlight: false,
      rings: false,
      grid: false,
      ripple: false,
      glow: false,
      pulse: false,
      sweep: false,
    };
  }
  return {
    highlight: style.platformHighlight !== false,
    rings: style.platformRings !== false,
    grid: style.platformGrid !== false,
    ripple: style.platformRipple !== false,
    glow: style.platformGlow === true,
    pulse: style.platformPulse === true,
    sweep: style.platformSweep === true,
  };
}

export function resolvePlatformAccentColors(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset,
  isDark: boolean,
): PlatformAccentColors {
  const preset = resolveGeo3dStylePreset(style);
  const defaults = paletteForMapPreset(mapPreset || preset, isDark);
  return {
    highlight: normalizeHex(style.platformHighlightColor) ?? defaults.highlight,
    grid: normalizeHex(style.platformGridColor) ?? defaults.grid,
    ripple: normalizeHex(style.platformRippleColor) ?? defaults.ripple,
    glow: normalizeHex(style.platformGlowColor) ?? defaults.glow,
    pulse: normalizeHex(style.platformPulseColor) ?? defaults.pulse,
    sweep: normalizeHex(style.platformSweepColor) ?? defaults.sweep,
  };
}

export function resolvePlatformHighlightColorHex(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset | undefined,
  isDark: boolean,
): string {
  return resolvePlatformAccentColors(style, mapPreset ?? resolveGeo3dStylePreset(style), isDark)
    .highlight;
}

export function resolvePlatformGridColorHex(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset | undefined,
  isDark: boolean,
): string {
  return resolvePlatformAccentColors(style, mapPreset ?? resolveGeo3dStylePreset(style), isDark).grid;
}

export function resolvePlatformRippleColorHex(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset | undefined,
  isDark: boolean,
): string {
  return resolvePlatformAccentColors(style, mapPreset ?? resolveGeo3dStylePreset(style), isDark)
    .ripple;
}

export function resolvePlatformGlowColorHex(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset | undefined,
  isDark: boolean,
): string {
  return resolvePlatformAccentColors(style, mapPreset ?? resolveGeo3dStylePreset(style), isDark).glow;
}

export function resolvePlatformPulseColorHex(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset | undefined,
  isDark: boolean,
): string {
  return resolvePlatformAccentColors(style, mapPreset ?? resolveGeo3dStylePreset(style), isDark)
    .pulse;
}

export function resolvePlatformSweepColorHex(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset | undefined,
  isDark: boolean,
): string {
  return resolvePlatformAccentColors(style, mapPreset ?? resolveGeo3dStylePreset(style), isDark)
    .sweep;
}

export function hasCustomPlatformHighlightColor(style: ChartGeo3dStyle): boolean {
  return Boolean(normalizeHex(style.platformHighlightColor));
}

export function hasCustomPlatformGridColor(style: ChartGeo3dStyle): boolean {
  return Boolean(normalizeHex(style.platformGridColor));
}

export function hasCustomPlatformRippleColor(style: ChartGeo3dStyle): boolean {
  return Boolean(normalizeHex(style.platformRippleColor));
}

export function hasCustomPlatformGlowColor(style: ChartGeo3dStyle): boolean {
  return Boolean(normalizeHex(style.platformGlowColor));
}

export function hasCustomPlatformPulseColor(style: ChartGeo3dStyle): boolean {
  return Boolean(normalizeHex(style.platformPulseColor));
}

export function hasCustomPlatformSweepColor(style: ChartGeo3dStyle): boolean {
  return Boolean(normalizeHex(style.platformSweepColor));
}

export function resolvePlatformEffectsStyle(
  style: ChartGeo3dStyle,
  mapPreset: Geo3dStylePreset,
  isDark: boolean,
  effectsOn: boolean,
): ResolvedPlatformEffectsStyle {
  const layers = resolvePlatformLayerFlags(style, effectsOn);
  const ringBase = clamp01(style.platformRingOpacity, DEFAULT_PLATFORM_RING_OPACITY);
  return {
    layers,
    colors: resolvePlatformAccentColors(style, mapPreset, isDark),
    highlightOpacity: clamp01(style.platformHighlightOpacity, DEFAULT_PLATFORM_HIGHLIGHT_OPACITY),
    ringOpacity: [ringBase * 0.67, ringBase * 1.33],
    gridOpacity: clamp01(style.platformGridOpacity, DEFAULT_PLATFORM_GRID_OPACITY),
    rippleOpacity: clamp01(style.platformRippleOpacity, DEFAULT_PLATFORM_RIPPLE_OPACITY),
    glowOpacity: clamp01(style.platformGlowOpacity, DEFAULT_PLATFORM_GLOW_OPACITY),
    pulseOpacity: clamp01(style.platformPulseOpacity, DEFAULT_PLATFORM_PULSE_OPACITY),
    sweepOpacity: clamp01(style.platformSweepOpacity, DEFAULT_PLATFORM_SWEEP_OPACITY),
    sizeScale: clampSizeScale(style.platformSizeScale),
    gridStyle: resolvePlatformGridStyle(style),
    gridDensity: clampGridDensity(style.platformGridDensity),
    rippleSpeed: clampRippleSpeed(style.platformRippleSpeed),
    rippleFrequency: clampRippleFrequency(style.platformRippleFrequency),
    ringSpeed: clampEffectSpeed(style.platformRingSpeed, DEFAULT_PLATFORM_RING_SPEED),
    pulseSpeed: clampEffectSpeed(style.platformPulseSpeed, DEFAULT_PLATFORM_PULSE_SPEED),
    sweepSpeed: clampEffectSpeed(style.platformSweepSpeed, DEFAULT_PLATFORM_SWEEP_SPEED),
  };
}

export function buildPlatformEffectsStructureSig(style: ChartGeo3dStyle, effectsOn: boolean): string {
  const layers = resolvePlatformLayerFlags(style, effectsOn);
  return [
    layers.highlight ? 1 : 0,
    layers.rings ? 1 : 0,
    layers.grid ? 1 : 0,
    layers.ripple ? 1 : 0,
    layers.glow ? 1 : 0,
    layers.pulse ? 1 : 0,
    layers.sweep ? 1 : 0,
    clampSizeScale(style.platformSizeScale),
    resolvePlatformGridStyle(style),
    clampGridDensity(style.platformGridDensity),
    clampRippleFrequency(style.platformRippleFrequency),
  ].join(",");
}

export function buildPlatformEffectsVisualSig(style: ChartGeo3dStyle, effectsOn: boolean): string {
  return [
    normalizeHex(style.platformHighlightColor) ?? "",
    normalizeHex(style.platformGridColor) ?? "",
    normalizeHex(style.platformRippleColor) ?? "",
    normalizeHex(style.platformGlowColor) ?? "",
    normalizeHex(style.platformPulseColor) ?? "",
    normalizeHex(style.platformSweepColor) ?? "",
    clamp01(style.platformHighlightOpacity, DEFAULT_PLATFORM_HIGHLIGHT_OPACITY),
    clamp01(style.platformRingOpacity, DEFAULT_PLATFORM_RING_OPACITY),
    clamp01(style.platformGridOpacity, DEFAULT_PLATFORM_GRID_OPACITY),
    clamp01(style.platformRippleOpacity, DEFAULT_PLATFORM_RIPPLE_OPACITY),
    clamp01(style.platformGlowOpacity, DEFAULT_PLATFORM_GLOW_OPACITY),
    clamp01(style.platformPulseOpacity, DEFAULT_PLATFORM_PULSE_OPACITY),
    clamp01(style.platformSweepOpacity, DEFAULT_PLATFORM_SWEEP_OPACITY),
    clampRippleSpeed(style.platformRippleSpeed),
    clampEffectSpeed(style.platformRingSpeed, DEFAULT_PLATFORM_RING_SPEED),
    clampEffectSpeed(style.platformPulseSpeed, DEFAULT_PLATFORM_PULSE_SPEED),
    clampEffectSpeed(style.platformSweepSpeed, DEFAULT_PLATFORM_SWEEP_SPEED),
  ].join(",");
}

/** @deprecated 使用 structure + visual 拆分签名 */
export function buildPlatformEffectsContentSig(style: ChartGeo3dStyle, effectsOn: boolean): string {
  return `${buildPlatformEffectsStructureSig(style, effectsOn)},${buildPlatformEffectsVisualSig(style, effectsOn)}`;
}
