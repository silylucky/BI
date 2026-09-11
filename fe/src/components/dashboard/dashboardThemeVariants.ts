import type {
  ColorScheme,
  DashboardStyleConfig,
  DialogStyleConfig,
  FilterChromeStyleConfig,
  TitleStyleConfig,
  WidgetStyleConfig,
} from "./dashboardStyleConfig";
import { CANVAS_BG_DARK_DEFAULT, CANVAS_BG_LIGHT_DEFAULT, isDarkCanvasColor, isDarkWidgetShellColor, isLightCanvasColor, WIDGET_SHELL_DARK_DEFAULT } from "./dashboardStyleConfig";
import { normalizeDashboardGapConfig } from "./gapPolicy";
import type { LayoutWidget } from "./layoutUtils";
import { getDashboardThemeTokens, isOppositeThemeTitleColor } from "./dashboardThemeTokens";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";
import { buildDashboardTableColorStyleForPalette } from "@/lib/chartDeTableStyle";
import { resolveChartColors, resolvePaletteId } from "@/lib/chartPalette";
import {
  inferWidgetSyncScopes,
  patchChartDeStyleNested,
  readChartDeStyle,
  stripChartBackgroundStyleOverrides,
  stripChartColorStyleOverrides,
  syncChartWidgetsForDashboardScopes,
  type DashboardWidgetSyncScope,
} from "@/lib/chartDeStyle";
import {
  stripCustomVizDisplayStyleOverrides,
  syncCustomVizWidgetsForColorScheme,
  syncCustomVizWidgetsForDashboardScopes,
  type CustomVizDashboardSyncScope,
} from "./custom-viz/customVizDisplayStyle";

/** 随浅色/深色分别保存的视觉字段（结构类如圆角/间隙不在此列） */
export type ThemeVariantFields = {
  canvasBackground?: string;
  canvasBackgroundImage?: string;
  /** §5.3「仪表板背景」显式设置时为 true；§5.1 主题卡片不覆盖标准底色 */
  canvasBackgroundCustom?: boolean;
  canvasDecorPresetId?: string;
  themeAccent?: string;
  widgetStyle?: Pick<
    WidgetStyleConfig,
    "background" | "borderColor" | "borderWidth" | "borderStyle" | "borderEnabled" | "opacity"
  >;
  titleStyle?: Pick<TitleStyleConfig, "color">;
  dialogStyle?: DialogStyleConfig;
  filterChromeStyle?: Pick<FilterChromeStyleConfig, "titleColor">;
};

export type DashboardThemeVariants = Partial<Record<ColorScheme, ThemeVariantFields>>;

const THEME_ROOT_KEYS = new Set([
  "canvasBackground",
  "canvasBackgroundImage",
  "canvasBackgroundCustom",
  "canvasDecorPresetId",
  "themeAccent",
  "widgetStyle",
  "titleStyle",
  "dialogStyle",
  "filterChromeStyle",
]);

export function defaultThemeVariant(scheme: ColorScheme): ThemeVariantFields {
  const tokens = getDashboardThemeTokens(scheme);
  if (scheme === "dark") {
    return {
      canvasBackground: tokens.canvas,
      canvasBackgroundImage: undefined,
      widgetStyle: {
        background: tokens.widgetShell,
        borderColor: tokens.widgetBorder,
      },
      titleStyle: { color: tokens.title },
      dialogStyle: { background: tokens.dialogBg, fontColor: tokens.dialogFg },
      filterChromeStyle: { titleColor: tokens.filterTitle },
    };
  }
  return {
    canvasBackground: tokens.canvas,
    canvasBackgroundImage: undefined,
    widgetStyle: {
      background: tokens.widgetShell,
      borderColor: tokens.widgetBorder,
    },
    titleStyle: { color: tokens.title },
    dialogStyle: { background: tokens.dialogBg, fontColor: tokens.dialogFg },
    filterChromeStyle: { titleColor: tokens.filterTitle },
  };
}

