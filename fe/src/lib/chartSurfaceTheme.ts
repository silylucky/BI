import type { CSSProperties } from "react";
import type { ColorScheme, DashboardStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  isDarkWidgetShellColor,
  resolveWidgetShellPaintColor,
} from "@/components/dashboard/dashboardStyleConfig";
import { getDashboardThemeTokens } from "@/components/dashboard/dashboardThemeTokens";
import type { ChartDeTableStyle } from "./chartDeTableStyle";
import { DEFAULT_TABLE_ZEBRA_BG, resolveTableZebraBg } from "./chartDeTableStyle";
import { DASHBOARD_SCROLL_CSS_VARS } from "./dashboardScrollTokens";
import { softenTableChromeBg } from "./tableColorAlpha";

/** 看板滚动条令牌（浅/深主题统一，对标 DE 白色半透明） */
const SCROLL_VARS = DASHBOARD_SCROLL_CSS_VARS;

/** 组件实际底色优先于仪表板 colorScheme（对标 DE 组件内主题跟随） */
export function resolveEffectiveChartScheme(
  colorScheme: ColorScheme,
  widgetShellBg?: string,
): ColorScheme {
  const paint = widgetShellBg?.trim();
  if (!paint || paint.startsWith("var(")) return colorScheme;
  return isDarkWidgetShellColor(paint) ? "dark" : "light";
}

/** 看板 styleConfig → 组件内图表/标题有效主题（统一入口，避免局部漏定义 effectiveScheme） */
export function resolveWidgetEffectiveScheme(
  styleConfig: DashboardStyleConfig | undefined,
): ColorScheme {
  return resolveEffectiveChartScheme(
    styleConfig?.colorScheme ?? "light",
    styleConfig ? resolveWidgetShellPaintColor(styleConfig) : undefined,
  );
}

/** 明细表主题 CSS 变量：组件配色 > 有效主题令牌 */
export function resolveTableThemeVars(
  tableStyle: ChartDeTableStyle,
  context: { colorScheme: ColorScheme; widgetShellBg?: string },
): Record<string, string> {
  const scheme = resolveEffectiveChartScheme(context.colorScheme, context.widgetShellBg);
  const tokens = getDashboardThemeTokens(scheme);
  const softenChrome = !tableStyle.bodyBg?.trim();

  const resolveSoftenedHeader = (): string => {
    if (tableStyle.headerBg) return tableStyle.headerBg;
    return softenChrome ? softenTableChromeBg(tokens.tableHeaderBg) : tokens.tableHeaderBg;
  };

  const headerBg = resolveSoftenedHeader();

  const vars: Record<string, string> = {
    "--dashboard-table-header-bg": headerBg,
    "--dashboard-table-header-fg": tableStyle.headerFg ?? tokens.tableHeaderFg,
    "--dashboard-table-header-active-fg": tokens.textPrimary,
    "--dashboard-table-body-fg": tableStyle.bodyFg ?? tokens.tableBodyFg,
    "--dashboard-table-border": tableStyle.borderColor ?? tokens.tableBorder,
    "--dashboard-table-row-hover-bg":
      scheme === "dark" ? "rgba(70, 95, 255, 0.12)" : "rgba(70, 95, 255, 0.06)",
    "--dashboard-table-index-bg":
      scheme === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(148, 163, 184, 0.08)",
    "--dashboard-table-index-fg": tokens.textMuted,
    "--dashboard-table-footer-bg": headerBg,
    "--dashboard-table-header-font-size":
      tableStyle.headerFontSize != null ? `${tableStyle.headerFontSize}px` : "12px",
    ...SCROLL_VARS,
  };

  if (tableStyle.bodyBg) {
    vars["--dashboard-table-body-bg"] = tableStyle.bodyBg;
  } else if (softenChrome) {
    vars["--dashboard-table-body-bg"] = softenTableChromeBg(tokens.tableHeaderBg);
  }

  const zebraBg = resolveTableZebraBg(tableStyle);
  if (zebraBg) {
    vars["--dashboard-table-zebra-bg"] = zebraBg;
  } else if (tableStyle.zebraStriped !== false) {
    vars["--dashboard-table-zebra-bg"] =
      scheme === "dark" ? "rgba(255, 255, 255, 0.04)" : DEFAULT_TABLE_ZEBRA_BG;
  }

  if (tableStyle.columnBg) {
    vars["--dashboard-table-column-bg"] = tableStyle.columnBg;
  } else if (softenChrome) {
    vars["--dashboard-table-column-bg"] = softenTableChromeBg(tokens.tableHeaderBg);
  }

  if (tableStyle.cornerBg) vars["--dashboard-table-corner-bg"] = tableStyle.cornerBg;
  if (tableStyle.emptyHintFg) vars["--dashboard-table-empty-fg"] = tableStyle.emptyHintFg;
  if (tableStyle.paginationFg) vars["--dashboard-table-pagination-fg"] = tableStyle.paginationFg;
  if (tableStyle.paginationFontSize != null) {
    vars["--dashboard-table-pagination-font-size"] = `${tableStyle.paginationFontSize}px`;
  }
  if (tableStyle.bodyFontSize != null) {
    vars["--dashboard-table-body-font-size"] = `${tableStyle.bodyFontSize}px`;
  }
  if (tableStyle.summaryBg) vars["--dashboard-table-summary-bg"] = tableStyle.summaryBg;
  if (tableStyle.summaryFg) vars["--dashboard-table-summary-fg"] = tableStyle.summaryFg;

  if (tableStyle.scrollbarColor) {
    vars["--dashboard-scroll-thumb"] = tableStyle.scrollbarColor;
    vars["--dashboard-scroll-thumb-hover"] = tableStyle.scrollbarColor;
  }

  return vars;
}

/** 表格滚动区仅注入滚动条 CSS 变量，避免把表头/单元格主题变量误挂到滚动容器上 */
export function resolveTableScrollbarStyle(
  tableStyle: Pick<ChartDeTableStyle, "scrollbarColor">,
  themeVars?: Record<string, string>,
): CSSProperties | undefined {
  const thumb = tableStyle.scrollbarColor?.trim() || themeVars?.["--dashboard-scroll-thumb"];
  if (!thumb) return undefined;
  const hover = themeVars?.["--dashboard-scroll-thumb-hover"] ?? thumb;
  return {
    ["--dashboard-scroll-thumb" as string]: thumb,
    ["--dashboard-scroll-thumb-hover" as string]: hover,
  };
}

export function resolveTableHostOpacity(tableStyle: Pick<ChartDeTableStyle, "opacity">): number | undefined {
  if (tableStyle.opacity == null || tableStyle.opacity >= 100) return undefined;
  return tableStyle.opacity / 100;
}

export function resolveTableHostBorder(borderColor?: string): string {
  return borderColor?.trim()
    ? `1px solid ${borderColor}`
    : "1px solid var(--dashboard-table-border, #f2f4f7)";
}
