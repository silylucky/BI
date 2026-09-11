import * as d3 from "d3";

export type GeoSurfacePalette = {
  emptyFill: string;
  hoverFill: string;
  hoverGlow: string;
  border: string;
  borderBright: string;
  rangeLow: string;
  rangeMid: string;
  rangeHigh: string;
  rangePeak: string;
  plotBgCenter: string;
  plotBgEdge: string;
  glow: string;
};

/** 2D/3D 离线地图共用视觉色板（大屏数据感） */
export function geoSurfaceColors(isDark: boolean): GeoSurfacePalette {
  if (isDark) {
    return {
      emptyFill: "#1a3352",
      hoverFill: "#38bdf8",
      hoverGlow: "#22d3ee",
      border: "rgba(125, 211, 252, 0.28)",
      borderBright: "rgba(186, 230, 253, 0.95)",
      rangeLow: "#042f2e",
      rangeMid: "#0e7490",
      rangeHigh: "#0284c7",
      rangePeak: "#67e8f9",
      plotBgCenter: "#0f2744",
      plotBgEdge: "#020617",
      glow: "#22d3ee",
    };
  }
  return {
    emptyFill: "#c9dcf0",
    hoverFill: "#1d4ed8",
    hoverGlow: "#2563eb",
    border: "rgba(30, 64, 175, 0.35)",
    borderBright: "rgba(29, 78, 216, 0.95)",
    rangeLow: "#bae6fd",
    rangeMid: "#38bdf8",
    rangeHigh: "#2563eb",
    rangePeak: "#1e3a8a",
    plotBgCenter: "#eff6ff",
    plotBgEdge: "#dbeafe",
    glow: "#3b82f6",
  };
}

/** 经典暖色预设：顶面数据色带偏琥珀/金 */
export function geoClassicSurfaceColors(isDark: boolean): GeoSurfacePalette {
  if (isDark) {
    return {
      emptyFill: "#3d2f1f",
      hoverFill: "#fbbf24",
      hoverGlow: "#fcd34d",
      border: "rgba(240, 194, 122, 0.45)",
      borderBright: "rgba(252, 211, 77, 0.95)",
      rangeLow: "#422006",
      rangeMid: "#b45309",
      rangeHigh: "#d97706",
      rangePeak: "#fbbf24",
      plotBgCenter: "#292018",
      plotBgEdge: "#1a1208",
      glow: "#f59e0b",
    };
  }
  return {
    emptyFill: "#e8dcc8",
    hoverFill: "#d97706",
    hoverGlow: "#b45309",
    border: "rgba(180, 83, 9, 0.4)",
    borderBright: "rgba(217, 119, 6, 0.9)",
    rangeLow: "#fef3c7",
    rangeMid: "#fcd34d",
    rangeHigh: "#f59e0b",
    rangePeak: "#b45309",
    plotBgCenter: "#fffbeb",
    plotBgEdge: "#fef3c7",
    glow: "#d97706",
  };
}

/** 简洁预设：低饱和蓝灰 */
export function geoMinimalSurfaceColors(isDark: boolean): GeoSurfacePalette {
  if (isDark) {
    return {
      emptyFill: "#1e293b",
      hoverFill: "#94a3b8",
      hoverGlow: "#cbd5e1",
      border: "rgba(100, 116, 139, 0.35)",
      borderBright: "rgba(148, 163, 184, 0.85)",
      rangeLow: "#0f172a",
      rangeMid: "#334155",
      rangeHigh: "#475569",
      rangePeak: "#94a3b8",
      plotBgCenter: "#0f172a",
      plotBgEdge: "#020617",
      glow: "#64748b",
    };
  }
  return {
    emptyFill: "#e2e8f0",
    hoverFill: "#64748b",
    hoverGlow: "#475569",
    border: "rgba(71, 85, 105, 0.3)",
    borderBright: "rgba(51, 65, 85, 0.75)",
    rangeLow: "#f1f5f9",
    rangeMid: "#cbd5e1",
    rangeHigh: "#94a3b8",
    rangePeak: "#475569",
    plotBgCenter: "#f8fafc",
    plotBgEdge: "#f1f5f9",
    glow: "#64748b",
  };
}

export function geoSurfaceColorsForPreset(
  isDark: boolean,
  preset: "satellite" | "tech" | "classic" | "minimal",
): GeoSurfacePalette {
  if (preset === "classic") return geoClassicSurfaceColors(isDark);
  if (preset === "minimal") return geoMinimalSurfaceColors(isDark);
  return geoSurfaceColors(isDark);
}

export function colorForGeoValue(
  value: number,
  min: number,
  max: number,
  surface: GeoSurfacePalette,
): string {
  if (!Number.isFinite(value) || value <= 0) return surface.emptyFill;
  if (max <= 0) return surface.emptyFill;
  const t = max <= min ? 1 : (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, t));
  const stops = [surface.rangeLow, surface.rangeMid, surface.rangeHigh, surface.rangePeak];
  const scaled = clamped * 3;
  const index = Math.min(2, Math.floor(scaled));
  const frac = scaled - index;
  return d3.interpolateRgb(stops[index], stops[index + 1])(frac);
}

/** 悬停高亮：仅在指针位于该省时显示，移开即恢复 */
export function colorForGeoHover(
  value: number,
  min: number,
  max: number,
  surface: GeoSurfacePalette,
): string {
  const base = colorForGeoValue(value, min, max, surface);
  if (value > 0) {
    return d3.interpolateRgb(base, surface.rangePeak)(0.34);
  }
  return d3.interpolateRgb(surface.emptyFill, surface.rangeMid)(0.5);
}

export function geoValueIntensity(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function geoStrokeWidth(chartWidth: number): number {
  return Math.max(0.75, Math.min(1.2, chartWidth / 320));
}

/** 图表配色 + 自定义区块填充 → 2D choropleth 色带 */
export function buildGeoSurfacePalette(
  isDark: boolean,
  options: { colors?: readonly string[]; regionFillColor?: string } = {},
): GeoSurfacePalette {
  const fallback = geoSurfaceColors(isDark);
  const palette = options.colors?.filter(Boolean) ?? [];
  const emptyFill = options.regionFillColor?.trim() || fallback.emptyFill;
  if (palette.length === 0) {
    return { ...fallback, emptyFill };
  }
  const at = (index: number, defaultColor: string) =>
    palette[Math.min(index, palette.length - 1)] ?? defaultColor;
  return {
    ...fallback,
    emptyFill,
    rangeLow: at(0, fallback.rangeLow),
    rangeMid: at(Math.max(1, Math.floor(palette.length / 3)), fallback.rangeMid),
    rangeHigh: at(Math.max(2, Math.floor((palette.length * 2) / 3)), fallback.rangeHigh),
    rangePeak: at(palette.length - 1, fallback.rangePeak),
  };
}

export function resolveGeoMapOpacity(opacity?: number): number {
  if (opacity == null || !Number.isFinite(opacity)) return 1;
  return Math.max(0, Math.min(1, opacity));
}
