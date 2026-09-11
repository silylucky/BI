import type { CSSProperties } from "react";
import type { ChartDeTableStyle } from "@/lib/chartDeTableStyle";
import type {
  WidgetBackgroundImageFit,
  WidgetBackgroundImagePosition,
} from "@/lib/widgetBackgroundImageFit";
import { resolveWidgetBackgroundImageLayerStyle } from "@/lib/widgetBackgroundImageFit";
import { buildWidgetBackgroundPresentation } from "@/lib/widgetStylePresentation";
import type { DashboardThemeVariants } from "./dashboardThemeVariants";
import { getDashboardThemeTokens } from "./dashboardThemeTokens";
import { componentGapShellStyle } from "./componentGapRuntime";
import type { GapPreset } from "./gapPolicy";
import { DEFAULT_CHART_RESULT_LIMIT } from "@/lib/chartQueryLimitDefaults";

export type { GapPreset } from "./gapPolicy";
export {
  buildDashboardGapPatch,
  DEFAULT_CUSTOM_GRID_GAP,
  DEFAULT_CUSTOM_PIXEL_GAP,
  DEFAULT_PIXEL_GUTTER,
  DEFAULT_WIDGET_GAP,
  DASHBOARD_SHAPE_GAP_VAR,
  GAP_POLICY_PRESET_TABLE,
  GAP_PRESET_PX,
  inferPixelGapPreset,
  inferWidgetGapPreset,
  normalizeDashboardGapConfig,
  normalizeDashboardGapForPersist,
  PIXEL_GAP_PRESET_PX,
  resolveDashboardComponentGap,
  resolveDashboardGapUiState,
  resolvePixelGutter,
  resolveWidgetGap,
  type DashboardGapUiState,
  type GapPatchAction,
} from "./gapPolicy";
export {
  componentGapShellStyle,
  resolveComponentGapRuntime,
  type CanvasGapMode,
  type ComponentGapRuntime,
} from "./componentGapRuntime";

export type ScaleMode = "canvas" | "component";
export type ColorScheme = "light" | "dark";
export type NumberFormatType = "auto" | "number" | "percent" | "currency";

export type SpacingMode = "unified" | "individual";

export type WidgetStyleConfig = {
  background?: string;
  backgroundImage?: string;
  /** DE 背景区总开关 */
  backgroundShow?: boolean;
  /** 图片 | 装饰边框（单图）| 线框（看板全局） */
  backgroundMode?: "image" | "frame" | "border";
  /** 装饰边框预设 frame-1 … frame-9 */
  framePresetId?: string;
  /** 装饰边框着色 */
  frameColor?: string;
  /** 装饰边框不透明度（0–1）；未设时回退 opacity */
  frameOpacity?: number;
  /** 组件底色不透明度（0–1） */
  opacity?: number;
  /** 底图不透明度（0–1）；未设时默认 1，不继承 opacity */
  backgroundImageOpacity?: number;
  /** 底图适应方式；未设时 stretch（100% 100%，兼容存量） */
  backgroundImageFit?: WidgetBackgroundImageFit;
  /** 底图对齐（widthFit/contain/cover 等时生效） */
  backgroundImagePosition?: WidgetBackgroundImagePosition;
  backdropBlur?: number;
  borderRadius?: number;
  borderRadiusTopLeft?: number;
  borderRadiusTopRight?: number;
  borderRadiusBottomLeft?: number;
  borderRadiusBottomRight?: number;
  radiusMode?: SpacingMode;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingMode?: SpacingMode;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  /** 默认 true；false 时不绘制组件外框 */
  borderEnabled?: boolean;
};

export const WIDGET_BORDER_STYLES = [
  { value: "solid", label: "实线" },
  { value: "dashed", label: "虚线" },
  { value: "dotted", label: "点线" },
] as const;

export type DialogStyleConfig = {
  background?: string;
  fontColor?: string;
};

/** 对标 DE 整体配置开关 */
export type DashboardChromeConfig = {
  /** 图表加载骨架/提示 */
  showChartLoadingHint?: boolean;
  /** 编辑态组件右键菜单（style JSON 历史字段名 showFloatingActions） */
  showFloatingActions?: boolean;
  /** 编辑态组件标题栏操作按钮 */
  showChartActionButtons?: boolean;
  /** 编辑态画布辅助对齐网格 */
  showAuxiliaryGrid?: boolean;
  /** 像素画布：对齐吸附细项（阈值、边/中心等） */
  alignmentSnap?: DashboardAlignmentSnapConfig;
};

/** 编辑态对齐吸附（存于 styleConfig.chrome.alignmentSnap） */
export type DashboardAlignmentSnapConfig = {
  /** 组件边/中心对齐吸附；未设时随 showAuxiliaryGrid */
  enableMarkLineSnap?: boolean;
  /** 碰撞重合阈值（画布 px）：双向重叠超过该值才触发推挤；默认 40 */
  collisionOverlapBufferPx?: number;
  /** 组件对齐吸附灵敏度（屏幕 px）：参考线触发距离；默认 10 */
  markLineThresholdPx?: number;
  /** @deprecated 仅内部固定 20px 点阵，不再暴露配置 UI */
  gridCellPx?: number;
  /** 吸附边线（贴边/对齐边）；默认 true */
  snapEdges?: boolean;
  /** 吸附中心线；默认 true */
  snapCenters?: boolean;
};

export type TitleStyleConfig = {
  /** 看板默认：未单独配置的图表是否显示标题 */
  show?: boolean;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  align?: "left" | "center" | "right";
  letterSpacing?: number;
  /** 对标 DE：标题字体阴影 */
  shadow?: boolean;
};

