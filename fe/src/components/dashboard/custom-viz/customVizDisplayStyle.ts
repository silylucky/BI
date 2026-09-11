import { type CSSProperties } from "react";
import { type ChartBorderStyle, resolveWidgetShellStyle } from "@/lib/chartDeStyle";
import { resolveChartColors, resolvePaletteId } from "@/lib/chartPalette";
import type { ColorScheme } from "@/lib/chartSurfaceTheme";
import { getDashboardThemeTokens, isOppositeThemeTitleColor } from "../dashboardThemeTokens";
import {
  mergeTitleStyle,
  type DashboardStyleConfig,
  type TitleStyleConfig,
  type WidgetStyleConfig,
  isDarkWidgetShellColor,
} from "../dashboardStyleConfig";
import type { CustomVizWidgetConfig, CustomVizDisplayStyle, LayoutWidget } from "../layoutUtils";
import { mergeWidgetOverrideStyle } from "../widgetRailStyleSections";

export type { CustomVizDisplayStyle };

export function readCustomVizDisplayStyle(
  config: CustomVizWidgetConfig | undefined,
): CustomVizDisplayStyle {
  return config?.displayStyle ?? {};
}

export function patchCustomVizDisplayStyle(
  config: CustomVizWidgetConfig,
  patch: Partial<CustomVizDisplayStyle>,
): CustomVizWidgetConfig {
  return {
    ...config,
    displayStyle: { ...(config.displayStyle ?? {}), ...patch },
  };
}

export function patchCustomVizDisplayStyleNested<
  K extends keyof CustomVizDisplayStyle,
>(
  config: CustomVizWidgetConfig,
  key: K,
  patch: Partial<NonNullable<CustomVizDisplayStyle[K]>>,
): CustomVizWidgetConfig {
  const prev = config.displayStyle ?? {};
  const nested = prev[key];
  return patchCustomVizDisplayStyle(config, {
    [key]: { ...(nested && typeof nested === "object" ? nested : {}), ...patch },
  } as Partial<CustomVizDisplayStyle>);
}

export function readCustomVizTitleVisible(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): boolean {
  const show = readCustomVizDisplayStyle(config).title?.show;
  if (show !== undefined) return show;
  return dashboardStyle?.titleStyle?.show !== false;
}

export function readCustomVizLabelVisible(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): boolean {
  const show = readCustomVizDisplayStyle(config).label?.show;
  if (show !== undefined) return show;
  return dashboardStyle?.chartLabelShow !== false;
}

export function readCustomVizTooltipVisible(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): boolean {
  const show = readCustomVizDisplayStyle(config).tooltip?.show;
  if (show !== undefined) return show;
  return dashboardStyle?.tooltipShow !== false;
}

export function resolveCustomVizLabelColor(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): string | undefined {
  return (
    readCustomVizDisplayStyle(config).label?.color ??
    dashboardStyle?.chartLabelStyle?.color
  );
}

export function resolveCustomVizTooltipColor(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): string | undefined {
  return (
    readCustomVizDisplayStyle(config).tooltip?.color ??
    dashboardStyle?.chartTooltipStyle?.color
  );
}

export function resolveCustomVizTooltipBackground(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): string | undefined {
  return (
    readCustomVizDisplayStyle(config).tooltip?.background ??
    dashboardStyle?.chartTooltipStyle?.background
  );
}

export function resolveCustomVizEffectivePaletteId(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): string | undefined {
  const own = readCustomVizDisplayStyle(config).paletteId;
  if (own != null) return resolvePaletteId(own);
  if (dashboardStyle?.paletteId != null) return resolvePaletteId(dashboardStyle.paletteId);
  return undefined;
}

export function resolveCustomVizEffectivePaletteColors(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): string[] {
  const ds = readCustomVizDisplayStyle(config);
  if (ds.paletteId != null) {
    return resolveChartColors(resolvePaletteId(ds.paletteId), ds.paletteColors);
  }
  if (ds.paletteColors?.length) return [...ds.paletteColors];
  return resolveChartColors(
    dashboardStyle?.paletteId,
    dashboardStyle?.paletteColors?.length ? [...dashboardStyle.paletteColors] : undefined,
  );
}

