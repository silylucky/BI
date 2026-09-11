import { SCREEN_ACCENT, SCREEN_TITLE_COLOR } from "@/lib/screenTokens";
import type { ScreenBorderSparkleStyleConfig } from "@/lib/screenBorderSparkle";
import { normalizeScreenBorderSparkleStyle } from "@/lib/screenBorderSparkle";

export type { ScreenBorderSparkleConfig, ScreenBorderSparkleStyleConfig } from "@/lib/screenBorderSparkle";

export type ScreenClockDateFormat =
  | "YYYY-MM-DD"
  | "YYYY/MM/DD"
  | "YYYY年MM月DD日"
  | "MM-DD";

export type ScreenClockLayout = "stacked" | "inline";

export type ScreenClockAlign = "left" | "center" | "right";

export type ScreenClockStyleConfig = {
  fontSize?: number;
  color?: string;
  showWeekday?: boolean;
  showSeconds?: boolean;
  weekdayFontSize?: number;
  weekdayColor?: string;
  showDate?: boolean;
  dateFormat?: ScreenClockDateFormat;
  use12Hour?: boolean;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  align?: ScreenClockAlign;
  letterSpacing?: number;
  layout?: ScreenClockLayout;
};

export type ScreenDateTimeStyleConfig = {
  dateFontSize?: number;
  timeFontSize?: number;
  color?: string;
  showWeekday?: boolean;
  showSeconds?: boolean;
};

export type ScreenBorderVariant =
  | "border-1"
  | "border-2"
  | "border-3"
  | "border-4"
  | "border-5"
  | "border-6"
  | "border-7"
  | "border-8"
  | "border-9";

export type ScreenBorderStyleConfig = {
  accentColor?: string;
  glowEnabled?: boolean;
  innerBorderOpacity?: number;
  variant?: ScreenBorderVariant;
  sparkle?: ScreenBorderSparkleStyleConfig;
};

export type ScreenShapeKind = "rect" | "triangle" | "circle";

export type ScreenShapeStyleConfig = {
  shape?: ScreenShapeKind;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
};

export type ScreenIconStyleConfig = {
  icon?: string;
  color?: string;
  size?: number;
};

export type ScreenTitleBarVariant =
  | "simple"
  | "de-trapezoid-wing"
  | "de-circuit-sym"
  | "de-glow-plaque";

export type ScreenTitleBarStyleConfig = {
  accentColor?: string;
  titleColor?: string;
  showSideLines?: boolean;
  /** DE 大屏顶栏样式；默认梯形+电路翼 */
  variant?: ScreenTitleBarVariant;
  fontSize?: number;
  /** 顶栏装饰图片（对标 DataEase）；未设时由 variant + palette 解析 */
  backgroundImage?: string;
  /** 素材色系，对应 screen-header-{variant}-{palette}.svg */
  palette?: string;
};

export type ScreenVisualStyleConfig = {
  clock?: ScreenClockStyleConfig;
  datetime?: ScreenDateTimeStyleConfig;
  border?: ScreenBorderStyleConfig;
  titleBar?: ScreenTitleBarStyleConfig;
  shape?: ScreenShapeStyleConfig;
  icon?: ScreenIconStyleConfig;
};

export const DEFAULT_SCREEN_CLOCK_STYLE: Required<ScreenClockStyleConfig> = {
  fontSize: 18,
  color: "#e0f2fe",
  showWeekday: true,
  showSeconds: true,
  weekdayFontSize: 12,
  weekdayColor: "#e0f2fe",
  showDate: true,
  dateFormat: "YYYY-MM-DD",
  use12Hour: false,
  fontFamily: "",
  fontWeight: 400,
  fontStyle: "normal",
  align: "center",
  letterSpacing: 0,
  layout: "stacked",
};

export const DEFAULT_SCREEN_DATETIME_STYLE: Required<ScreenDateTimeStyleConfig> = {
  dateFontSize: 14,
  timeFontSize: 22,
  color: "#e0f2fe",
  showWeekday: false,
  showSeconds: true,
};

export const DEFAULT_SCREEN_BORDER_STYLE: Required<ScreenBorderStyleConfig> = {
  accentColor: SCREEN_ACCENT,
  glowEnabled: true,
  innerBorderOpacity: 0.3,
  variant: "border-1",
};

export const DEFAULT_SCREEN_SHAPE_STYLE: Required<ScreenShapeStyleConfig> = {
  shape: "rect",
  strokeColor: SCREEN_ACCENT,
  strokeWidth: 2,
  fillOpacity: 0,
};

export const DEFAULT_SCREEN_ICON_STYLE: Required<ScreenIconStyleConfig> = {
  icon: "star",
  color: "#e0f2fe",
  size: 48,
};

export const DEFAULT_SCREEN_TITLE_BAR_STYLE: Required<ScreenTitleBarStyleConfig> = {
  accentColor: SCREEN_ACCENT,
  titleColor: SCREEN_TITLE_COLOR,
  showSideLines: true,
  variant: "de-trapezoid-wing",
  fontSize: 20,
  backgroundImage: "",
  palette: "cyan",
};