export type FilterChromeStyleConfig = {
  titlePosition?: "top" | "left";
  titleColor?: string;
};

export type FilterControlStyleConfig = {
  borderRadius?: number;
  height?: number;
};

export type NumberFormatConfig = {
  decimals?: number;
  type?: NumberFormatType;
  unit?: string;
  /** 默认 true；对标 DE 千分符 */
  thousandSeparator?: boolean;
};

export type DashboardSurfaceKind = "dashboard" | "data-screen";

/** Phase 3 挂点：多屏轮播投放（仅 schema，播放逻辑未实现） */
export type DataScreenPlaylistConfig = {
  screenIds: string[];
  intervalSec: number;
};

export type DashboardStyleConfig = {
  /** dashboard=普通看板；data-screen=数据大屏（独立列表入口） */
  surfaceKind?: DashboardSurfaceKind;
  /** 多屏轮播配置挂点（Phase 3） */
  screenPlaylist?: DataScreenPlaylistConfig;
  colorScheme?: ColorScheme;
  themeAccent?: string;
  fontFamily?: string;
  gapPreset?: GapPreset;
  widgetGap?: number;
  pixelGutter?: number;
  scaleMode?: ScaleMode;
  canvasBackground?: string;
  canvasBackgroundImage?: string;
  /** 画布自定义底图适应方式；默认 cover */
  canvasBackgroundImageFit?: WidgetBackgroundImageFit;
  canvasBackgroundImagePosition?: WidgetBackgroundImagePosition;
  /** §5.3「仪表板背景」显式设置；未设置时 §5.1 主题卡片使用标准底色 */
  canvasBackgroundCustom?: boolean;
  /** 背景装饰预设 id（点阵/网格/渐变等） */
  canvasDecorPresetId?: string;
  refreshIntervalSec?: number;
  defaultQueryLimit?: number;
  widgetStyle?: WidgetStyleConfig;
  paletteId?: string;
  paletteColors?: string[];
  /** 看板默认配色不透明度（0–1） */
  paletteOpacity?: number;
  /** 看板默认系列渐变填充 */
  seriesGradient?: boolean;
  /** 看板默认立体视觉（VCDS 2.5D） */
  depthVisual?: "off" | "standard" | "enhanced";
  /** 看板默认显示数据标签 */
  chartLabelShow?: boolean;
  /** 看板默认标签样式 */
  chartLabelStyle?: { fontSize?: number; color?: string };
  /** 看板默认显示图表提示 */
  tooltipShow?: boolean;
  /** 看板默认提示框样式 */
  chartTooltipStyle?: { fontSize?: number; color?: string; background?: string };
  /** 看板默认明细表配色（对标 DE 仪表板配置 · 表格配色） */
  tableColorStyle?: ChartDeTableStyle;
  titleStyle?: TitleStyleConfig;
  filterChromeStyle?: FilterChromeStyleConfig;
  filterControlStyle?: FilterControlStyleConfig;
  numberFormat?: NumberFormatConfig;
  actionIconColor?: string;
  drillLevelColors?: string[];
  dialogStyle?: DialogStyleConfig;
  chrome?: DashboardChromeConfig;
  /** 浅色/深色各自保存的视觉配置（对标 DE 双主题） */
  themeVariants?: DashboardThemeVariants;
};

export const CANVAS_BG_SWATCHES = [
  "#ffffff",
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#0f172a",
  "#1e293b",
] as const;

export const CANVAS_BG_RECOMMENDED = [
  { color: "#ffffff", label: "纯白" },
  { color: "#f8fafc", label: "雪色" },
  { color: "#f1f5f9", label: "雾灰" },
  { color: "#e2e8f0", label: "银灰" },
  { color: "#fef3c7", label: "暖米" },
  { color: "#ecfdf5", label: "薄荷" },
  { color: "#eff6ff", label: "浅蓝" },
  { color: "#fce7f3", label: "浅粉" },
  { color: "#0f172a", label: "墨蓝" },
  { color: "#1e293b", label: "深蓝" },
  { color: "#171717", label: "炭黑" },
] as const;

/** 组件/图表内容区背景推荐色 */
export const SURFACE_COLOR_RECOMMENDED = CANVAS_BG_RECOMMENDED;

export const WIDGET_BORDER_RECOMMENDED = [
  { color: "#e4e7ec", label: "边线灰" },
  { color: "#d0d5dd", label: "浅灰" },
  { color: "#98a2b3", label: "中灰" },
  { color: "#667085", label: "深灰" },
  { color: "#344054", label: "墨灰" },
  { color: "#465fff", label: "品牌" },
] as const;

export const TEXT_COLOR_RECOMMENDED = [
  { color: "#101828", label: "主文" },
  { color: "#344054", label: "正文" },
  { color: "#667085", label: "次要" },
  { color: "#98a2b3", label: "弱化" },
  { color: "#f2f4f7", label: "浅字" },
  { color: "#ffffff", label: "白字" },
] as const;

export const HIGHLIGHT_COLOR_RECOMMENDED = [
  { color: "#fef08a", label: "浅黄" },
  { color: "#bbf7d0", label: "浅绿" },
  { color: "#bfdbfe", label: "浅蓝" },
  { color: "#fbcfe8", label: "浅粉" },
  { color: "#e5e7eb", label: "浅灰" },
] as const;

