import type { ColorScheme } from "./dashboardStyleConfig";

const CANVAS_BG_LIGHT = "#ffffff";
const CANVAS_BG_DARK = "#0f172a";
const WIDGET_SHELL_DARK = "#1e293b";

/** 仪表板明/暗两套固定视觉令牌（切换主题时强制同步） */
export type DashboardThemeTokens = {
  canvas: string;
  widgetShell: string;
  widgetBorder: string;
  title: string;
  filterTitle: string;
  dialogBg: string;
  dialogFg: string;
  textPrimary: string;
  textMuted: string;
  chartAxis: string;
  chartLegend: string;
  chartGrid: string;
  tableHeaderBg: string;
  tableHeaderFg: string;
  tableBodyFg: string;
  tableBorder: string;
  stateText: string;
};

const LIGHT: DashboardThemeTokens = {
  canvas: CANVAS_BG_LIGHT,
  widgetShell: "#ffffff",
  widgetBorder: "#e4e7ec",
  title: "#1d2939",
  filterTitle: "#475467",
  dialogBg: "#ffffff",
  dialogFg: "#344054",
  textPrimary: "#344054",
  textMuted: "#667085",
  chartAxis: "#667085",
  chartLegend: "#344054",
  chartGrid: "#e4e7ec",
  tableHeaderBg: "#f9fafb",
  tableHeaderFg: "#667085",
  tableBodyFg: "#344054",
  tableBorder: "#f2f4f7",
  stateText: "#667085",
};

const DARK: DashboardThemeTokens = {
  canvas: CANVAS_BG_DARK,
  widgetShell: WIDGET_SHELL_DARK,
  widgetBorder: "#344054",
  title: "#f2f4f7",
  filterTitle: "#98a2b3",
  dialogBg: "#1d2939",
  dialogFg: "#ececed",
  textPrimary: "#e2e8f0",
  textMuted: "#98a2b3",
  chartAxis: "#cbd5e1",
  chartLegend: "#e2e8f0",
  chartGrid: "#344054",
  tableHeaderBg: "#0f172a",
  tableHeaderFg: "#98a2b3",
  tableBodyFg: "#d0d5dd",
  tableBorder: "#334155",
  stateText: "#98a2b3",
};

export function getDashboardThemeTokens(scheme: ColorScheme = "light"): DashboardThemeTokens {
  return scheme === "dark" ? DARK : LIGHT;
}

/** 是否为另一套主题的默认标题色（切换时应重置） */
export function isOppositeThemeTitleColor(color: string | undefined, scheme: ColorScheme): boolean {
  const normalized = color?.trim().toLowerCase();
  if (!normalized) return false;
  const other = scheme === "dark" ? LIGHT : DARK;
  return normalized === other.title.toLowerCase();
}

export function themeTokensToScopeVars(tokens: DashboardThemeTokens): Record<string, string> {
  return {
    "--dashboard-artboard-bg": tokens.canvas,
    "--dashboard-widget-surface": tokens.widgetShell,
    "--dashboard-widget-border": tokens.widgetBorder,
    "--dashboard-text-primary": tokens.textPrimary,
    "--dashboard-text-muted": tokens.textMuted,
    "--dashboard-title-color": tokens.title,
    "--dashboard-chart-axis": tokens.chartAxis,
    "--dashboard-chart-legend": tokens.chartLegend,
    "--dashboard-chart-grid": tokens.chartGrid,
    "--dashboard-table-header-bg": tokens.tableHeaderBg,
    "--dashboard-table-header-fg": tokens.tableHeaderFg,
    "--dashboard-table-body-fg": tokens.tableBodyFg,
    "--dashboard-table-border": tokens.tableBorder,
    "--dashboard-state-text": tokens.stateText,
    "--dashboard-dialog-bg": tokens.dialogBg,
    "--dashboard-dialog-fg": tokens.dialogFg,
  };
}
