import type { WidgetStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { isScreenTitleBarWidget } from "@/lib/screenVisualAssets";
import type { ScreenTitleBarStyleConfig, ScreenTitleBarVariant } from "@/lib/screenVisualStyle";
import { normalizeScreenTitleBarStyle } from "@/lib/screenVisualStyle";

export const GOV_SCREEN_HEADER_PACK = "/template-assets/packs/gov-enterprise-v1/screen-headers";

/** 与素材包 screen-header-{variant}-{palette}.svg 对齐 */
export const SCREEN_TITLE_BAR_PALETTES = [
  "cyan",
  "indigo",
  "emerald",
  "amber",
  "royal",
  "teal",
  "violet",
  "gold",
  "cobalt",
  "magenta",
] as const;

export type ScreenTitleBarPalette = (typeof SCREEN_TITLE_BAR_PALETTES)[number];

export const SCREEN_TITLE_BAR_VARIANTS: {
  id: Exclude<ScreenTitleBarVariant, "simple">;
  label: string;
}[] = [
  { id: "de-trapezoid-wing", label: "梯形电路翼" },
  { id: "de-circuit-sym", label: "云数据中心" },
  { id: "de-glow-plaque", label: "发光标题牌" },
];

const ACCENT_TO_PALETTE: Record<string, ScreenTitleBarPalette> = {
  "#22d3ee": "cyan",
  "#38bdf8": "royal",
  "#60a5fa": "royal",
  "#3b82f6": "cobalt",
  "#1890ff": "cobalt",
  "#6366f1": "indigo",
  "#818cf8": "indigo",
  "#4f46e5": "indigo",
  "#34d399": "emerald",
  "#10b981": "emerald",
  "#047857": "emerald",
  "#fbbf24": "amber",
  "#f59e0b": "amber",
  "#f87171": "magenta",
  "#ec4899": "magenta",
  "#f472b6": "magenta",
  "#a78bfa": "violet",
  "#8b5cf6": "violet",
  "#2dd4bf": "teal",
  "#14b8a6": "teal",
};

export function inferScreenTitleBarPalette(accentColor?: string): ScreenTitleBarPalette {
  const key = accentColor?.trim().toLowerCase();
  if (key && ACCENT_TO_PALETTE[key]) return ACCENT_TO_PALETTE[key];
  return "cobalt";
}

export function buildScreenTitleBarImagePath(
  variant: ScreenTitleBarVariant,
  palette: ScreenTitleBarPalette,
): string {
  if (variant === "simple") return "";
  return `${GOV_SCREEN_HEADER_PACK}/screen-header-${variant}-${palette}.svg`;
}

/** 对标 DataEase：标题装饰为一张顶栏图片，文字叠在上方 */
export function resolveScreenTitleBarImageUrl(
  style: Pick<ScreenTitleBarStyleConfig, "variant" | "palette" | "backgroundImage" | "accentColor">,
): string {
  const explicit = style.backgroundImage?.trim();
  if (explicit) return explicit;
  const variant = style.variant ?? "de-trapezoid-wing";
  if (variant === "simple") return "";
  const palette = style.palette ?? inferScreenTitleBarPalette(style.accentColor);
  return buildScreenTitleBarImagePath(variant, palette);
}

/** 旧版标题装饰 marker 组件：将 screenStyle.titleBar 背景合并进 widgetStyle 以走通用背景渲染 */
export function resolveLegacyTitleBarWidgetStyle(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): WidgetStyleConfig | undefined {
  if (!isScreenTitleBarWidget(widget)) return widget.textConfig?.widgetStyle;
  const ws = widget.textConfig?.widgetStyle ?? {};
  if (ws.backgroundImage?.trim() && ws.backgroundShow !== false) return ws;
  const titleBar = normalizeScreenTitleBarStyle(widget.textConfig?.screenStyle?.titleBar);
  const imageUrl = resolveScreenTitleBarImageUrl(titleBar);
  if (!imageUrl) return ws;
  return {
    ...ws,
    backgroundShow: ws.backgroundShow ?? true,
    backgroundMode: ws.backgroundMode ?? "image",
    backgroundImage: imageUrl,
    backgroundImageOpacity: ws.backgroundImageOpacity ?? 1,
  };
}