export const DASHBOARD_FONT_OPTIONS = [
  { value: "", label: "默认字体 / System" },
  {
    value: '"Microsoft YaHei", "PingFang SC", sans-serif',
    label: "微软雅黑",
  },
  {
    value: '"PingFang SC", "Microsoft YaHei", sans-serif',
    label: "苹方",
  },
  { value: '"SimSun", "Songti SC", serif', label: "宋体" },
  { value: 'Arial, "Helvetica Neue", sans-serif', label: "Arial" },
  { value: "Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: '"Times New Roman", Times, serif', label: "Times New Roman" },
  { value: 'Georgia, "Times New Roman", serif', label: "Georgia" },
  { value: "Roboto, Arial, sans-serif", label: "Roboto" },
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: '"Segoe UI", Tahoma, sans-serif', label: "Segoe UI" },
  { value: "Tahoma, Arial, sans-serif", label: "Tahoma" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
] as const;

const LEGACY_DASHBOARD_FONT_MAP: Record<string, string> = {
  "Outfit, system-ui, sans-serif": DASHBOARD_FONT_OPTIONS[1].value,
  '"Noto Sans SC", system-ui, sans-serif': DASHBOARD_FONT_OPTIONS[1].value,
  '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif':
    DASHBOARD_FONT_OPTIONS[1].value,
  'Arial, Helvetica, "Helvetica Neue", sans-serif': DASHBOARD_FONT_OPTIONS[5].value,
  '"SimSun", "Songti SC", "STSong", Georgia, serif': DASHBOARD_FONT_OPTIONS[4].value,
  "Georgia, serif": DASHBOARD_FONT_OPTIONS[8].value,
};

/** 将已存 fontFamily 映射到当前选项 value */
export function resolveDashboardFontOptionValue(fontFamily?: string): string {
  if (!fontFamily) return "";
  const normalized = LEGACY_DASHBOARD_FONT_MAP[fontFamily] ?? fontFamily;
  const match = DASHBOARD_FONT_OPTIONS.find((opt) => opt.value === normalized);
  return match?.value ?? normalized;
}

export function dashboardFontSelectValue(fontFamily?: string): string {
  const resolved = resolveDashboardFontOptionValue(fontFamily);
  if (!resolved) return "__default__";
  const known = DASHBOARD_FONT_OPTIONS.some((opt) => opt.value === resolved);
  return known ? resolved : "__custom__";
}

export const DASHBOARD_REFRESH_PRESETS = [
  { value: "off", label: "请选择" },
  { value: "60", label: "1 分钟" },
  { value: "300", label: "5 分钟" },
  { value: "600", label: "10 分钟" },
  { value: "900", label: "15 分钟" },
  { value: "1800", label: "30 分钟" },
  { value: "3600", label: "60 分钟" },
  { value: "custom", label: "自定义" },
] as const;

export function resolveDashboardRefreshPreset(sec?: number): string {
  if (sec == null || sec <= 0) return "off";
  const hit = DASHBOARD_REFRESH_PRESETS.find(
    (p) => p.value !== "off" && p.value !== "custom" && Number(p.value) === sec,
  );
  return hit?.value ?? "custom";
}

import {
  decorTileBackgroundLayers,
  decorTileDataUrl,
  decorTileSize,
  isDecorPresetId,
  type DecorPresetId,
} from "./canvasDecorPatterns";

function tileDecorPresetEntry(
  id: DecorPresetId,
  label: string,
  underlay: string,
): CanvasDecorPreset {
  const image = decorTileDataUrl(id, "light", "canvas");
  const tileSize = decorTileSize(id, "canvas");
  return {
    id,
    label,
    image,
    tileSize,
    previewStyle: {
      backgroundColor: underlay,
      ...decorTileBackgroundLayers(id, "light", "canvas"),
    },
  };
}

const DECOR_GRADIENT_BY_SCHEME: Record<string, { light: string; dark: string }> = {
  "gradient-soft": {
    light: "linear-gradient(160deg, #eff6ff 0%, #f8fafc 45%, #fef3c7 100%)",
    dark: "linear-gradient(160deg, #0f172a 0%, #1e293b 48%, #172554 100%)",
  },
  "gradient-brand": {
    light: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 52%, #ffffff 100%)",
    dark: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)",
  },
  "gradient-radial": {
    light: "radial-gradient(ellipse 90% 70% at 50% -10%, #e0e7ff 0%, #f8fafc 50%, #ffffff 100%)",
    dark: "radial-gradient(ellipse 90% 70% at 50% -10%, #312e81 0%, #0f172a 55%, #020617 100%)",
  },
};

export function decorGradientForScheme(presetId: string, scheme: ColorScheme = "light"): string | undefined {
  return DECOR_GRADIENT_BY_SCHEME[presetId]?.[scheme];
}

/** 模板 seed / hydrate：仅有 decor id 时物化为可渲染的画布底色或平铺纹理 */
export function materializeDecorStyleConfig(
  config: DashboardStyleConfig,
): DashboardStyleConfig {
  const scheme = config.colorScheme ?? "light";
  const hasImage = Boolean(config.canvasBackgroundImage?.trim());
  const presetId = config.canvasDecorPresetId ?? resolveCanvasDecorPresetId(config);

  // 平铺装饰：即使已有自定义底色，缺 image 时也必须补回（否则松手 hydrate 后点阵消失）
  if (!hasImage && presetId && isDecorPresetId(presetId)) {
    const patch = patchDecorPresetStyle(presetId, config);
    if (Object.keys(patch).length === 0) return config;
    return { ...config, ...patch };
  }

  const hasCustomBg =
    Boolean(config.canvasBackgroundCustom) && Boolean(config.canvasBackground?.trim());
  if (hasImage || hasCustomBg) {
    return config;
  }

  if (!presetId || presetId === "none") {
    return config;
  }

  if (GRADIENT_DECOR_PRESET_IDS.has(presetId)) {
    const gradient = decorGradientForScheme(presetId, scheme);
    if (!gradient) return config;
    return {
      ...config,
      canvasBackground: gradient,
      canvasBackgroundCustom: true,
      canvasDecorPresetId: presetId,
    };
  }

  const patch = patchDecorPresetStyle(presetId, config);
  if (Object.keys(patch).length === 0) return config;
  return { ...config, ...patch };
}

