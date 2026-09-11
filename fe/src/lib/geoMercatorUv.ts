/** Web Mercator 归一化 UV，与 fe/scripts/lib/satelliteTileStitch.mjs lngLatToTileFloat 一致（zoom 无关） */

export type GeoMercatorBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** 0–1 归一化 Mercator Y；北纬越大 y 越小（与瓦片行号同向） */
export function mercatorNormalizedY(lat: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * 卫星纹理 cap UV：u 线性经度；v 按 Mercator Y 归一化（north→v=0，配合 Texture flipY 默认 true）。
 * 构建期 Mercator 瓦片语义；运行时卫星走 projBounds 烘焙 + applyGeoCapBboxUv。
 */
export function lngLatToMercatorCapUv(
  lng: number,
  lat: number,
  bounds: GeoMercatorBounds,
): [number, number] {
  const lngSpan = bounds.east - bounds.west || 1;
  const yNorth = mercatorNormalizedY(bounds.north);
  const ySouth = mercatorNormalizedY(bounds.south);
  const ySpan = ySouth - yNorth || 1;
  const u = clamp01((lng - bounds.west) / lngSpan);
  const v = clamp01((mercatorNormalizedY(lat) - yNorth) / ySpan);
  return [u, v];
}

/** 线性纬度 UV（Plate Carrée），仅用于对比/回归 */
export function lngLatToLinearLatCapUv(
  lng: number,
  lat: number,
  bounds: GeoMercatorBounds,
): [number, number] {
  const lngSpan = bounds.east - bounds.west || 1;
  const latSpan = bounds.north - bounds.south || 1;
  const u = clamp01((lng - bounds.west) / lngSpan);
  const v = clamp01(1 - (lat - bounds.south) / latSpan);
  return [u, v];
}
