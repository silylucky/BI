import * as THREE from "three";
import type { ChartGeoStyle } from "@/lib/chartDeStyle";
import { geoStrokeWidth, geoSurfaceColors } from "@/components/charts/engine/geo/geoSurfaceColors";
import type { Geo3dStylePreset } from "@/components/charts/engine/three/geo3dVisualStyle";
import { resolvePresetRegionBorderDefaults } from "@/components/charts/engine/three/geo3dVisualStyle";

export type ResolvedGeoRegionBorder = {
  show: boolean;
  colorCss: string;
  colorHex: number;
  opacity: number;
  hoverColorCss: string;
  hoverColorHex: number;
};

const THEME_BORDER_HEX = { dark: "#7dd3fc", light: "#1e40af" } as const;

function isValidHex(color?: string): color is string {
  return Boolean(color && /^#[0-9a-fA-F]{6}$/.test(color));
}

function hexToNumber(hex: string): number {
  return new THREE.Color(hex).getHex();
}

function hexNumberToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function brightenHex(hex: string, amount: number): number {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), amount);
  return c.getHex();
}

/** 当前地图层级下的行政区边界（全国→省界，省级→市界…） */
export function resolveGeoRegionBorderShow(geo: ChartGeoStyle = {}): boolean {
  return geo.showRegionBorder !== false;
}

export const DEFAULT_GEO_REGION_BORDER_WIDTH_SCALE = 1;
export const MIN_GEO_REGION_BORDER_WIDTH_SCALE = 0.5;
export const MAX_GEO_REGION_BORDER_WIDTH_SCALE = 3;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function resolveGeoRegionBorderWidthScale(geo: ChartGeoStyle = {}): number {
  return clamp(
    geo.regionBorderWidth ?? DEFAULT_GEO_REGION_BORDER_WIDTH_SCALE,
    MIN_GEO_REGION_BORDER_WIDTH_SCALE,
    MAX_GEO_REGION_BORDER_WIDTH_SCALE,
  );
}

export function resolveGeoRegionStrokeWidth(geo: ChartGeoStyle, chartWidth: number): number {
  return geoStrokeWidth(chartWidth) * resolveGeoRegionBorderWidthScale(geo);
}

export function hasCustomGeoRegionBorderColor(geo: ChartGeoStyle = {}): boolean {
  return isValidHex(geo.regionBorderColor?.trim());
}

function themeDefaultBorderHex(isDark: boolean): string {
  return isDark ? THEME_BORDER_HEX.dark : THEME_BORDER_HEX.light;
}

/** 面板取色器：自定义色 > 3D 预设默认 > 主题默认 */
export function resolveGeoRegionBorderColorHex(
  geo: ChartGeoStyle,
  isDark: boolean,
  preset?: Geo3dStylePreset,
): string {
  const custom = geo.regionBorderColor?.trim();
  if (isValidHex(custom)) return custom.toLowerCase();
  if (preset) return resolvePresetRegionBorderDefaults(isDark, preset).hex;
  return themeDefaultBorderHex(isDark);
}

export function resolveGeoRegionBorder(
  geo: ChartGeoStyle,
  isDark: boolean,
  options: { preset?: Geo3dStylePreset } = {},
): ResolvedGeoRegionBorder {
  const show = resolveGeoRegionBorderShow(geo);
  const custom = geo.regionBorderColor?.trim();

  if (isValidHex(custom)) {
    const hex = custom.toLowerCase();
    const hoverColorHex = brightenHex(hex, 0.28);
    return {
      show,
      colorCss: hex,
      colorHex: hexToNumber(hex),
      opacity: isDark ? 0.95 : 0.9,
      hoverColorHex,
      hoverColorCss: hexNumberToCss(hoverColorHex),
    };
  }

  if (options.preset) {
    const presetBorder = resolvePresetRegionBorderDefaults(isDark, options.preset);
    const hoverColorHex = brightenHex(presetBorder.hex, 0.18);
    return {
      show,
      colorCss: presetBorder.hex,
      colorHex: hexToNumber(presetBorder.hex),
      opacity: Math.max(presetBorder.opacity, isDark ? 0.88 : 0.8),
      hoverColorHex,
      hoverColorCss: hexNumberToCss(hoverColorHex),
    };
  }

  const surface = geoSurfaceColors(isDark);
  const hex = themeDefaultBorderHex(isDark);
  const hoverColorHex = hexToNumber(
    surface.borderBright.startsWith("#") ? surface.borderBright : themeDefaultBorderHex(isDark),
  );
  return {
    show,
    colorCss: surface.border,
    colorHex: hexToNumber(hex),
    opacity: isDark ? 0.9 : 0.85,
    hoverColorHex,
    hoverColorCss: hexNumberToCss(hoverColorHex),
  };
}

export function buildGeoRegionBorderContentSig(geo: ChartGeoStyle = {}): string {
  return [
    resolveGeoRegionBorderShow(geo) ? 1 : 0,
    geo.regionBorderColor?.toLowerCase() ?? "",
    geo.regionBorderWidth ?? "",
  ].join(",");
}