const GRADIENT_DECOR_PRESET_IDS = new Set(Object.keys(DECOR_GRADIENT_BY_SCHEME));

export type CanvasDecorPreset = {
  id: string;
  label: string;
  image?: string;
  /** 平铺装饰（点阵/网格）的瓦片尺寸；照片类背景不设 */
  tileSize?: { width: number; height: number };
  canvasBackground?: string;
  previewStyle: CSSProperties;
};

export const CANVAS_BG_DECOR_PRESETS: CanvasDecorPreset[] = [
  {
    id: "none",
    label: "无装饰",
    previewStyle: { backgroundColor: "#ffffff" },
  },
  tileDecorPresetEntry("dots", "点阵", "#f8fafc"),
  tileDecorPresetEntry("grid", "细网格", "#ffffff"),
  tileDecorPresetEntry("cross", "十字线", "#f8fafc"),
  tileDecorPresetEntry("diagonal", "斜纹", "#ffffff"),
];

/** 面板可选：仅平铺纹理，不改画布底色（渐变请用「画布底色」） */
export const CANVAS_TILE_DECOR_PRESETS = CANVAS_BG_DECOR_PRESETS.filter(
  (preset) => preset.id === "none" || Boolean(preset.tileSize),
);

export const CANVAS_BG_LIGHT_DEFAULT = "#ffffff";
export const CANVAS_BG_DARK_DEFAULT = "#0f172a";

/** 浅色主题常见默认底（与 colorScheme 冲突时随主题纠正） */
export const LIGHT_THEME_CANVAS_VALUES = new Set([
  CANVAS_BG_LIGHT_DEFAULT,
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#ffffff",
]);

export const DARK_THEME_CANVAS_VALUES = new Set([
  CANVAS_BG_DARK_DEFAULT,
  "#1e293b",
  "#171717",
  "#1e293b",
]);

export const LIGHT_WIDGET_SHELL_VALUES = new Set(["#ffffff", "#fff", "white", "rgb(255, 255, 255)"]);

export const WIDGET_SHELL_DARK_DEFAULT = "#1e293b";

export const DARK_WIDGET_SHELL_VALUES = new Set([
  WIDGET_SHELL_DARK_DEFAULT,
  CANVAS_BG_DARK_DEFAULT,
  "#171717",
  "#1d2939",
  "#475569",
]);

export function isThemeDefaultCanvasColor(
  bg: string | undefined,
  scheme: ColorScheme,
): boolean {
  if (!bg?.trim()) return true;
  const normalized = bg.trim().toLowerCase();
  const base = getDashboardThemeTokens(scheme).canvas.toLowerCase();
  if (normalized === base) return true;
  return scheme === "dark"
    ? DARK_THEME_CANVAS_VALUES.has(normalized)
    : LIGHT_THEME_CANVAS_VALUES.has(normalized);
}

export function isThemeDefaultShellBackground(
  bg: string | undefined,
  scheme: ColorScheme,
): boolean {
  if (!bg?.trim()) return true;
  const normalized = bg.trim().toLowerCase();
  const base = getDashboardThemeTokens(scheme).widgetShell.toLowerCase();
  if (normalized === base) return true;
  return scheme === "dark"
    ? DARK_WIDGET_SHELL_VALUES.has(normalized)
    : LIGHT_WIDGET_SHELL_VALUES.has(normalized);
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(normalized);
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) {
    digits = digits.split("").map((char) => char + char).join("");
  }
  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
  ];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const transform = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

/** 浅色画布色（推荐色板亮色、常见默认底与渐变） */
export function isLightCanvasColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (LIGHT_THEME_CANVAS_VALUES.has(normalized)) return true;
  if (normalized.startsWith("linear-gradient") || normalized.startsWith("radial-gradient")) {
    return true;
  }
  for (const { color } of CANVAS_BG_RECOMMENDED) {
    if (color === normalized && !DARK_THEME_CANVAS_VALUES.has(color)) return true;
  }
  return false;
}

export function isDarkWidgetShellColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (DARK_WIDGET_SHELL_VALUES.has(normalized)) return true;
  const rgb = parseHexRgb(normalized);
  if (rgb) return relativeLuminance(...rgb) < 0.1;
  return false;
}

export function isDarkCanvasColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return DARK_THEME_CANVAS_VALUES.has(normalized);
}

export function coerceWidgetSurfaceBackground(
  value: string | undefined,
  colorScheme: ColorScheme = "light",
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return colorScheme === "dark" ? WIDGET_SHELL_DARK_DEFAULT : undefined;
  return trimmed;
}