/** 样式 Tab「背景」：看板 + 单卡外壳 + display 内层 */
export function resolveCustomVizDisplayBackgroundShell(
  widget: { customVizConfig?: CustomVizWidgetConfig },
  dashboardStyle?: DashboardStyleConfig,
): WidgetStyleConfig {
  const global = dashboardStyle?.widgetStyle;
  const perWidget = mergeWidgetOverrideStyle(global, {
    id: "",
    type: "customViz",
    title: "",
    order: 0,
    colSpan: 1,
    rowSpan: 1,
    customVizConfig: widget.customVizConfig,
  });
  const inner = readCustomVizDisplayStyle(widget.customVizConfig).background ?? {};
  return { ...(perWidget ?? {}), ...inner };
}

/** 看板 + 高级 Tab widgetStyle + 样式 Tab 背景/边框 → 外壳渲染真源 */
export function resolveCustomVizWidgetShellStyle(
  widget: { customVizConfig?: CustomVizWidgetConfig },
  dashboardStyle?: DashboardStyleConfig,
): WidgetStyleConfig | undefined {
  const base = resolveCustomVizDisplayBackgroundShell(widget, dashboardStyle);
  const border = readCustomVizDisplayStyle(widget.customVizConfig).border;
  if (!border) return base;
  return {
    ...base,
    ...(border.show != null ? { borderEnabled: border.show } : {}),
    ...(border.color != null ? { borderColor: border.color } : {}),
    ...(border.width != null ? { borderWidth: border.width } : {}),
    ...(border.style != null ? { borderStyle: border.style } : {}),
    ...(border.radius != null ? { borderRadius: border.radius } : {}),
  };
}

/** pixel / grid 外壳：对齐 chart resolveChartContentShellStyle */
export function resolveCustomVizContentShellStyle(
  widget: { customVizConfig?: CustomVizWidgetConfig },
  dashboardStyle?: DashboardStyleConfig,
  colorScheme: ColorScheme = "light",
) {
  const mergedWidgetStyle = resolveCustomVizWidgetShellStyle(widget, dashboardStyle);
  const outer = resolveWidgetShellStyle(mergedWidgetStyle, colorScheme);
  const outerStyle = { ...outer.style };
  if (
    outer.backgroundLayer?.backgroundImage &&
    !outerStyle.background &&
    (outerStyle.backgroundColor === "var(--dashboard-widget-surface)" ||
      outerStyle.backgroundColor === "transparent")
  ) {
    outerStyle.backgroundColor = "transparent";
  }
  return {
    outer: { ...outer, style: outerStyle },
    inner: {} as CSSProperties,
    innerBackgroundLayer: null,
    innerFrameLayer: null,
  };
}

export function mergeCustomVizTitleStyle(
  global: TitleStyleConfig | undefined,
  config: CustomVizWidgetConfig | undefined,
  colorScheme: ColorScheme = "light",
): CSSProperties {
  const override = config ? readCustomVizDisplayStyle(config).title : undefined;
  const tokens = getDashboardThemeTokens(colorScheme);
  const mergedOverride =
    override?.color && isOppositeThemeTitleColor(override.color, colorScheme)
      ? { ...override, color: tokens.title }
      : override;
  return mergeTitleStyle(global, mergedOverride);
}

export function readCustomVizRemark(
  config: CustomVizWidgetConfig | undefined,
): { show: boolean; text: string } {
  if (!config) return { show: false, text: "" };
  const remark = readCustomVizDisplayStyle(config).remark;
  const text = remark?.text?.trim() ?? "";
  return { show: Boolean(remark?.show && text), text };
}

export function readCustomVizDisplayBorder(
  config: CustomVizWidgetConfig | undefined,
  dashboardStyle?: DashboardStyleConfig,
): ChartBorderStyle {
  const merged = resolveCustomVizDisplayBackgroundShell(
    { customVizConfig: config },
    dashboardStyle,
  );
  const border = readCustomVizDisplayStyle(config).border;
  return {
    show: border?.show ?? merged.borderEnabled,
    color: border?.color ?? merged.borderColor,
    width: border?.width ?? merged.borderWidth,
    style: border?.style ?? merged.borderStyle,
    radius: border?.radius ?? merged.borderRadius,
  };
}

