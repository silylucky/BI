import type { GlobeLimbBounds } from "@/components/charts/engine/maplibre/gisGlobeLayout";
import {
  GIS_HALO_STOP_SHAPE,
  parseEffectsHex,
  rgbaEffects,
  shadeEffectsRgb,
  type ResolvedGisEffectsSettings,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsSettings";

/**
 * GeoLibre maplibre-effects.ts drawHalo：HALO_STOP_SHAPE + screen 混合 + arc 绘制。
 * @see vendor/geolibre/packages/plugins/src/plugins/maplibre-effects.ts
 */
export function drawGlobeAtmosphereHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  limb: GlobeLimbBounds,
  effects: ResolvedGisEffectsSettings,
) {
  const { x: cx, y: cy, radius: globeRadius } = limb;
  const { haloExtent, haloOpacity, haloColor } = effects;
  ctx.clearRect(0, 0, width, height);
  if (globeRadius < 5 || haloOpacity <= 0 || haloExtent <= 1) return;

  const base = parseEffectsHex(haloColor);
  const outerRadius = globeRadius * haloExtent;
  ctx.save();
  const gradient = ctx.createRadialGradient(cx, cy, globeRadius, cx, cy, outerRadius);
  for (const [stop, alpha, shade] of GIS_HALO_STOP_SHAPE) {
    gradient.addColorStop(stop, rgbaEffects(shadeEffectsRgb(base, shade), alpha * haloOpacity));
  }
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