/** colorScheme 与显式底色/组件底不一致时，以 colorScheme 为准（避免「挂了 dark 仍是白底」） */
export function effectiveCanvasBackground(config: DashboardStyleConfig): string | undefined {
  const scheme = config.colorScheme ?? "light";
  const hasImage = Boolean(config.canvasBackgroundImage?.trim());
  const hasCustomSolid = Boolean(config.canvasBackgroundCustom && config.canvasBackground?.trim());
  if (!hasImage && !hasCustomSolid) return undefined;

  const bg = config.canvasBackground?.trim();
  if (config.canvasBackgroundCustom) {
    return bg || undefined;
  }
  if (hasImage) {
    if (scheme === "dark" && (!bg || !isDarkCanvasColor(bg))) {
      return CANVAS_BG_DARK_DEFAULT;
    }
    return config.canvasBackground;
  }
  if (!bg) return undefined;
  if (scheme === "dark" && !isDarkCanvasColor(bg)) {
    return CANVAS_BG_DARK_DEFAULT;
  }
  if (scheme === "light" && isDarkCanvasColor(bg)) {
    return CANVAS_BG_LIGHT_DEFAULT;
  }
  return config.canvasBackground;
}

export function effectiveWidgetShellBackground(
  config: DashboardStyleConfig,
): string | undefined {
  return coerceWidgetSurfaceBackground(config.widgetStyle?.background, config.colorScheme ?? "light");
}

/** 用于图表/表格主题推断的组件实底色（hex / gradient 字符串） */
export function resolveWidgetShellPaintColor(
  config: DashboardStyleConfig | undefined,
): string | undefined {
  if (!config) return undefined;
  const scheme = config.colorScheme ?? "light";
  const tokens = getDashboardThemeTokens(scheme);
  const custom = config.widgetStyle?.background?.trim();
  if (custom && !isThemeDefaultShellBackground(custom, scheme)) {
    return coerceWidgetSurfaceBackground(custom, scheme) ?? tokens.widgetShell;
  }
  return effectiveWidgetShellBackground(config) ?? tokens.widgetShell;
}

function isLegacyDecorGradient(bg: string | undefined): boolean {
  const trimmed = bg?.trim();
  if (!trimmed) return false;
  for (const presetId of GRADIENT_DECOR_PRESET_IDS) {
    if (trimmed === decorGradientForScheme(presetId, "light")) return true;
    if (trimmed === decorGradientForScheme(presetId, "dark")) return true;
  }
  return false;
}

export function resolveCanvasDecorPresetIdForPanel(config: DashboardStyleConfig): string {
  const id = resolveCanvasDecorPresetId(config);
  if (GRADIENT_DECOR_PRESET_IDS.has(id) || id === "custom") return "none";
  return id;
}

export function resolveCanvasDecorPresetId(config: DashboardStyleConfig): string {
  if (config.canvasDecorPresetId) return config.canvasDecorPresetId;
  const image = config.canvasBackgroundImage?.trim();
  if (image) {
    const preset = CANVAS_BG_DECOR_PRESETS.find((item) => item.image === image);
    if (preset) return preset.id;
    return "custom";
  }
  const bg = config.canvasBackground?.trim();
  if (bg) {
    for (const presetId of GRADIENT_DECOR_PRESET_IDS) {
      const light = decorGradientForScheme(presetId, "light");
      const dark = decorGradientForScheme(presetId, "dark");
      if (bg === light || bg === dark) return presetId;
    }
    if (bg.startsWith("linear-gradient") || bg.startsWith("radial-gradient")) {
      return "gradient-soft";
    }
  }
  return "none";
}

/** 切换为「无装饰」：清除纹理；渐变预设底色一并还原，保留用户自定义纯色 */
export function patchDecorNoneStyle(
  config: DashboardStyleConfig,
): Partial<DashboardStyleConfig> {
  const patch: Partial<DashboardStyleConfig> = {
    canvasBackgroundImage: undefined,
    canvasDecorPresetId: undefined,
  };
  const presetId = config.canvasDecorPresetId ?? resolveCanvasDecorPresetId(config);
  if (GRADIENT_DECOR_PRESET_IDS.has(presetId)) {
    const scheme = config.colorScheme ?? "light";
    const bg = config.canvasBackground?.trim();
    const expected = decorGradientForScheme(presetId, scheme);
    if (bg && expected && bg === expected) {
      patch.canvasBackground = undefined;
      patch.canvasBackgroundCustom = false;
    }
  }
  return patch;
}

export function defaultSolidArtboardColor(scheme: ColorScheme = "light"): string {
  return scheme === "dark" ? CANVAS_BG_DARK_DEFAULT : "#f8fafc";
}

function decorTileImageForScheme(presetId: string, scheme: ColorScheme): string | undefined {
  if (!isDecorPresetId(presetId)) return undefined;
  return decorTileDataUrl(presetId, scheme, "canvas");
}

/** 选中展示向背景（纹理/自定义图）时关闭辅助对齐网格，避免与底纹叠层混淆 */
export function patchChromeHideAuxiliaryGrid(
  config: DashboardStyleConfig,
): Pick<DashboardStyleConfig, "chrome"> {
  return {
    chrome: {
      ...config.chrome,
      showAuxiliaryGrid: false,
    },
  };
}

/** 面板 / 画布统一：装饰预设 → styleConfig 补丁（仅平铺纹理，不覆盖用户底色） */
export function patchDecorPresetStyle(
  presetId: string,
  config: DashboardStyleConfig,
): Partial<DashboardStyleConfig> {
  if (presetId === "none") return patchDecorNoneStyle(config);
  if (GRADIENT_DECOR_PRESET_IDS.has(presetId)) return patchDecorNoneStyle(config);

  const preset = CANVAS_BG_DECOR_PRESETS.find((item) => item.id === presetId);
  if (!preset?.tileSize) return {};

  const scheme = config.colorScheme ?? "light";
  const raw = config.canvasBackground?.trim();
  const cleared = raw && isLegacyDecorGradient(raw) ? undefined : raw;
  const keepSolid =
    Boolean(cleared) &&
    !cleared!.startsWith("linear-gradient") &&
    !cleared!.startsWith("radial-gradient");

  const patch: Partial<DashboardStyleConfig> = {
    canvasBackgroundImage: decorTileImageForScheme(presetId, scheme) ?? preset.image,
    canvasDecorPresetId: presetId,
    ...patchChromeHideAuxiliaryGrid(config),
  };
  if (keepSolid && config.canvasBackgroundCustom) {
    patch.canvasBackground = cleared;
    patch.canvasBackgroundCustom = true;
  } else if (raw && isLegacyDecorGradient(raw)) {
    patch.canvasBackground = undefined;
    patch.canvasBackgroundCustom = false;
  }
  return patch;
}