export function extractThemeVariant(config: DashboardStyleConfig): ThemeVariantFields {
  const ws = config.widgetStyle;
  return {
    canvasBackground: config.canvasBackground,
    canvasBackgroundImage: config.canvasBackgroundImage,
    canvasBackgroundCustom: config.canvasBackgroundCustom,
    canvasDecorPresetId: config.canvasDecorPresetId,
    themeAccent: config.themeAccent,
    widgetStyle: ws
      ? {
          background: ws.background,
          borderColor: ws.borderColor,
          borderWidth: ws.borderWidth,
          borderStyle: ws.borderStyle,
          borderEnabled: ws.borderEnabled,
          opacity: ws.opacity,
        }
      : undefined,
    titleStyle: config.titleStyle?.color ? { color: config.titleStyle.color } : undefined,
    dialogStyle: config.dialogStyle ? { ...config.dialogStyle } : undefined,
    filterChromeStyle: config.filterChromeStyle?.titleColor
      ? { titleColor: config.filterChromeStyle.titleColor }
      : undefined,
  };
}

function mergeThemeVariantIntoConfig(
  config: DashboardStyleConfig,
  variant: ThemeVariantFields,
): DashboardStyleConfig {
  const nextImage = variant.canvasBackgroundImage;
  const nextDecor = variant.canvasDecorPresetId;
  // defaults / extract 常带显式 undefined；勿用它盖掉根上已选的平铺装饰
  const keepRootTile =
    Boolean(config.canvasDecorPresetId && config.canvasDecorPresetId !== "none") ||
    Boolean(config.canvasBackgroundImage?.trim());
  return {
    ...config,
    canvasBackground: variant.canvasBackground,
    canvasBackgroundImage:
      nextImage?.trim() || (keepRootTile ? config.canvasBackgroundImage : nextImage),
    canvasBackgroundCustom: variant.canvasBackgroundCustom,
    canvasDecorPresetId:
      nextDecor && nextDecor !== "none"
        ? nextDecor
        : keepRootTile
          ? config.canvasDecorPresetId
          : nextDecor,
    themeAccent: variant.themeAccent,
    widgetStyle: {
      ...config.widgetStyle,
      ...variant.widgetStyle,
    },
    titleStyle: {
      ...config.titleStyle,
      ...variant.titleStyle,
    },
    dialogStyle: variant.dialogStyle
      ? { ...config.dialogStyle, ...variant.dialogStyle }
      : config.dialogStyle,
    filterChromeStyle: {
      ...config.filterChromeStyle,
      ...variant.filterChromeStyle,
    },
  };
}

function canvasNeedsSchemeReset(config: DashboardStyleConfig, scheme: ColorScheme): boolean {
  if (config.canvasBackgroundCustom) return false;
  const bg = config.canvasBackground?.trim();
  if (scheme === "dark") {
    if (!bg) return true;
    return !isDarkCanvasColor(bg);
  }
  if (!bg) return false;
  return isDarkCanvasColor(bg);
}

function decorNeedsSchemeReset(_config: DashboardStyleConfig, _scheme: ColorScheme): boolean {
  return false;
}

function sanitizeThemeVariant(
  variant: ThemeVariantFields,
  scheme: ColorScheme,
): ThemeVariantFields {
  const defaults = defaultThemeVariant(scheme);
  const keepTileDecor =
    Boolean(variant.canvasBackgroundImage?.trim()) ||
    Boolean(variant.canvasDecorPresetId && variant.canvasDecorPresetId !== "none");
  if (scheme === "dark") {
    if (variant.canvasBackgroundCustom) {
      return variant;
    }
    const bg = variant.canvasBackground?.trim();
    if (!bg || isLightCanvasColor(bg)) {
      return {
        ...defaults,
        ...variant,
        ...defaults,
        canvasBackgroundImage: keepTileDecor ? variant.canvasBackgroundImage : undefined,
        canvasDecorPresetId: keepTileDecor ? variant.canvasDecorPresetId : undefined,
      };
    }
    return variant;
  }
  const bg = variant.canvasBackground?.trim();
  if (!variant.canvasBackgroundCustom && bg && isDarkCanvasColor(bg)) {
    return {
      ...defaults,
      ...variant,
      canvasBackground: defaults.canvasBackground,
      canvasBackgroundImage: keepTileDecor ? variant.canvasBackgroundImage : undefined,
      canvasDecorPresetId: keepTileDecor ? variant.canvasDecorPresetId : defaults.canvasDecorPresetId,
    };
  }
  return variant;
}

