const LNG_PATTERN = /(?:^|_)(lng|lon|longitude|经度|x_coord)(?:$|_)/i;
const LAT_PATTERN = /(?:^|_)(lat|latitude|纬度|y_coord)(?:$|_)/i;
const GEO_NAME_PATTERN =
  /(?:^|_)(region|province|city|district|area|country|state|county|name|地区|省份|城市|区县|国家)(?:$|_)/i;

function hasCoordColumns(columns: string[]): boolean {
  return columns.some((c) => LNG_PATTERN.test(c) || LAT_PATTERN.test(c));
}

function hasGeoNameColumns(columns: string[]): boolean {
  return columns.some((c) => GEO_NAME_PATTERN.test(c));
}

/** 数据集列名 → 区域地图 vs GIS 散点选型提示 */
export function resolveMapChartTypeGuide(columns: string[]): string | null {
  if (columns.length === 0) return null;
  const coords = hasCoordColumns(columns);
  const geoNames = hasGeoNameColumns(columns);
  if (coords && !geoNames) {
    return "数据集含经纬度列，更适合「GIS 地图」散点叠加；按省/市着色请用「区域地图」。";
  }
  if (geoNames && !coords) {
    return "数据集是省/市/区县等地区字段，更适合「区域地图」；有数值 lng/lat 时再用「GIS 地图」。";
  }
  return null;
}
