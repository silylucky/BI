import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { resolveLabelFill } from "@/components/charts/engine/d3/core/presentation";
import {
  CHART_PRESENTATION_REFERENCE_SPAN,
  MIN_CHART_PRESENTATION_FONT_SIZE,
  scaleChartPresentationFontSize,
  type ChartPresentationPaintContext,
} from "@/components/charts/engine/d3/core/chartPresentationScale";
import type { ChartGeoStyle } from "@/lib/chartDeStyle";

/** 区域标签默认字号（可选下限 6，默认可读性仍用 10） */
export const DEFAULT_GEO_REGION_LABEL_FONT_SIZE = 10;
export const GEO_REGION_LABEL_REFERENCE_WIDTH = CHART_PRESENTATION_REFERENCE_SPAN;
export const MIN_GEO_REGION_LABEL_FONT_SIZE = MIN_CHART_PRESENTATION_FONT_SIZE;

function isValidHex(color?: string): color is string {
  return Boolean(color && /^#[0-9a-fA-F]{6}$/.test(color));
}

export function hasCustomGeoRegionLabelColor(geo: ChartGeoStyle = {}): boolean {
  return isValidHex(geo.regionLabelColor?.trim());
}

export type GeoRegionLabelFontSizeOptions = Partial<ChartPresentationPaintContext>;

export function resolveGeoRegionLabelFontSize(
  geo: ChartGeoStyle = {},
  options: GeoRegionLabelFontSizeOptions = {},
): number {
  const base = geo.regionLabelFontSize ?? DEFAULT_GEO_REGION_LABEL_FONT_SIZE;
  return scaleChartPresentationFontSize(base, {
    chartWidth: options.chartWidth ?? GEO_REGION_LABEL_REFERENCE_WIDTH,
    chartHeight: options.chartHeight ?? options.chartWidth ?? GEO_REGION_LABEL_REFERENCE_WIDTH,
    visualScale: options.visualScale,
    renderTier: options.renderTier,
  });
}

export function resolveGeoRegionLabelFallbackHex(isDark: boolean): string {
  return isDark ? "#cbd5e1" : "#475569";
}

export function resolveGeoRegionLabelColorHex(
  geo: ChartGeoStyle,
  theme: AntvThemeTokens,
): string {
  const custom = geo.regionLabelColor?.trim();
  if (isValidHex(custom)) return custom.toLowerCase();
  return resolveLabelFill(theme);
}

/** 样式面板取色：自定义色 > 主题默认 */
export function resolveGeoRegionLabelPanelColorHex(geo: ChartGeoStyle, isDark: boolean): string {
  const custom = geo.regionLabelColor?.trim();
  if (isValidHex(custom)) return custom.toLowerCase();
  return resolveGeoRegionLabelFallbackHex(isDark);
}
