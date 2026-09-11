import type { ColorScheme } from "@/components/dashboard/dashboardStyleConfig";
import { getDashboardThemeTokens } from "@/components/dashboard/dashboardThemeTokens";
import {
  CHART_PALETTE_CATALOG,
  CHART_PALETTE_INHERIT_LABEL,
  withChartColorOpacity,
  type ChartPalettePreset,
} from "@/lib/chartPalette";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";

export type TablePalettePreset = ChartPalettePreset & {
  light: Pick<
    ChartDeTableStyle,
    | "headerBg"
    | "headerFg"
    | "bodyBg"
    | "bodyFg"
    | "summaryBg"
    | "summaryFg"
    | "zebraBg"
    | "columnBg"
    | "cornerBg"
    | "emptyHintFg"
    | "paginationFg"
    | "scrollbarColor"
    | "borderColor"
  >;
  dark: Pick<
    ChartDeTableStyle,
    | "headerBg"
    | "headerFg"
    | "bodyBg"
    | "bodyFg"
    | "summaryBg"
    | "summaryFg"
    | "zebraBg"
    | "columnBg"
    | "cornerBg"
    | "emptyHintFg"
    | "paginationFg"
    | "scrollbarColor"
    | "borderColor"
  >;
};

function buildSchemeTableColors(
  scheme: ColorScheme,
  primary: string,
  accent?: string,
): TablePalettePreset["light"] {
  const tokens = getDashboardThemeTokens(scheme);
  const accentColor = accent ?? primary;
  return {
    headerBg: withChartColorOpacity(primary, scheme === "dark" ? 0.28 : 0.12),
    headerFg: scheme === "dark" ? "#e4e7ec" : "#344054",
    bodyBg: scheme === "dark" ? "rgba(15, 23, 42, 0.35)" : undefined,
    bodyFg: tokens.tableBodyFg,
    summaryBg: withChartColorOpacity(accentColor, scheme === "dark" ? 0.22 : 0.08),
    summaryFg: tokens.tableBodyFg,
    zebraBg: withChartColorOpacity(primary, scheme === "dark" ? 0.14 : 0.08),
    columnBg: scheme === "dark" ? "rgba(15, 23, 42, 0.2)" : undefined,
    cornerBg: withChartColorOpacity(primary, scheme === "dark" ? 0.32 : 0.14),
    emptyHintFg: tokens.stateText,
    paginationFg: tokens.textMuted,
    scrollbarColor: withChartColorOpacity(accentColor, 0.45),
    borderColor: tokens.tableBorder,
  };
}

export const TABLE_PALETTE_CATALOG: readonly TablePalettePreset[] = CHART_PALETTE_CATALOG.map(
  (preset) => ({
    ...preset,
    light: buildSchemeTableColors("light", preset.colors[0]!, preset.colors[1]),
    dark: buildSchemeTableColors("dark", preset.colors[0]!, preset.colors[1]),
  }),
);

export const TABLE_PALETTE_INHERIT_LABEL = CHART_PALETTE_INHERIT_LABEL;

export function resolveTablePaletteStyle(
  paletteId: string,
  scheme: ColorScheme = "light",
): ChartDeTableStyle {
  const preset = TABLE_PALETTE_CATALOG.find((item) => item.id === paletteId);
  if (!preset) return {};
  return { ...(scheme === "dark" ? preset.dark : preset.light) };
}

/** 继承看板表格配色时的色带预览 */
export function resolveTableInheritPreviewColors(
  dashboardTableStyle?: ChartDeTableStyle,
  scheme: ColorScheme = "light",
): readonly string[] {
  const tokens = getDashboardThemeTokens(scheme);
  const headerBg = dashboardTableStyle?.headerBg ?? tokens.tableHeaderBg;
  const headerFg = dashboardTableStyle?.headerFg ?? tokens.tableHeaderFg;
  const bodyFg = dashboardTableStyle?.bodyFg ?? tokens.tableBodyFg;
  return [headerBg, headerFg, bodyFg];
}

export function tablePaletteLabel(paletteId?: string): string | undefined {
  if (!paletteId) return undefined;
  return TABLE_PALETTE_CATALOG.find((item) => item.id === paletteId)?.label ?? paletteId;
}