/** 合并 manifest / display / schema 写入 payload.style 与 --vs-style-* */
export function resolveCustomVizRuntimeStyle(args: {
  manifestDefault?: Record<string, unknown>;
  config?: CustomVizWidgetConfig;
  dashboardStyle?: DashboardStyleConfig;
}): Record<string, unknown> {
  const manifestDefault = args.manifestDefault ?? {};
  const schemaStyle = args.config?.style ?? {};
  const flatDisplay = flattenCustomVizDisplayStyle(args.config?.displayStyle);
  const merged = { ...manifestDefault, ...flatDisplay, ...schemaStyle };
  const palette = resolveCustomVizEffectivePaletteColors(args.config, args.dashboardStyle);
  if (palette.length) {
    merged.paletteColors = palette;
  }
  const schemaHasExplicitAccent =
    schemaStyle.accentColor != null ||
    schemaStyle.lineColor != null ||
    schemaStyle.barColor != null;
  if (palette[0] && !schemaHasExplicitAccent) {
    merged.accentColor = palette[0];
  }
  if (merged.seriesGradient == null && args.dashboardStyle?.seriesGradient != null) {
    merged.seriesGradient = args.dashboardStyle.seriesGradient;
  }
  if (merged.paletteOpacity == null && args.config?.displayStyle?.paletteOpacity == null) {
    const inheritedOpacity = args.dashboardStyle?.paletteOpacity;
    if (inheritedOpacity != null) merged.paletteOpacity = inheritedOpacity;
  }

  // 六块标签/提示：写入有效值（含看板继承），供 bundle 与 style bridge 消费
  if (merged.labelShow == null) {
    merged.labelShow = readCustomVizLabelVisible(args.config, args.dashboardStyle);
  }
  if (merged.tooltipShow == null) {
    merged.tooltipShow = readCustomVizTooltipVisible(args.config, args.dashboardStyle);
  }
  if (merged.labelColor == null) {
    const color = resolveCustomVizLabelColor(args.config, args.dashboardStyle);
    if (color) merged.labelColor = color;
  }
  if (merged.labelFontSize == null && args.config?.displayStyle?.label?.fontSize == null) {
    const size = args.dashboardStyle?.chartLabelStyle?.fontSize;
    if (size != null) merged.labelFontSize = size;
  }
  if (merged.tooltipColor == null) {
    const color = resolveCustomVizTooltipColor(args.config, args.dashboardStyle);
    if (color) merged.tooltipColor = color;
  }
  if (merged.tooltipBackground == null) {
    const bg = resolveCustomVizTooltipBackground(args.config, args.dashboardStyle);
    if (bg) merged.tooltipBackground = bg;
  }
  if (merged.tooltipFontSize == null && args.config?.displayStyle?.tooltip?.fontSize == null) {
    const size = args.dashboardStyle?.chartTooltipStyle?.fontSize;
    if (size != null) merged.tooltipFontSize = size;
  }

  return merged;
}