function hasDeprecatedThemeAccent(config: DashboardStyleConfig): boolean {
  if (config.themeAccent?.trim()) return true;
  return Boolean(
    config.themeVariants?.light?.themeAccent?.trim() ||
      config.themeVariants?.dark?.themeAccent?.trim(),
  );
}

/** 补齐/纠正单套浅/深 variant，保证切换时有完整标准快照 */
function ensureThemeVariant(
  variant: ThemeVariantFields | undefined,
  scheme: ColorScheme,
  forceDefaults = false,
): ThemeVariantFields {
  const defaults = defaultThemeVariant(scheme);
  if (forceDefaults) return defaults;
  const defined = variant
    ? (Object.fromEntries(
        Object.entries(variant).filter(([, value]) => value !== undefined),
      ) as ThemeVariantFields)
    : {};
  if (!defined.canvasBackgroundCustom) {
    const decorOnly =
      Boolean(defined.canvasBackgroundImage?.trim()) ||
      (Boolean(defined.canvasDecorPresetId) && defined.canvasDecorPresetId !== "none");
    delete defined.canvasBackground;
    if (!decorOnly) {
      delete defined.canvasBackgroundImage;
      delete defined.canvasDecorPresetId;
    }
    defined.canvasBackgroundCustom = undefined;
  }
  return sanitizeThemeVariant({ ...defaults, ...defined }, scheme);
}

/** DE §5.1 主题卡片：套用标准预设，仅保留 §5.3 自定义背景 */
export function resolveThemePresetForSwitch(
  saved: ThemeVariantFields | undefined,
  scheme: ColorScheme,
): ThemeVariantFields {
  const preset = defaultThemeVariant(scheme);
  const hasSavedCanvas =
    saved?.canvasBackgroundCustom ||
    Boolean(saved?.canvasBackgroundImage?.trim()) ||
    Boolean(saved?.canvasDecorPresetId && saved.canvasDecorPresetId !== "none");
  if (!hasSavedCanvas) {
    return preset;
  }
  return ensureThemeVariant(
    {
      ...preset,
      ...(saved?.canvasBackgroundCustom
        ? { canvasBackground: saved.canvasBackground, canvasBackgroundCustom: true as const }
        : {}),
      canvasBackgroundImage: saved?.canvasBackgroundImage,
      canvasDecorPresetId: saved?.canvasDecorPresetId,
    },
    scheme,
  );
}

function hasPersistedThemeVariants(config: DashboardStyleConfig): boolean {
  return Boolean(config.themeVariants?.light || config.themeVariants?.dark);
}

/**
 * DE §5.1 bootstrap：补齐双主题快照，根字段投影为当前 colorScheme。
 * load / save 唯一入口（别名 hydrateDashboardStyleConfig）。
 */
