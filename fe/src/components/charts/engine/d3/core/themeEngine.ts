import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";
import type { AntvThemeTokens } from "@/components/charts/engine/antv/theme";
import { getAntvThemeTokens } from "@/components/charts/engine/antv/theme";

/** VCDS 主题：在 AntV token 上扩展 surface / accent / glow */
export type D3Theme = AntvThemeTokens & {
  scheme: ColorScheme;
  plotSurface: string;
  panelSurface: string;
  floatSurface: string;
  accent: string;
  accentMuted: string;
  seriesGlow: string;
  crosshair: string;
  dimOpacity: number;
};

export function resolveD3Theme(scheme: ColorScheme, accentColor = "#465fff"): D3Theme {
  const base = getAntvThemeTokens(scheme);
  const isDark = scheme === "dark";
  return {
    ...base,
    scheme,
    plotSurface: isDark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.6)",
    panelSurface: isDark ? "rgba(15,23,42,0.85)" : "rgba(249,250,251,0.92)",
    floatSurface: isDark ? "rgba(17,24,39,0.94)" : "rgba(255,255,255,0.96)",
    accent: accentColor,
    accentMuted: isDark ? "rgba(70,95,255,0.35)" : "rgba(70,95,255,0.18)",
    seriesGlow: isDark ? "rgba(70,95,255,0.45)" : "rgba(70,95,255,0.25)",
    crosshair: isDark ? "rgba(255,255,255,0.35)" : "rgba(70,95,255,0.55)",
    dimOpacity: 0.25,
  };
}

/** 兼容现有 renderer 的 theme 字段 */
export function themeFromConfig(
  theme: AntvThemeTokens | D3Theme | undefined,
  scheme: ColorScheme = "light",
): D3Theme {
  if (theme && "plotSurface" in theme) return theme;
  const accent = "#465fff";
  return resolveD3Theme(scheme, accent);
}