/** 配置面板缩略图：小尺寸纹理预览（与画布叠层逻辑一致） */
export function decorPresetThumbStyle(
  presetId: string,
  scheme: ColorScheme = "light",
  underlay?: string,
): CSSProperties {
  const fill =
    underlay?.trim() ||
    (scheme === "dark" ? CANVAS_BG_DARK_DEFAULT : "#f8fafc");
  if (presetId === "none") {
    return { backgroundColor: fill };
  }
  if (presetId === "none" || !isDecorPresetId(presetId)) {
    return { backgroundColor: fill };
  }
  return {
    backgroundColor: fill,
    ...decorTileBackgroundLayers(presetId, scheme, "thumb"),
  };
}

/** @deprecated 使用 decorPresetThumbStyle */
export function decorPresetPreviewStyle(
  presetId: string,
  scheme: ColorScheme = "light",
): CSSProperties {
  if (presetId === "none") {
    return {
      backgroundColor: scheme === "dark" ? CANVAS_BG_DARK_DEFAULT : CANVAS_BG_LIGHT_DEFAULT,
    };
  }
  return decorPresetThumbStyle(presetId, scheme);
}

function resolveDecorImageStyle(
  image: string,
  scheme: ColorScheme = "light",
  presetId?: string,
  fit?: WidgetBackgroundImageFit,
  position?: WidgetBackgroundImagePosition,
): Pick<
  CSSProperties,
  "backgroundImage" | "backgroundSize" | "backgroundRepeat" | "backgroundPosition"
> {
  const preset = presetId
    ? CANVAS_BG_DECOR_PRESETS.find((item) => item.id === presetId)
    : CANVAS_BG_DECOR_PRESETS.find((item) => item.image === image);
  if (preset?.tileSize && isDecorPresetId(preset.id)) {
    return decorTileBackgroundLayers(preset.id, scheme, "canvas");
  }
  return {
    backgroundImage: `url("${image}")`,
    ...resolveWidgetBackgroundImageLayerStyle({
      backgroundImageFit: fit ?? "cover",
      backgroundImagePosition: position,
    }),
  };
}

export const DEFAULT_SCALE_MODE: ScaleMode = "canvas";
export const DEFAULT_QUERY_LIMIT = DEFAULT_CHART_RESULT_LIMIT;
export const MIN_QUERY_LIMIT = 1;
export const MAX_QUERY_LIMIT = 10000;

export function dashboardShapeGapStyle(gapPx: number): CSSProperties {
  return componentGapShellStyle(gapPx);
}

export function resolveQueryLimit(config: DashboardStyleConfig): number {
  const limit = config.defaultQueryLimit ?? DEFAULT_QUERY_LIMIT;
  return Math.min(MAX_QUERY_LIMIT, Math.max(MIN_QUERY_LIMIT, limit));
}

export function styleConfigHasPersistedFields(config: DashboardStyleConfig): boolean {
  return Object.entries(config).some(([, value]) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "object") return Object.keys(value as object).length > 0;
    return true;
  });
}

export function hasUserCanvasBackground(config: DashboardStyleConfig): boolean {
  if (config.canvasBackgroundCustom) return true;
  if (config.canvasBackgroundImage?.trim()) return true;
  const decorId = config.canvasDecorPresetId;
  return Boolean(decorId && decorId !== "none");
}

/** @deprecated use hasUserCanvasBackground */
export const hasCustomCanvasBackground = hasUserCanvasBackground;

/** 组件树实际消费的看板样式子集（不含画布壳层 / CSS 变量类字段） */
export function pickWidgetDashboardStyle(
  config: DashboardStyleConfig,
): DashboardStyleConfig {
  return {
    colorScheme: config.colorScheme,
    defaultQueryLimit: config.defaultQueryLimit,
    paletteId: config.paletteId,
    paletteColors: config.paletteColors
      ? [...config.paletteColors]
      : undefined,
    paletteOpacity: config.paletteOpacity,
    seriesGradient: config.seriesGradient,
    depthVisual: config.depthVisual,
    chartLabelShow: config.chartLabelShow,
    tooltipShow: config.tooltipShow,
    chartLabelStyle: config.chartLabelStyle
      ? { ...config.chartLabelStyle }
      : undefined,
    chartTooltipStyle: config.chartTooltipStyle
      ? { ...config.chartTooltipStyle }
      : undefined,
    tableColorStyle: config.tableColorStyle
      ? { ...config.tableColorStyle }
      : undefined,
    widgetStyle: config.widgetStyle,
    titleStyle: config.titleStyle,
    filterChromeStyle: config.filterChromeStyle,
    filterControlStyle: config.filterControlStyle,
    numberFormat: config.numberFormat,
    chrome: config.chrome,
  };
}