export function bootstrapDashboardStyleConfig(
  config: DashboardStyleConfig,
): DashboardStyleConfig {
  const scheme = config.colorScheme ?? "light";
  const stripAccent = hasDeprecatedThemeAccent(config);
  const hasExplicitTemplateChrome =
    Boolean(config.widgetStyle?.borderColor?.trim()) ||
    Boolean(config.paletteColors?.length);
  let working: DashboardStyleConfig = stripAccent
    ? { ...config, themeAccent: undefined }
    : config;

  if (stripAccent && !hasExplicitTemplateChrome) {
    working = mergeThemeVariantIntoConfig(working, defaultThemeVariant(scheme));
  }

  let light = ensureThemeVariant(working.themeVariants?.light, "light", stripAccent);
  let dark = ensureThemeVariant(working.themeVariants?.dark, "dark", stripAccent);

  const rootActive = extractThemeVariant(working);
  const hasRootCanvas =
    rootActive.canvasBackgroundCustom ||
    Boolean(rootActive.canvasBackgroundImage?.trim()) ||
    Boolean(rootActive.canvasDecorPresetId && rootActive.canvasDecorPresetId !== "none");
  if (hasRootCanvas) {
    const rootCanvasPatch: ThemeVariantFields = {
      ...(rootActive.canvasBackgroundCustom
        ? {
            canvasBackground: rootActive.canvasBackground,
            canvasBackgroundCustom: true as const,
          }
        : {}),
      canvasBackgroundImage: rootActive.canvasBackgroundImage,
      canvasDecorPresetId: rootActive.canvasDecorPresetId,
    };
    if (scheme === "light") {
      light = ensureThemeVariant({ ...light, ...rootCanvasPatch }, "light", stripAccent);
    } else {
      dark = ensureThemeVariant({ ...dark, ...rootCanvasPatch }, "dark", stripAccent);
    }
  }

  if (!hasPersistedThemeVariants(working)) {
    const legacyActive = ensureThemeVariant(extractThemeVariant(working), scheme);
    if (scheme === "light") {
      light = legacyActive;
    } else {
      dark = legacyActive;
    }
  }

  const variants: DashboardThemeVariants = { light, dark };
  const activeVariant = ensureThemeVariant(variants[scheme], scheme);
  const merged = mergeThemeVariantIntoConfig(
    { ...working, themeVariants: variants, colorScheme: scheme },
    activeVariant,
  );

  const normalized = normalizeStyleConfigForColorScheme(merged);
  const syncedActive = ensureThemeVariant(extractThemeVariant(normalized), scheme);

  return normalizeDashboardGapConfig({
    ...normalized,
    themeVariants: {
      light: scheme === "light" ? syncedActive : light,
      dark: scheme === "dark" ? syncedActive : dark,
    },
  });
}

/** @deprecated 使用 bootstrapDashboardStyleConfig */
export function hydrateDashboardStyleConfig(config: DashboardStyleConfig): DashboardStyleConfig {
  return bootstrapDashboardStyleConfig(config);
}

/** 固定主题令牌：仅在未自定义或与另一主题冲突时写入默认字色 */
function applyFixedThemeTypography(config: DashboardStyleConfig): DashboardStyleConfig {
  const scheme = config.colorScheme ?? "light";
  const tokens = getDashboardThemeTokens(scheme);
  const titleColor = config.titleStyle?.color?.trim();
  const filterTitle = config.filterChromeStyle?.titleColor?.trim();
  const dialogBg = config.dialogStyle?.background?.trim();
  const dialogFg = config.dialogStyle?.fontColor?.trim();

  const nextTitle =
    !titleColor || isOppositeThemeTitleColor(titleColor, scheme)
      ? tokens.title
      : titleColor;
  const nextFilterTitle =
    !filterTitle || isOppositeThemeTitleColor(filterTitle, scheme)
      ? tokens.filterTitle
      : filterTitle;

  let nextDialogBg = dialogBg || tokens.dialogBg;
  let nextDialogFg = dialogFg || tokens.dialogFg;
  if (dialogBg) {
    if (scheme === "dark" && isLightCanvasColor(dialogBg)) {
      nextDialogBg = tokens.dialogBg;
    } else if (scheme === "light" && isDarkCanvasColor(dialogBg)) {
      nextDialogBg = tokens.dialogBg;
    }
  }
  if (dialogFg && isOppositeThemeTitleColor(dialogFg, scheme)) {
    nextDialogFg = tokens.dialogFg;
  }

  return {
    ...config,
    titleStyle: { ...config.titleStyle, color: nextTitle },
    filterChromeStyle: { ...config.filterChromeStyle, titleColor: nextFilterTitle },
    dialogStyle: {
      ...config.dialogStyle,
      background: nextDialogBg,
      fontColor: nextDialogFg,
    },
  };
}