function flattenCustomVizDisplayStyle(
  displayStyle: CustomVizDisplayStyle | undefined,
): Record<string, unknown> {
  if (!displayStyle) return {};
  const out: Record<string, unknown> = {};
  const { title, remark, label, tooltip, paletteId, paletteColors, paletteOpacity, seriesGradient } =
    displayStyle;

  if (paletteId != null) out.paletteId = paletteId;
  if (paletteColors?.length) out.paletteColors = paletteColors;
  if (paletteOpacity != null) out.paletteOpacity = paletteOpacity;
  if (seriesGradient != null) out.seriesGradient = seriesGradient;

  if (title) {
    if (title.show != null) out.titleShow = title.show;
    if (title.color) out.titleColor = title.color;
    if (title.fontSize != null) out.titleFontSize = title.fontSize;
    if (title.fontWeight != null) out.titleFontWeight = title.fontWeight;
    if (title.fontStyle) out.titleFontStyle = title.fontStyle;
    if (title.align) out.titleAlign = title.align;
    if (title.letterSpacing != null) out.titleLetterSpacing = title.letterSpacing;
    if (title.shadow != null) out.titleShadow = title.shadow;
  }
  if (remark) {
    if (remark.show != null) out.remarkShow = remark.show;
    if (remark.text) out.remarkText = remark.text;
  }
  if (label) {
    if (label.show != null) out.labelShow = label.show;
    if (label.color) out.labelColor = label.color;
    if (label.fontSize != null) out.labelFontSize = label.fontSize;
    if (label.position) out.labelPosition = label.position;
    if (label.formatter) out.labelFormatter = label.formatter;
  }
  if (tooltip) {
    if (tooltip.show != null) out.tooltipShow = tooltip.show;
    if (tooltip.color) out.tooltipColor = tooltip.color;
    if (tooltip.background) out.tooltipBackground = tooltip.background;
    if (tooltip.fontSize != null) out.tooltipFontSize = tooltip.fontSize;
  }

  return out;
}

function omitEmptyStyleField<T extends Record<string, unknown>>(
  value: T | undefined,
): T | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([, field]) => field !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/** 主题「重置颜色」：清除 displayStyle 底色/配色与颜色 override，保留字号/位置等结构字段 */
export function stripCustomVizDisplayStyleOverrides(
  displayStyle: CustomVizDisplayStyle | undefined,
): CustomVizDisplayStyle | undefined {
  if (!displayStyle) return displayStyle;

  const next: CustomVizDisplayStyle = { ...displayStyle };
  let changed = false;

  if (next.background) {
    delete next.background;
    changed = true;
  }

  if (next.paletteId != null) {
    delete next.paletteId;
    changed = true;
  }
  if (next.paletteColors?.length) {
    delete next.paletteColors;
    changed = true;
  }
  if (next.paletteOpacity != null) {
    delete next.paletteOpacity;
    changed = true;
  }
  if (next.seriesGradient != null) {
    delete next.seriesGradient;
    changed = true;
  }

  if (next.title?.color !== undefined) {
    const { color: _removed, ...rest } = next.title;
    next.title = omitEmptyStyleField(rest);
    changed = true;
  }

  if (next.label?.color !== undefined) {
    const { color: _removed, ...rest } = next.label;
    next.label = omitEmptyStyleField(rest);
    changed = true;
  }

  if (next.tooltip && (next.tooltip.color !== undefined || next.tooltip.background !== undefined)) {
    const { color: _c, background: _b, ...rest } = next.tooltip;
    next.tooltip = omitEmptyStyleField(rest);
    changed = true;
  }

  if (next.border?.color !== undefined) {
    const { color: _removed, ...rest } = next.border;
    next.border = omitEmptyStyleField(rest);
    changed = true;
  }

  if (!changed) return displayStyle;

  const compact = omitEmptyStyleField(next);
  return compact ?? undefined;
}

export type CustomVizDashboardSyncScope =
  | "title"
  | "widgetAppearance"
  | "palette";

/** 看板「图表标题」修改后清除组件级 title override（含 show） */
export function stripCustomVizTitleOverrides(
  config: CustomVizWidgetConfig,
): CustomVizWidgetConfig {
  const ds = config.displayStyle;
  if (!ds?.title) return config;
  const nextDs = { ...ds };
  delete nextDs.title;
  return {
    ...config,
    displayStyle: omitEmptyStyleField(nextDs),
  };
}

/** 清除组件级外壳 override，回退看板 widgetStyle */
export function stripCustomVizWidgetAppearanceOverrides(
  config: CustomVizWidgetConfig,
): CustomVizWidgetConfig {
  let next = config;
  if (config.widgetStyle) {
    next = { ...next, widgetStyle: undefined };
  }
  const ds = next.displayStyle;
  if (!ds?.background && !ds?.border) return next;
  const nextDs = { ...ds };
  delete nextDs.background;
  delete nextDs.border;
  return {
    ...next,
    displayStyle: omitEmptyStyleField(nextDs),
  };
}