export function normalizeScreenClockStyle(
  raw?: ScreenClockStyleConfig,
): Required<ScreenClockStyleConfig> {
  return {
    fontSize: raw?.fontSize ?? DEFAULT_SCREEN_CLOCK_STYLE.fontSize,
    color: raw?.color ?? DEFAULT_SCREEN_CLOCK_STYLE.color,
    showWeekday: raw?.showWeekday ?? DEFAULT_SCREEN_CLOCK_STYLE.showWeekday,
    showSeconds: raw?.showSeconds ?? DEFAULT_SCREEN_CLOCK_STYLE.showSeconds,
    weekdayFontSize: raw?.weekdayFontSize ?? DEFAULT_SCREEN_CLOCK_STYLE.weekdayFontSize,
    weekdayColor: raw?.weekdayColor ?? raw?.color ?? DEFAULT_SCREEN_CLOCK_STYLE.weekdayColor,
    showDate: raw?.showDate ?? DEFAULT_SCREEN_CLOCK_STYLE.showDate,
    dateFormat: raw?.dateFormat ?? DEFAULT_SCREEN_CLOCK_STYLE.dateFormat,
    use12Hour: raw?.use12Hour ?? DEFAULT_SCREEN_CLOCK_STYLE.use12Hour,
    fontFamily: raw?.fontFamily ?? DEFAULT_SCREEN_CLOCK_STYLE.fontFamily,
    fontWeight: raw?.fontWeight ?? DEFAULT_SCREEN_CLOCK_STYLE.fontWeight,
    fontStyle: raw?.fontStyle ?? DEFAULT_SCREEN_CLOCK_STYLE.fontStyle,
    align: raw?.align ?? DEFAULT_SCREEN_CLOCK_STYLE.align,
    letterSpacing: raw?.letterSpacing ?? DEFAULT_SCREEN_CLOCK_STYLE.letterSpacing,
    layout: raw?.layout ?? DEFAULT_SCREEN_CLOCK_STYLE.layout,
  };
}

export function normalizeScreenDateTimeStyle(
  raw?: ScreenDateTimeStyleConfig,
): Required<ScreenDateTimeStyleConfig> {
  return {
    dateFontSize: raw?.dateFontSize ?? DEFAULT_SCREEN_DATETIME_STYLE.dateFontSize,
    timeFontSize: raw?.timeFontSize ?? DEFAULT_SCREEN_DATETIME_STYLE.timeFontSize,
    color: raw?.color ?? DEFAULT_SCREEN_DATETIME_STYLE.color,
    showWeekday: raw?.showWeekday ?? DEFAULT_SCREEN_DATETIME_STYLE.showWeekday,
    showSeconds: raw?.showSeconds ?? DEFAULT_SCREEN_DATETIME_STYLE.showSeconds,
  };
}

export function normalizeScreenBorderStyle(
  raw?: ScreenBorderStyleConfig,
): Required<Omit<ScreenBorderStyleConfig, "sparkle">> & {
  sparkle: ReturnType<typeof normalizeScreenBorderSparkleStyle>;
} {
  const sparkle = normalizeScreenBorderSparkleStyle(raw?.sparkle);
  return {
    accentColor: raw?.accentColor ?? DEFAULT_SCREEN_BORDER_STYLE.accentColor,
    glowEnabled: raw?.glowEnabled ?? DEFAULT_SCREEN_BORDER_STYLE.glowEnabled,
    innerBorderOpacity:
      raw?.innerBorderOpacity ?? DEFAULT_SCREEN_BORDER_STYLE.innerBorderOpacity,
    variant: raw?.variant ?? DEFAULT_SCREEN_BORDER_STYLE.variant,
    sparkle,
  };
}

export function normalizeScreenShapeStyle(
  raw?: ScreenShapeStyleConfig,
): Required<ScreenShapeStyleConfig> {
  return {
    shape: raw?.shape ?? DEFAULT_SCREEN_SHAPE_STYLE.shape,
    strokeColor: raw?.strokeColor ?? DEFAULT_SCREEN_SHAPE_STYLE.strokeColor,
    strokeWidth: raw?.strokeWidth ?? DEFAULT_SCREEN_SHAPE_STYLE.strokeWidth,
    fillOpacity: raw?.fillOpacity ?? DEFAULT_SCREEN_SHAPE_STYLE.fillOpacity,
  };
}

export function normalizeScreenIconStyle(
  raw?: ScreenIconStyleConfig,
): Required<ScreenIconStyleConfig> {
  return {
    icon: raw?.icon ?? DEFAULT_SCREEN_ICON_STYLE.icon,
    color: raw?.color ?? DEFAULT_SCREEN_ICON_STYLE.color,
    size: raw?.size ?? DEFAULT_SCREEN_ICON_STYLE.size,
  };
}

export function normalizeScreenTitleBarStyle(
  raw?: ScreenTitleBarStyleConfig,
): Required<ScreenTitleBarStyleConfig> {
  return {
    accentColor: raw?.accentColor ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.accentColor,
    titleColor: raw?.titleColor ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.titleColor,
    showSideLines: raw?.showSideLines ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.showSideLines,
    variant: raw?.variant ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.variant,
    fontSize: raw?.fontSize ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.fontSize,
    backgroundImage: raw?.backgroundImage ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.backgroundImage,
    palette: raw?.palette ?? DEFAULT_SCREEN_TITLE_BAR_STYLE.palette,
  };
}

export function normalizeScreenVisualStyle(
  raw?: ScreenVisualStyleConfig,
): Required<{
  clock: Required<ScreenClockStyleConfig>;
  datetime: Required<ScreenDateTimeStyleConfig>;
  border: Required<ScreenBorderStyleConfig>;
  titleBar: Required<ScreenTitleBarStyleConfig>;
  shape: Required<ScreenShapeStyleConfig>;
  icon: Required<ScreenIconStyleConfig>;
}> {
  return {
    clock: normalizeScreenClockStyle(raw?.clock),
    datetime: normalizeScreenDateTimeStyle(raw?.datetime),
    border: normalizeScreenBorderStyle(raw?.border),
    titleBar: normalizeScreenTitleBarStyle(raw?.titleBar),
    shape: normalizeScreenShapeStyle(raw?.shape),
    icon: normalizeScreenIconStyle(raw?.icon),
  };
}