/** 加载/切换后纠正与 colorScheme 冲突的浅色渐变、装饰与组件白底 */
export function normalizeStyleConfigForColorScheme(
  config: DashboardStyleConfig,
): DashboardStyleConfig {
  const scheme = config.colorScheme ?? "light";
  const defaults = defaultThemeVariant(scheme);
  const patch: Partial<DashboardStyleConfig> = {};

  if (canvasNeedsSchemeReset(config, scheme)) {
    patch.canvasBackground = defaults.canvasBackground;
  }
  if (decorNeedsSchemeReset(config, scheme)) {
    patch.canvasBackgroundImage = undefined;
    patch.canvasDecorPresetId = undefined;
  }

  const wbg = config.widgetStyle?.background?.trim()?.toLowerCase();
  const legacyLightShell =
    wbg === "#ffffff" || wbg === "#fff" || wbg === "white" || wbg === "rgb(255, 255, 255)";
  if (scheme === "dark" && legacyLightShell) {
    patch.widgetStyle = {
      ...config.widgetStyle,
      background: defaults.widgetStyle?.background,
      borderColor: defaults.widgetStyle?.borderColor,
    };
  }
  if (scheme === "light" && wbg === WIDGET_SHELL_DARK_DEFAULT) {
    patch.widgetStyle = {
      ...config.widgetStyle,
      background: defaults.widgetStyle?.background,
      borderColor: defaults.widgetStyle?.borderColor,
    };
  }

  const merged = applyFixedThemeTypography({ ...config, ...patch });
  const unchanged =
    Object.keys(patch).length === 0 &&
    merged.titleStyle?.color === config.titleStyle?.color &&
    merged.filterChromeStyle?.titleColor === config.filterChromeStyle?.titleColor &&
    merged.dialogStyle?.background === config.dialogStyle?.background &&
    merged.dialogStyle?.fontColor === config.dialogStyle?.fontColor;

  if (unchanged) return config;

  return {
    ...merged,
    themeVariants: {
      ...merged.themeVariants,
      [scheme]: extractThemeVariant(merged),
    },
  };
}

function patchTouchesThemeFields(patch: Partial<DashboardStyleConfig>): boolean {
  return Object.keys(patch).some((key) => THEME_ROOT_KEYS.has(key));
}

/** 细化配置写入时同步当前主题的 variant 快照 */
export function patchDashboardStyle(
  config: DashboardStyleConfig,
  patch: Partial<DashboardStyleConfig>,
): DashboardStyleConfig {
  const merged: DashboardStyleConfig = { ...config, ...patch };
  if (patch.colorScheme != null && patch.colorScheme !== (config.colorScheme ?? "light")) {
    const withVariants = patchTouchesThemeFields(patch)
      ? {
          ...merged,
          themeVariants: {
            ...merged.themeVariants,
            [merged.colorScheme ?? "light"]: extractThemeVariant(merged),
          },
        }
      : merged;
    return normalizeStyleConfigForColorScheme(withVariants);
  }
  if (!patchTouchesThemeFields(patch)) return merged;
  const scheme = merged.colorScheme ?? "light";
  return {
    ...merged,
    themeVariants: {
      ...merged.themeVariants,
      [scheme]: extractThemeVariant(merged),
    },
  };
}

/** 仪表板风格：切换浅色/深色并加载对应 variant（无则套默认预设） */
export function switchDashboardColorScheme(
  config: DashboardStyleConfig,
  nextScheme: ColorScheme,
): DashboardStyleConfig {
  const prevScheme = config.colorScheme ?? "light";
  if (prevScheme === nextScheme) return normalizeStyleConfigForColorScheme(config);

  const variants: DashboardThemeVariants = {
    ...config.themeVariants,
    [prevScheme]: extractThemeVariant(normalizeStyleConfigForColorScheme(config)),
  };
  const loaded = resolveThemePresetForSwitch(variants[nextScheme], nextScheme);
  const merged = mergeThemeVariantIntoConfig(
    { ...config, colorScheme: nextScheme, themeVariants: variants },
    loaded,
  );
  return normalizeStyleConfigForColorScheme({
    ...merged,
    themeVariants: {
      ...variants,
      [nextScheme]: extractThemeVariant(
        normalizeStyleConfigForColorScheme(merged),
      ),
    },
  });
}