/** ChartRenderer 看板级配色默认指纹（稳定 memo / 浅比较） */
export function chartPaletteDefaultsFingerprint(
  config?: DashboardStyleConfig,
): string {
  if (!config) return "";
  return JSON.stringify({
    paletteId: config.paletteId,
    paletteColors: config.paletteColors,
    paletteOpacity: config.paletteOpacity,
    seriesGradient: config.seriesGradient,
    depthVisual: config.depthVisual,
    chartLabelShow: config.chartLabelShow,
    tooltipShow: config.tooltipShow,
    chartLabelStyle: config.chartLabelStyle,
    chartTooltipStyle: config.chartTooltipStyle,
    tableColorStyle: config.tableColorStyle,
    surfaceKind: config.surfaceKind,
  });
}

/** ChartRenderer 看板级配色默认（避免 DashboardWidget / 弹窗等处手写遗漏） */
export function pickChartPaletteDefaults(
  config?: DashboardStyleConfig,
): Pick<
  DashboardStyleConfig,
  | "paletteId"
  | "paletteColors"
  | "paletteOpacity"
  | "seriesGradient"
  | "depthVisual"
  | "chartLabelShow"
  | "tooltipShow"
  | "chartLabelStyle"
  | "chartTooltipStyle"
  | "tableColorStyle"
  | "surfaceKind"
> | undefined {
  if (!config) return undefined;
  return {
    paletteId: config.paletteId,
    paletteColors: config.paletteColors
      ? [...config.paletteColors]
      : undefined,
    paletteOpacity: config.paletteOpacity,
    seriesGradient: config.seriesGradient,
    depthVisual: config.depthVisual,
    chartLabelShow: config.chartLabelShow,
    tooltipShow: config.tooltipShow,
    chartLabelStyle: config.chartLabelStyle,
    chartTooltipStyle: config.chartTooltipStyle,
    tableColorStyle: config.tableColorStyle,
    surfaceKind: config.surfaceKind,
  };
}

export function widgetDashboardStyleFingerprint(
  config: DashboardStyleConfig,
): string {
  return JSON.stringify(pickWidgetDashboardStyle(config));
}

/** 画板样式指纹（useMemo / inline style 重算） */
export function canvasArtboardStyleFingerprint(config: DashboardStyleConfig): string {
  return JSON.stringify({
    scheme: config.colorScheme ?? "light",
    bg: config.canvasBackground,
    img: config.canvasBackgroundImage,
    imgFit: config.canvasBackgroundImageFit,
    imgPos: config.canvasBackgroundImagePosition,
    custom: config.canvasBackgroundCustom,
    decor: config.canvasDecorPresetId,
  });
}

/**
 * 画板强制重绘指纹（key / metrics 刷新）。
 * 不含纯色 `bg`，避免颜色选择器连续改色时整层 remount。
 */
export function canvasArtboardRepaintFingerprint(config: DashboardStyleConfig): string {
  return JSON.stringify({
    scheme: config.colorScheme ?? "light",
    img: config.canvasBackgroundImage,
    imgFit: config.canvasBackgroundImageFit,
    imgPos: config.canvasBackgroundImagePosition,
    custom: config.canvasBackgroundCustom,
    decor: config.canvasDecorPresetId,
  });
}

export function canvasChromeUsesDotGrid(config: DashboardStyleConfig): boolean {
  return !hasUserCanvasBackground(config);
}

