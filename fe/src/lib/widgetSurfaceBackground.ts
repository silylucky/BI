import type { CSSProperties } from "react";
import { hexToRgb, normalizeHexColor } from "@/components/ui/color-utils";

function readOpacity(value: CSSProperties["opacity"]): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/** 将纯色/变量背景转为带 alpha 的色值，不影响子元素 */
export function withBackgroundAlpha(color: string, alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha));
  if (clamped >= 1) return color;
  if (clamped <= 0) return "transparent";

  const trimmed = color.trim();
  const hex = normalizeHexColor(trimmed);
  if (hex) {
    const rgb = hexToRgb(hex);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([^)]+)\s*\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(",").map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${clamped})`;
    }
  }

  const pct = Math.round(clamped * 100);
  return `color-mix(in srgb, ${trimmed} ${pct}%, transparent)`;
}

/** 仅 backdrop-filter、未调不透明度时：底色需半透明才能看见毛玻璃 */
const FROSTED_GLASS_BG_ALPHA = 0.82;

/** 底图模糊：略放大避免 filter 边缘露白 */
const WIDGET_IMAGE_BLUR_BLEED_SCALE = 1.06;

export function buildWidgetImageBlurStyle(blurPx: number): Pick<
  CSSProperties,
  "filter" | "transform" | "transformOrigin"
> {
  if (blurPx <= 0) return {};
  return {
    filter: `blur(${blurPx}px)`,
    transform: `scale(${WIDGET_IMAGE_BLUR_BLEED_SCALE})`,
    transformOrigin: "center",
  };
}

export function buildWidgetBackdropBlurStyle(blurPx: number): Pick<
  CSSProperties,
  "backdropFilter" | "WebkitBackdropFilter"
> {
  if (blurPx <= 0) return {};
  const value = `blur(${blurPx}px)`;
  return { backdropFilter: value, WebkitBackdropFilter: value };
}

function applyBackgroundPaintToLayer(
  backgroundLayer: CSSProperties,
  style: CSSProperties,
): void {
  delete backgroundLayer.background;
  if (typeof style.backgroundColor === "string") {
    backgroundLayer.backgroundColor = style.backgroundColor;
  } else if (typeof style.background === "string") {
    backgroundLayer.backgroundColor = style.background;
  }
}

export function needsWidgetBackgroundLayer(style: CSSProperties): boolean {
  if (style.backdropFilter || style.WebkitBackdropFilter) return true;
  if (style.backgroundImage) return true;
  const opacity = readOpacity(style.opacity);
  if (opacity == null || opacity >= 1) return false;
  return false;
}

export type WidgetBackgroundPresentation = {
  surface: CSSProperties;
  backgroundLayer: CSSProperties | null;
  /** 装饰边框 overlay（避免 border-image 被圆角/overflow 裁切） */
  frameLayer: CSSProperties | null;
};

/**
 * 背景不透明度只作用于底色/底图，不污染文字与图线（禁止容器 opacity）。
 */
export function applyBackgroundOpacityOnly(
  style: CSSProperties,
  fallbackBg = "var(--dashboard-widget-surface)",
): WidgetBackgroundPresentation {
  const opacity = readOpacity(style.opacity);
  const surface = { ...style };
  delete surface.opacity;

  if (needsWidgetBackgroundLayer(style)) {
    delete surface.background;
    delete surface.backgroundColor;
    delete surface.backgroundImage;
    delete surface.backgroundSize;
    delete surface.backgroundPosition;
    delete surface.backdropFilter;
    delete surface.WebkitBackdropFilter;

    const backgroundLayer: CSSProperties = {
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      backdropFilter: style.backdropFilter,
      WebkitBackdropFilter: style.WebkitBackdropFilter,
      borderRadius: style.borderRadius,
    };

    if (opacity != null && opacity < 1) {
      backgroundLayer.opacity = opacity;
      applyBackgroundPaintToLayer(backgroundLayer, style);
    } else if (style.backdropFilter && !style.backgroundImage) {
      const base =
        (typeof style.background === "string" && style.background) ||
        (typeof style.backgroundColor === "string" && style.backgroundColor) ||
        fallbackBg;
      const alpha =
        opacity != null && opacity < 1 ? opacity : FROSTED_GLASS_BG_ALPHA;
      backgroundLayer.backgroundColor = withBackgroundAlpha(base, alpha);
    } else {
      applyBackgroundPaintToLayer(backgroundLayer, style);
    }

    return { surface, backgroundLayer, frameLayer: null };
  }

  if (opacity != null && opacity < 1) {
    const base =
      (typeof style.background === "string" && style.background) ||
      (typeof style.backgroundColor === "string" && style.backgroundColor) ||
      fallbackBg;

    delete surface.background;
    delete surface.backgroundColor;
    surface.backgroundColor = withBackgroundAlpha(base, opacity);
  }

  return { surface, backgroundLayer: null, frameLayer: null };
}