/** 看板图表配色 patch：同步表格配色预设，避免 tableColorStyle 滞留在旧主题色 */
export function buildDashboardChartPalettePatch(
  config: DashboardStyleConfig,
  paletteId: string | undefined,
  paletteColors: readonly string[],
): Pick<DashboardStyleConfig, "paletteId" | "paletteColors" | "tableColorStyle"> {
  const resolvedId = resolvePaletteId(paletteId) ?? "default";
  const scheme = config.colorScheme ?? "light";
  return {
    paletteId: resolvedId,
    paletteColors: [...paletteColors],
    tableColorStyle: buildDashboardTableColorStyleForPalette(
      config.tableColorStyle,
      resolvedId,
      scheme,
    ),
  };
}

function normalizeDashboardPalettePatch(
  config: DashboardStyleConfig,
  patch: Partial<DashboardStyleConfig>,
): Partial<DashboardStyleConfig> {
  if (patch.paletteId === undefined && patch.paletteColors === undefined) {
    return patch;
  }
  const resolvedId = resolvePaletteId(patch.paletteId ?? config.paletteId) ?? "default";
  const colors =
    patch.paletteColors ??
    config.paletteColors ??
    resolveChartColors(resolvedId);
  return {
    ...patch,
    ...buildDashboardChartPalettePatch(config, resolvedId, colors),
  };
}

/** 看板配置变更：写 styleConfig 并清除图表组件级同类 override */
function toCustomVizDashboardSyncScopes(
  scopes: ReadonlySet<DashboardWidgetSyncScope>,
): ReadonlySet<CustomVizDashboardSyncScope> {
  const out = new Set<CustomVizDashboardSyncScope>();
  if (scopes.has("title")) out.add("title");
  if (scopes.has("widgetAppearance")) out.add("widgetAppearance");
  if (scopes.has("palette")) out.add("palette");
  return out;
}

export function applyDashboardStylePatch(
  styleConfig: DashboardStyleConfig,
  widgets: LayoutWidget[],
  patch: Partial<DashboardStyleConfig>,
): { styleConfig: DashboardStyleConfig; widgets: LayoutWidget[] } {
  const normalizedPatch = normalizeDashboardPalettePatch(styleConfig, patch);
  const scopes = inferWidgetSyncScopes(normalizedPatch);
  let syncedWidgets =
    scopes.size > 0 ? syncChartWidgetsForDashboardScopes(widgets, scopes) : widgets;
  const customVizScopes = toCustomVizDashboardSyncScopes(scopes);
  if (customVizScopes.size > 0) {
    syncedWidgets = syncCustomVizWidgetsForDashboardScopes(syncedWidgets, customVizScopes);
  }
  return {
    styleConfig: patchDashboardStyle(styleConfig, normalizedPatch),
    widgets: syncedWidgets,
  };
}

/** @deprecated 使用 applyDashboardStylePatch */
export function applyDashboardTitleStylePatch(
  styleConfig: DashboardStyleConfig,
  widgets: LayoutWidget[],
  patch: Partial<TitleStyleConfig>,
): { styleConfig: DashboardStyleConfig; widgets: LayoutWidget[] } {
  return applyDashboardStylePatch(styleConfig, widgets, {
    titleStyle: { ...styleConfig.titleStyle, ...patch },
  });
}

/** 切换主题时同步各图表 deStyle 内区背景与标题字色 */
export function syncChartWidgetsForColorScheme(
  widgets: LayoutWidget[],
  scheme: ColorScheme,
): LayoutWidget[] {
  const tokens = getDashboardThemeTokens(scheme);
  return widgets.map((widget) => {
    if (widget.type !== "chart" || !widget.chartConfig) return widget;
    let chartConfig = widget.chartConfig;
    const de = readChartDeStyle(chartConfig);
    const bg = de.background?.background?.trim();
    const titleColor = de.title?.color?.trim();

    if (bg) {
      const shellOk =
        scheme === "dark" ? isDarkWidgetShellColor(bg) : !isDarkWidgetShellColor(bg);
      if (!shellOk) {
        chartConfig = patchChartDeStyleNested(chartConfig, "background", {
          background: tokens.widgetShell,
        });
      }
    }

    if (
      !titleColor ||
      isOppositeThemeTitleColor(titleColor, scheme) ||
      titleColor.toLowerCase() === (scheme === "dark" ? "#1d2939" : "#f2f4f7")
    ) {
      chartConfig = patchChartDeStyleNested(chartConfig, "title", {
        color: tokens.title,
      });
    }

    return chartConfig === widget.chartConfig
      ? widget
      : { ...widget, chartConfig };
  });
}

