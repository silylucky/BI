import type { CSSProperties } from "react";
import type { ColorScheme, WidgetStyleConfig } from "@/components/dashboard/dashboardStyleConfig";
import {
  coerceWidgetSurfaceBackground,
  isThemeDefaultShellBackground,
  resolveBoxPadding,
  resolveBoxRadius,
} from "@/components/dashboard/dashboardStyleConfig";
import { formatWidgetBackgroundImageCss } from "@/components/dashboard/imageSourceUtils";
import { resolveWidgetBackgroundImageLayerStyle } from "@/lib/widgetBackgroundImageFit";
import {
  defaultPositionForFit,
  effectiveDecorBackgroundFit,
  isDecorativeWidgetBackgroundUrl,
} from "@/lib/widgetBackgroundImageFit";
import type { WidgetBackgroundImageLayerStyle } from "@/lib/widgetDecorBackground";
import { resolveChartFrameOverlayLayer } from "@/lib/chartFrameBorderPresets";
import {
  applyBackgroundOpacityOnly,
  buildWidgetBackdropBlurStyle,
  buildWidgetImageBlurStyle,
  type WidgetBackgroundPresentation,
} from "@/lib/widgetSurfaceBackground";

/** 组件/全局 widgetStyle → 背景色、底图、装饰边框图层（对标 DE 背景区） */
export function buildWidgetBackgroundPresentation(
  bg: WidgetStyleConfig | undefined,
  colorScheme: ColorScheme = "light",
  options?: {
    respectBackgroundShow?: boolean;
    applyThemeDefaultSurface?: boolean;
    /** 看板全局 widgetStyle 为 false；单图 deStyle.background 为 true */
    allowDecorativeFrame?: boolean;
  },
): WidgetBackgroundPresentation {
  if (!bg) return { surface: {}, backgroundLayer: null, frameLayer: null };

  const respectShow = options?.respectBackgroundShow !== false;
  const showBackground = !respectShow || bg.backgroundShow !== false;
  const style: CSSProperties = {};
  const radius = resolveBoxRadius(bg);
  let frameLayer: CSSProperties | null = null;
  let imageLayer: WidgetBackgroundImageLayerStyle | null = null;

  const coerced = coerceWidgetSurfaceBackground(bg.background, colorScheme);
  const useThemeDefault =
    options?.applyThemeDefaultSurface === true &&
    isThemeDefaultShellBackground(bg.background, colorScheme);
  const mode = showBackground
    ? (bg.backgroundMode ??
        (bg.backgroundImage?.trim()
          ? "image"
          : bg.framePresetId
            ? "frame"
            : "image"))
    : null;
  const allowFrame = options?.allowDecorativeFrame !== false;
  const willUseImage =
    showBackground &&
    mode !== "border" &&
    mode !== "frame" &&
    Boolean(bg.backgroundImage?.trim());

  if (!showBackground) {
    style.backgroundColor = "transparent";
  } else if (useThemeDefault) {
    style.backgroundColor = "var(--dashboard-widget-surface)";
  } else if (coerced) {
    style.background = coerced;
  } else if (willUseImage) {
    style.backgroundColor = "transparent";
  } else {
    style.backgroundColor = "var(--dashboard-widget-surface)";
  }

  if (showBackground) {
    if (allowFrame && mode === "frame" && bg.framePresetId) {
      frameLayer = resolveChartFrameOverlayLayer(bg.framePresetId, bg.frameColor, radius);
    } else if (mode !== "border" && bg.backgroundImage) {
      const imageUrl = formatWidgetBackgroundImageCss(bg.backgroundImage);
      const isDecor = isDecorativeWidgetBackgroundUrl(bg.backgroundImage);
      const fit = isDecor
        ? effectiveDecorBackgroundFit(bg.backgroundImageFit)
        : (bg.backgroundImageFit ?? "stretch");
      const position = bg.backgroundImagePosition ?? defaultPositionForFit(fit);
      const blurPx = bg.backdropBlur ?? 0;
      const blurStyle = blurPx > 0 ? buildWidgetImageBlurStyle(blurPx) : null;
      imageLayer = {
        backgroundImage: imageUrl,
        ...resolveWidgetBackgroundImageLayerStyle(bg),
        widgetBackgroundFit: fit,
        widgetBackgroundPosition: position,
        ...(isDecor ? {} : { borderRadius: radius }),
        transform: blurStyle?.transform ? `translateZ(0) ${blurStyle.transform}` : "translateZ(0)",
        backfaceVisibility: "hidden",
        ...(blurStyle
          ? { filter: blurStyle.filter, transformOrigin: blurStyle.transformOrigin }
          : {}),
      };
    }
    if (bg.opacity != null) style.opacity = bg.opacity;
    const blurPx = bg.backdropBlur ?? 0;
    if (blurPx > 0 && !bg.backgroundImage) {
      Object.assign(style, buildWidgetBackdropBlurStyle(blurPx));
    }
  }

  const padding = resolveBoxPadding(bg);
  if (padding) style.padding = padding;
  if (radius) style.borderRadius = radius;

  const presentation = applyBackgroundOpacityOnly(style);
  if (imageLayer) {
    const imageAlpha = bg.backgroundImageOpacity ?? 1;
    const imageOpacityStyle =
      imageAlpha < 1 ? { opacity: Math.min(1, Math.max(0, imageAlpha)) } : {};
    if (presentation.backgroundLayer) {
      presentation.backgroundLayer = {
        ...presentation.backgroundLayer,
        ...imageLayer,
        ...imageOpacityStyle,
      };
    } else {
      presentation.backgroundLayer = { ...imageLayer, ...imageOpacityStyle };
    }
  }
  if (frameLayer) {
    // 装饰边框不透明度独立于背景 opacity；未设置时按完全不透明
    const frameAlpha = bg.frameOpacity ?? 1;
    frameLayer = {
      ...frameLayer,
      opacity: Math.min(1, Math.max(0, frameAlpha)),
    };
  }
  presentation.frameLayer = frameLayer;
  return presentation;
}
