import type { ChartGeoStyle } from "@/lib/chartDeStyle";
import { geoSurfaceColors } from "@/components/charts/engine/geo/geoSurfaceColors";

function isValidHex(color?: string): color is string {
  return Boolean(color && /^#[0-9a-fA-F]{6}$/.test(color));
}

export function hasCustomGeoRegionFillColor(geo: ChartGeoStyle = {}): boolean {
  return isValidHex(geo.regionFillColor?.trim());
}

export function resolveGeoRegionFillColorHex(geo: ChartGeoStyle, isDark: boolean): string {
  const custom = geo.regionFillColor?.trim();
  if (isValidHex(custom)) return custom.toLowerCase();
  return geoSurfaceColors(isDark).emptyFill;
}

/** 2D 地图样式签名：变更须触发 D3GeoMapView 全量重建（无 2D patch 路径） */
export function buildGeoMapStyleContentSig(
  geo: ChartGeoStyle = {},
  extras: {
    paletteOpacity?: number;
    paletteId?: string;
    paletteColors?: readonly string[];
    /** 已解析的图表配色（继承看板时含看板自定义色） */
    chartColors?: readonly string[];
  } = {},
): string {
  return [
    geo.roam !== false ? 1 : 0,
    geo.showRegionLabel === true ? 1 : 0,
    geo.visualMap !== false ? 1 : 0,
    geo.showRegionBorder !== false ? 1 : 0,
    geo.regionBorderColor?.toLowerCase() ?? "",
    geo.regionFillColor?.toLowerCase() ?? "",
    geo.regionBorderWidth ?? "",
    geo.regionLabelColor?.toLowerCase() ?? "",
    geo.regionLabelFontSize ?? "",
    geo.showZoomControl ? 1 : 0,
    geo.bubbleEffect ? 1 : 0,
    geo.bubbleEffectType ?? "",
    geo.bubbleEffectSpeed ?? "",
    geo.bubbleEffectRingCount ?? "",
    geo.bubbleEffectColor?.toLowerCase() ?? "",
    extras.paletteOpacity ?? "",
    extras.paletteId ?? "",
    extras.paletteColors?.join(",") ?? "",
    extras.chartColors?.join(",") ?? "",
  ].join("|");
}
