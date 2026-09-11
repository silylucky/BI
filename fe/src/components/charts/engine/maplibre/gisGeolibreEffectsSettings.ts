/** 对齐 vendor/geolibre maplibre-effects.ts EffectsSettings（只读移植）。 */

export type GisEffectsSettings = {
  enabled?: boolean;
  haloColor?: string;
  haloExtent?: number;
  haloOpacity?: number;
  spaceColor?: string;
};

export type ResolvedGisEffectsSettings = {
  enabled: boolean;
  haloColor: string;
  haloExtent: number;
  haloOpacity: number;
  spaceColor: string;
};

export const DEFAULT_GIS_EFFECTS_SETTINGS: ResolvedGisEffectsSettings = {
  enabled: true,
  haloColor: "#4d9fe6",
  haloExtent: 2.8,
  haloOpacity: 1,
  spaceColor: "#000000",
};

export const GIS_HALO_EXTENT_MIN = 1.05;
export const GIS_HALO_EXTENT_MAX = 4;
export const GIS_HALO_OPACITY_MIN = 0;
export const GIS_HALO_OPACITY_MAX = 1;
export const GIS_SPACE_EDGE_DARKEN = 0.33;
export const GIS_EFFECTS_FRAME_MS = 1000 / 60;

export function nextGisEffectsFrameTime(timestamp: number, lastFrameTime: number): number | null {
  return timestamp - lastFrameTime + 0.1 < GIS_EFFECTS_FRAME_MS ? null : timestamp;
}

/** GeoLibre HALO_STOP_SHAPE — [offset, alpha, shade] */
export const GIS_HALO_STOP_SHAPE: Array<[number, number, number]> = [
  [0.0, 1.0, 0.7],
  [0.03, 0.6, 0.32],
  [0.08, 0.35, 0.0],
  [0.18, 0.15, -0.2],
  [0.35, 0.06, -0.4],
  [0.6, 0.02, -0.55],
  [1.0, 0.0, -0.7],
];

type Rgb = { r: number; g: number; b: number };

export function parseEffectsHex(hex: string, fallback: Rgb = { r: 77, g: 159, b: 230 }): Rgb {
  const value = hex.trim().replace(/^#/, "");
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return fallback;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

export function shadeEffectsRgb({ r, g, b }: Rgb, shade: number): Rgb {
  const target = shade >= 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(shade));
  return {
    r: Math.round(r + (target - r) * t),
    g: Math.round(g + (target - g) * t),
    b: Math.round(b + (target - b) * t),
  };
}

export function rgbaEffects({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value.trim());
}

function withHash(value: string): string {
  const hex = value.trim().toLowerCase();
  return hex.startsWith("#") ? hex : `#${hex}`;
}

export function normalizeGisEffectsSettings(
  value: unknown,
  base: ResolvedGisEffectsSettings = DEFAULT_GIS_EFFECTS_SETTINGS,
): ResolvedGisEffectsSettings {
  const candidate = (value ?? {}) as GisEffectsSettings;
  return {
    enabled: candidate.enabled !== false,
    haloColor: isHex(candidate.haloColor) ? withHash(candidate.haloColor) : base.haloColor,
    haloExtent: clampNumber(
      candidate.haloExtent,
      GIS_HALO_EXTENT_MIN,
      GIS_HALO_EXTENT_MAX,
      base.haloExtent,
    ),
    haloOpacity: clampNumber(
      candidate.haloOpacity,
      GIS_HALO_OPACITY_MIN,
      GIS_HALO_OPACITY_MAX,
      base.haloOpacity,
    ),
    spaceColor: isHex(candidate.spaceColor) ? withHash(candidate.spaceColor) : base.spaceColor,
  };
}

export function spaceBackdropCss(spaceColor: string): string {
  const center = parseEffectsHex(spaceColor, { r: 12, g: 27, b: 51 });
  const edge = shadeEffectsRgb(center, -GIS_SPACE_EDGE_DARKEN);
  return `radial-gradient(ellipse at center, ${rgbaEffects(center, 1)} 0%, ${rgbaEffects(edge, 1)} 100%)`;
}