function isCssGradient(value: string): boolean {
  return /^(linear|radial|conic)-gradient\(/i.test(value.trim());
}

/** §5.3 用户显式设置的仪表板背景（与主题无关） */
export function canvasBackgroundStyle(config: DashboardStyleConfig): CSSProperties {
  const style: CSSProperties = {};
  const scheme = config.colorScheme ?? "light";
  const backgroundImage = config.canvasBackgroundImage?.trim();
  const customSolid =
    config.canvasBackgroundCustom && config.canvasBackground?.trim()
      ? config.canvasBackground.trim()
      : undefined;

  if (backgroundImage) {
    const decorLayers = resolveDecorImageStyle(
      backgroundImage,
      scheme,
      config.canvasDecorPresetId,
      config.canvasBackgroundImageFit,
      config.canvasBackgroundImagePosition,
    );
    if (customSolid && isCssGradient(customSolid)) {
      const imageLayer = decorLayers.backgroundImage ?? `url("${backgroundImage}")`;
      style.backgroundImage = `${imageLayer}, ${customSolid}`;
      style.backgroundSize = `${decorLayers.backgroundSize ?? "cover"}, cover`;
      style.backgroundPosition = `${decorLayers.backgroundPosition ?? "center"}, center`;
      style.backgroundRepeat = "no-repeat, no-repeat";
    } else if (customSolid?.startsWith("linear-gradient")) {
      style.background = customSolid;
      Object.assign(style, decorLayers);
    } else {
      const fill = customSolid || defaultSolidArtboardColor(scheme);
      style.backgroundColor = isCssGradient(fill) ? undefined : fill;
      if (isCssGradient(fill)) {
        style.background = fill;
      }
      Object.assign(style, decorLayers);
    }
    return style;
  }

  if (customSolid) {
    style.background = customSolid;
  }
  return style;
}

/** 画板可见底色：用户背景优先，否则随主题（含强调色）默认 */
export function resolveArtboardStyle(config: DashboardStyleConfig): CSSProperties {
  const scheme = config.colorScheme ?? "light";
  const coerced = effectiveCanvasBackground(config);
  const working: DashboardStyleConfig = {
    ...config,
    canvasBackground: coerced ?? config.canvasBackground,
  };
  const userBackground = canvasBackgroundStyle(working);
  if (Object.keys(userBackground).length > 0) return userBackground;
  return {
    backgroundColor:
      effectiveCanvasBackground(config) ?? getDashboardThemeTokens(scheme).canvas,
  };
}

/**
 * 滚动宿主 letterbox：只铺纯色/渐变底，不带平铺纹理或背景图。
 * 纹理必须画在带 scale 的 artboard 上，否则 host（未缩放）与 artboard（缩放）双层点阵会分段，
 * 且拖拽引起 scale 微调时屏幕疏密会跳变。
 */
export function resolveHostLetterboxStyle(config: DashboardStyleConfig): CSSProperties {
  const scheme = config.colorScheme ?? "light";
  const coerced = effectiveCanvasBackground(config)?.trim();
  if (coerced && isCssGradient(coerced)) {
    return { background: coerced };
  }
  if (coerced) {
    return { backgroundColor: coerced };
  }
  const artboard = resolveArtboardStyle(config);
  if (typeof artboard.background === "string" && isCssGradient(artboard.background)) {
    return { background: artboard.background };
  }
  if (typeof artboard.backgroundColor === "string" && artboard.backgroundColor.trim()) {
    return { backgroundColor: artboard.backgroundColor };
  }
  return {
    backgroundColor: defaultSolidArtboardColor(scheme),
  };
}

/** @deprecated use resolveArtboardStyle on artboard layer; theme surface must not set background */
export function canvasSurfaceStyle(config: DashboardStyleConfig): CSSProperties {
  return resolveArtboardStyle(config);
}

export function mergeTitleStyle(
  global: TitleStyleConfig | undefined,
  override?: TitleStyleConfig,
): CSSProperties {
  const merged = { ...global, ...override };
  const style: CSSProperties = {};
  if (merged.fontSize != null) style.fontSize = `${merged.fontSize}px`;
  if (merged.color) style.color = merged.color;
  if (merged.fontWeight != null) style.fontWeight = merged.fontWeight;
  if (merged.fontStyle) style.fontStyle = merged.fontStyle;
  if (merged.align) style.textAlign = merged.align;
  if (merged.letterSpacing != null) style.letterSpacing = `${merged.letterSpacing}px`;
  if (merged.shadow) style.textShadow = "0 1px 2px rgba(15, 23, 42, 0.28)";
  return style;
}

export function resolveBoxPadding(global: WidgetStyleConfig | undefined): string | undefined {
  if (!global) return undefined;
  const mode = global.paddingMode ?? "unified";
  if (mode === "individual") {
    const top = global.paddingTop ?? global.padding ?? 0;
    const right = global.paddingRight ?? global.padding ?? 0;
    const bottom = global.paddingBottom ?? global.padding ?? 0;
    const left = global.paddingLeft ?? global.padding ?? 0;
    if (top || right || bottom || left) return `${top}px ${right}px ${bottom}px ${left}px`;
    return undefined;
  }
  if (global.padding != null) return `${global.padding}px`;
  return undefined;
}

export function resolveBoxRadius(global: WidgetStyleConfig | undefined): string | undefined {
  if (!global) return undefined;
  const mode = global.radiusMode ?? "unified";
  if (mode === "individual") {
    const tl = global.borderRadiusTopLeft ?? global.borderRadius ?? 0;
    const tr = global.borderRadiusTopRight ?? global.borderRadius ?? 0;
    const br = global.borderRadiusBottomRight ?? global.borderRadius ?? 0;
    const bl = global.borderRadiusBottomLeft ?? global.borderRadius ?? 0;
    if (tl || tr || br || bl) return `${tl}px ${tr}px ${br}px ${bl}px`;
    return undefined;
  }
  if (global.borderRadius != null) return `${global.borderRadius}px`;
  return undefined;
}

export function mergeWidgetShellStyle(
  global: WidgetStyleConfig | undefined,
  colorScheme: ColorScheme = "light",
  options?: {
    /** 单图 deStyle.background 装饰边框需为 true */
    allowDecorativeFrame?: boolean;
  },
): {
  className: string;
  style: CSSProperties;
  backgroundLayer: CSSProperties | null;
  frameLayer: CSSProperties | null;
} {
  const presentation = buildWidgetBackgroundPresentation(global, colorScheme, {
    respectBackgroundShow: true,
    applyThemeDefaultSurface: true,
    allowDecorativeFrame: options?.allowDecorativeFrame ?? false,
  });
  const style: CSSProperties = { ...presentation.surface };
  const borderEnabled = global?.borderEnabled !== false;
  const borderWidth = global?.borderWidth ?? 1;
  if (borderEnabled && borderWidth > 0) {
    style.borderStyle = global?.borderStyle ?? "solid";
    style.borderWidth = borderWidth;
    style.borderColor =
      global?.borderColor ?? "var(--dashboard-widget-border, var(--color-gray-200))";
  }
  return {
    className: "",
    style,
    backgroundLayer: presentation.backgroundLayer,
    frameLayer: presentation.frameLayer,
  };
}

export function formatMetricValue(
  raw: unknown,
  format: NumberFormatConfig | undefined,
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = Number(raw);
  if (Number.isNaN(n) || String(raw).trim() === "") return String(raw);
  const decimals = format?.decimals ?? 0;
  const type = format?.type ?? "auto";
  const useGrouping = format?.thousandSeparator !== false;
  let text: string;
  if (type === "percent") {
    text = `${(n * 100).toFixed(decimals)}%`;
  } else if (type === "currency") {
    text = n.toLocaleString("zh-CN", {
      style: "currency",
      currency: "CNY",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    });
  } else {
    text = n.toLocaleString("zh-CN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    });
  }
  if (format?.unit) return `${text}${format.unit}`;
  return text;
}