/** 仪表板风格切换：全局 styleConfig + 全部图表组件背景一并初始化 */
export function switchDashboardThemeBundle(
  styleConfig: DashboardStyleConfig,
  widgets: LayoutWidget[],
  nextScheme: ColorScheme,
): { styleConfig: DashboardStyleConfig; widgets: LayoutWidget[] } {
  const nextStyle = switchDashboardColorScheme(styleConfig, nextScheme);
  let syncedWidgets = syncChartWidgetsForColorScheme(widgets, nextScheme);
  syncedWidgets = syncCustomVizWidgetsForColorScheme(syncedWidgets, nextScheme);
  return {
    styleConfig: nextStyle,
    widgets: syncedWidgets,
  };
}

export function resetActiveThemePreset(config: DashboardStyleConfig): DashboardStyleConfig {
  const scheme = config.colorScheme ?? "light";
  const preset = defaultThemeVariant(scheme);
  return patchDashboardStyle(mergeThemeVariantIntoConfig(config, preset), {});
}

function defaultDashboardTableColorStyle(scheme: ColorScheme): ChartDeTableStyle {
  const tokens = getDashboardThemeTokens(scheme);
  return {
    headerBg: tokens.tableHeaderBg,
    headerFg: tokens.tableHeaderFg,
    bodyFg: tokens.tableBodyFg,
    borderColor: tokens.tableBorder,
    paginationFg: tokens.textMuted,
    emptyHintFg: tokens.stateText,
  };
}

/** 将看板 styleConfig 中颜色与背景重置为当前 colorScheme 的主题默认（保留结构类字段） */
export function buildDashboardColorResetPatch(
  config: DashboardStyleConfig,
): Partial<DashboardStyleConfig> {
  const scheme = config.colorScheme ?? "light";
  const preset = defaultThemeVariant(scheme);
  const tokens = getDashboardThemeTokens(scheme);
  const tooltipBackground = scheme === "dark" ? tokens.dialogBg : "#344054";

  return {
    canvasBackground: preset.canvasBackground,
    canvasBackgroundCustom: undefined,
    canvasBackgroundImage: undefined,
    canvasDecorPresetId: undefined,
    widgetStyle: {
      ...config.widgetStyle,
      background: preset.widgetStyle?.background,
      backgroundImage: undefined,
      backgroundMode: undefined,
      framePresetId: undefined,
      frameColor: undefined,
      frameOpacity: undefined,
      opacity: undefined,
      backdropBlur: undefined,
      borderColor: preset.widgetStyle?.borderColor,
    },
    titleStyle: {
      ...config.titleStyle,
      color: preset.titleStyle?.color,
    },
    dialogStyle: preset.dialogStyle,
    filterChromeStyle: {
      ...config.filterChromeStyle,
      titleColor: preset.filterChromeStyle?.titleColor,
    },
    chartLabelStyle: {
      ...config.chartLabelStyle,
      color: tokens.chartAxis,
    },
    chartTooltipStyle: {
      ...config.chartTooltipStyle,
      color: "#ffffff",
      background: tooltipBackground,
    },
    tableColorStyle: defaultDashboardTableColorStyle(scheme),
  };
}