/** 清除组件级配色/标签/提示 override，回退看板图表配色 */
export function stripCustomVizPaletteOverrides(
  config: CustomVizWidgetConfig,
): CustomVizWidgetConfig {
  const ds = config.displayStyle;
  if (!ds) return config;

  const hasPaletteFields =
    ds.paletteId != null ||
    (ds.paletteColors != null && ds.paletteColors.length > 0) ||
    ds.paletteOpacity != null ||
    ds.seriesGradient != null;
  const label = ds.label;
  const hasLabelPaletteFields =
    label &&
    (label.show !== undefined || label.fontSize !== undefined || label.color !== undefined);
  const tooltip = ds.tooltip;
  const hasTooltipFields =
    tooltip &&
    (tooltip.show !== undefined ||
      tooltip.fontSize !== undefined ||
      tooltip.color !== undefined ||
      tooltip.background !== undefined);

  if (!hasPaletteFields && !hasLabelPaletteFields && !hasTooltipFields) return config;

  const nextDs: CustomVizDisplayStyle = { ...ds };
  delete nextDs.paletteId;
  delete nextDs.paletteColors;
  delete nextDs.paletteOpacity;
  delete nextDs.seriesGradient;

  if (label) {
    const nextLabel = { ...label };
    delete nextLabel.show;
    delete nextLabel.fontSize;
    delete nextLabel.color;
    if (Object.keys(nextLabel).length > 0) nextDs.label = nextLabel;
    else delete nextDs.label;
  }

  if (tooltip) {
    delete nextDs.tooltip;
  }

  return {
    ...config,
    displayStyle: omitEmptyStyleField(nextDs),
  };
}

export function syncCustomVizConfigForDashboardScopes(
  config: CustomVizWidgetConfig,
  scopes: ReadonlySet<CustomVizDashboardSyncScope>,
): CustomVizWidgetConfig {
  let next = config;
  if (scopes.has("title")) next = stripCustomVizTitleOverrides(next);
  if (scopes.has("widgetAppearance")) next = stripCustomVizWidgetAppearanceOverrides(next);
  if (scopes.has("palette")) next = stripCustomVizPaletteOverrides(next);
  return next;
}

export function syncCustomVizWidgetsForDashboardScopes(
  widgets: LayoutWidget[],
  scopes: ReadonlySet<CustomVizDashboardSyncScope>,
): LayoutWidget[] {
  if (scopes.size === 0) return widgets;
  return widgets.map((widget) => {
    if (widget.type !== "customViz" || !widget.customVizConfig) return widget;
    const nextConfig = syncCustomVizConfigForDashboardScopes(widget.customVizConfig, scopes);
    return nextConfig === widget.customVizConfig
      ? widget
      : { ...widget, customVizConfig: nextConfig };
  });
}

/** 切换浅色/深色时清除 customViz 组件级配色/外壳 override，跟随看板主题 */
export function syncCustomVizWidgetsForColorScheme(
  widgets: LayoutWidget[],
  scheme: ColorScheme,
): LayoutWidget[] {
  return widgets.map((widget) => {
    if (widget.type !== "customViz" || !widget.customVizConfig) return widget;
    let config = stripCustomVizPaletteOverrides(widget.customVizConfig);

    const shell = resolveCustomVizDisplayBackgroundShell({ customVizConfig: config });
    const bg = shell.background?.trim();
    if (bg) {
      const shellOk =
        scheme === "dark" ? isDarkWidgetShellColor(bg) : !isDarkWidgetShellColor(bg);
      if (!shellOk) {
        config = stripCustomVizWidgetAppearanceOverrides(config);
      }
    }

    const titleColor = readCustomVizDisplayStyle(config).title?.color?.trim();
    if (
      titleColor &&
      (isOppositeThemeTitleColor(titleColor, scheme) ||
        titleColor.toLowerCase() === (scheme === "dark" ? "#1d2939" : "#f2f4f7"))
    ) {
      config = stripCustomVizTitleOverrides(config);
    }

    return config === widget.customVizConfig ? widget : { ...widget, customVizConfig: config };
  });
}
