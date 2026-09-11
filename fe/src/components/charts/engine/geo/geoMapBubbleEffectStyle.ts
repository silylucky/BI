import type { ChartGeoStyle } from "@/lib/chartDeStyle";

export const DEFAULT_GEO_MAP_BUBBLE_SPEED = 1.1;
export const DEFAULT_GEO_MAP_BUBBLE_RING_COUNT = 4;
export const MIN_GEO_MAP_BUBBLE_SPEED = 0.2;
export const MAX_GEO_MAP_BUBBLE_SPEED = 3;
export const MIN_GEO_MAP_BUBBLE_RING_COUNT = 1;
export const MAX_GEO_MAP_BUBBLE_RING_COUNT = 8;
export const BASE_GEO_MAP_BUBBLE_DURATION_MS = 2200;
export const DEFAULT_GEO_MAP_BUBBLE_COLOR = "#fbbf24";

export type ResolvedGeoMapBubbleEffect = {
  enabled: boolean;
  type: "ripple";
  speed: number;
  ringCount: number;
  durationMs: number;
  color: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isValidHex(color?: string): color is string {
  return Boolean(color && /^#[0-9a-fA-F]{6}$/.test(color));
}

export function hasCustomGeoMapBubbleEffectColor(geo: ChartGeoStyle = {}): boolean {
  return isValidHex(geo.bubbleEffectColor?.trim());
}

export function resolveGeoMapBubbleEffectPanelColor(
  geo: ChartGeoStyle = {},
  options: { accentColor?: string } = {},
): string {
  return resolveGeoMapBubbleEffect({ ...geo, bubbleEffect: true }, options).color;
}

export function resolveGeoMapBubbleEffect(
  geo: ChartGeoStyle = {},
  options: { accentColor?: string } = {},
): ResolvedGeoMapBubbleEffect {
  const speed = clamp(
    geo.bubbleEffectSpeed ?? DEFAULT_GEO_MAP_BUBBLE_SPEED,
    MIN_GEO_MAP_BUBBLE_SPEED,
    MAX_GEO_MAP_BUBBLE_SPEED,
  );
  const ringCount = Math.round(
    clamp(
      geo.bubbleEffectRingCount ?? DEFAULT_GEO_MAP_BUBBLE_RING_COUNT,
      MIN_GEO_MAP_BUBBLE_RING_COUNT,
      MAX_GEO_MAP_BUBBLE_RING_COUNT,
    ),
  );
  const custom = geo.bubbleEffectColor?.trim();
  const accent = options.accentColor?.trim();
  const color = isValidHex(custom)
    ? custom.toLowerCase()
    : isValidHex(accent)
      ? accent.toLowerCase()
      : DEFAULT_GEO_MAP_BUBBLE_COLOR;

  return {
    enabled: geo.bubbleEffect === true,
    type: "ripple",
    speed,
    ringCount,
    durationMs: Math.round(BASE_GEO_MAP_BUBBLE_DURATION_MS / speed),
    color,
  };
}