function stripWidgetStyleBackgroundOverrides(
  ws: WidgetStyleConfig | undefined,
): WidgetStyleConfig | undefined {
  if (!ws) return ws;
  const {
    background: _bg,
    backgroundImage: _bi,
    backgroundMode: _bm,
    framePresetId: _fp,
    frameColor: _fc,
    frameOpacity: _fo,
    opacity: _op,
    backdropBlur: _bb,
    borderColor: _bc,
    ...rest
  } = ws;
  const hasBackgroundOverride =
    _bg !== undefined ||
    _bi !== undefined ||
    _bm !== undefined ||
    _fp !== undefined ||
    _fc !== undefined ||
    _fo !== undefined ||
    _op !== undefined ||
    _bb !== undefined ||
    _bc !== undefined;
  if (!hasBackgroundOverride) return ws;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function stripLayoutWidgetColorOverrides(widget: LayoutWidget): LayoutWidget {
  if (widget.type === "chart" && widget.chartConfig) {
    let chartConfig = stripChartBackgroundStyleOverrides(widget.chartConfig);
    chartConfig = stripChartColorStyleOverrides(chartConfig);
    return chartConfig === widget.chartConfig ? widget : { ...widget, chartConfig };
  }

  if (widget.type === "text" && widget.textConfig) {
    const widgetStyle = stripWidgetStyleBackgroundOverrides(widget.textConfig.widgetStyle);
    if (widgetStyle === widget.textConfig.widgetStyle) return widget;
    return {
      ...widget,
      textConfig: { ...widget.textConfig, widgetStyle },
    };
  }

  if (widget.type === "media" && widget.mediaConfig) {
    const mediaConfig = { ...widget.mediaConfig };
    let changed = false;
    if (mediaConfig.background) {
      mediaConfig.background = "";
      changed = true;
    }
    const widgetStyle = stripWidgetStyleBackgroundOverrides(mediaConfig.widgetStyle);
    if (widgetStyle !== mediaConfig.widgetStyle) {
      mediaConfig.widgetStyle = widgetStyle;
      changed = true;
    }
    return changed ? { ...widget, mediaConfig } : widget;
  }

  if (widget.type === "tabs" && widget.tabsConfig) {
    const tabsConfig = { ...widget.tabsConfig };
    let changed = false;
    if (tabsConfig.headStyle) {
      const { activeColor, inactiveColor, barBackground, ...rest } = tabsConfig.headStyle;
      if (activeColor !== undefined || inactiveColor !== undefined || barBackground !== undefined) {
        tabsConfig.headStyle = Object.keys(rest).length > 0 ? rest : undefined;
        changed = true;
      }
    }
    const widgetStyle = stripWidgetStyleBackgroundOverrides(tabsConfig.widgetStyle);
    if (widgetStyle !== tabsConfig.widgetStyle) {
      tabsConfig.widgetStyle = widgetStyle;
      changed = true;
    }
    return changed ? { ...widget, tabsConfig } : widget;
  }

  if (widget.type === "customViz" && widget.customVizConfig) {
    const customVizConfig = { ...widget.customVizConfig };
    let changed = false;

    const widgetStyle = stripWidgetStyleBackgroundOverrides(customVizConfig.widgetStyle);
    if (widgetStyle !== customVizConfig.widgetStyle) {
      customVizConfig.widgetStyle = widgetStyle;
      changed = true;
    }

    const displayStyle = stripCustomVizDisplayStyleOverrides(customVizConfig.displayStyle);
    if (displayStyle !== customVizConfig.displayStyle) {
      customVizConfig.displayStyle = displayStyle;
      changed = true;
    }

    return changed ? { ...widget, customVizConfig } : widget;
  }

  return widget;
}

/** 将看板与全部组件的颜色样式统一初始化到当前选中的主题 */
export function resetDashboardColorsToActiveThemeBundle(
  styleConfig: DashboardStyleConfig,
  widgets: LayoutWidget[],
): { styleConfig: DashboardStyleConfig; widgets: LayoutWidget[] } {
  const patch = buildDashboardColorResetPatch(styleConfig);
  const patchedStyle = patchDashboardStyle(styleConfig, patch);
  const normalizedStyle = normalizeStyleConfigForColorScheme(patchedStyle);
  const syncedWidgets = widgets.map(stripLayoutWidgetColorOverrides);

  return {
    styleConfig: {
      ...normalizedStyle,
      themeVariants: {
        ...normalizedStyle.themeVariants,
        [normalizedStyle.colorScheme ?? "light"]: extractThemeVariant(normalizedStyle),
      },
    },
    widgets: syncedWidgets,
  };
}

export function initializeDualThemePresets(config: DashboardStyleConfig): DashboardStyleConfig {
  return bootstrapDashboardStyleConfig(config);
}
