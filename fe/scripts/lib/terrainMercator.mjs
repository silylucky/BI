/** 与 fe/src/lib/geoMercatorUv.ts 一致，供构建脚本使用 */

export function mercatorNormalizedY(lat) {
  const latRad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
}

export function mercatorNormalizedYToLat(yNorm) {
  const y = Math.PI * (1 - 2 * yNorm);
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}

/** 纹理像素 → 经纬度（北在上，v=0 为北） */
export function pixelToLngLat(px, py, width, height, bounds) {
  const lngSpan = bounds.east - bounds.west || 1;
  const yNorth = mercatorNormalizedY(bounds.north);
  const ySouth = mercatorNormalizedY(bounds.south);
  const ySpan = ySouth - yNorth || 1;
  const u = width <= 1 ? 0 : px / (width - 1);
  const v = height <= 1 ? 0 : py / (height - 1);
  const lng = bounds.west + u * lngSpan;
  const mercY = yNorth + v * ySpan;
  const lat = mercatorNormalizedYToLat(mercY);
  return { lng, lat };
}
