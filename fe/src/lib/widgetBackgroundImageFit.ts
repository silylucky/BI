import type { CSSProperties } from "react";
import type { WidgetStyleConfig } from "@/components/dashboard/dashboardStyleConfig";

export type WidgetBackgroundImageFit =
  | "stretch"
  | "contain"
  | "cover"
  | "widthFit"
  | "heightFit"
  | "original";

export type WidgetBackgroundImagePosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top center"
  | "top right"
  | "center left"
  | "center right"
  | "bottom left"
  | "bottom center"
  | "bottom right";

export const WIDGET_BACKGROUND_IMAGE_FIT_OPTIONS: {
  value: WidgetBackgroundImageFit;
  label: string;
}[] = [
  { value: "stretch", label: "拉伸" },
  { value: "contain", label: "适应" },
  { value: "cover", label: "覆盖" },
];

/** 面板展示：存量 widthFit/heightFit/original 映射到「适应」 */
export function normalizeBackgroundImageFitForUi(
  fit: WidgetBackgroundImageFit | undefined,
): WidgetBackgroundImageFit {
  if (fit === "stretch" || fit === "contain" || fit === "cover") return fit;
  return "contain";
}

export const WIDGET_BACKGROUND_IMAGE_POSITION_OPTIONS: {
  value: WidgetBackgroundImagePosition;
  label: string;
}[] = [
  { value: "top left", label: "左上" },
  { value: "top center", label: "上" },
  { value: "top right", label: "右上" },
  { value: "center left", label: "左" },
  { value: "center", label: "中" },
  { value: "center right", label: "右" },
  { value: "bottom left", label: "左下" },
  { value: "bottom center", label: "下" },
  { value: "bottom right", label: "右下" },
];

const FITS_WITH_POSITION: WidgetBackgroundImageFit[] = [
  "widthFit",
  "heightFit",
  "contain",
  "cover",
  "original",
];

export function backgroundImageFitSupportsPosition(
  fit: WidgetBackgroundImageFit | undefined,
): boolean {
  const resolved = fit ?? "stretch";
  return FITS_WITH_POSITION.includes(resolved);
}

function resolveBackgroundSize(fit: WidgetBackgroundImageFit | undefined): string {
  switch (fit ?? "stretch") {
    case "contain":
      return "contain";
    case "cover":
      return "cover";
    case "widthFit":
      return "100% auto";
    case "heightFit":
      return "auto 100%";
    case "original":
      return "auto";
    case "stretch":
    default:
      return "100% 100%";
  }
}

export function defaultPositionForFit(
  fit: WidgetBackgroundImageFit | undefined,
): WidgetBackgroundImagePosition {
  switch (fit ?? "stretch") {
    case "widthFit":
      return "center";
    case "heightFit":
      return "center";
    case "stretch":
      return "center";
    default:
      return "center";
  }
}

export function isDecorativeWidgetBackgroundUrl(url: string | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  return (
    trimmed.includes("/borderless-decor-v1/") ||
    trimmed.includes("/screen-headers/") ||
    trimmed.includes("/top-decor-clear/") ||
    trimmed.includes("/title-strips/")
  );
}

/** 内置顶栏/无边框装饰图：按宽铺满 + 居中（随组件缩放） */
export function inferDefaultBackgroundImageFitForUrl(url: string): {
  backgroundImageFit: WidgetBackgroundImageFit;
  backgroundImagePosition: WidgetBackgroundImagePosition;
} | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isDecorativeWidgetBackgroundUrl(trimmed)) {
    return {
      backgroundImageFit: "widthFit",
      backgroundImagePosition: "center",
    };
  }
  return null;
}

/** 装饰图未配置适应方式时的默认：按宽等比 */
export function effectiveDecorBackgroundFit(
  fit: WidgetBackgroundImageFit | undefined,
): WidgetBackgroundImageFit {
  return fit ?? "widthFit";
}

export function resolveDecorBackgroundLayerStyle(
  bg: Pick<
    WidgetStyleConfig,
    "backgroundImage" | "backgroundImageFit" | "backgroundImagePosition"
  >,
): Pick<CSSProperties, "backgroundSize" | "backgroundPosition" | "backgroundRepeat"> {
  const fit = bg.backgroundImageFit ?? "widthFit";
  const position = bg.backgroundImagePosition ?? defaultPositionForFit(fit);
  return {
    backgroundSize: resolveBackgroundSize(fit),
    backgroundPosition: position,
    backgroundRepeat: "no-repeat",
  };
}

export function inferFitFromBackgroundSize(
  size: string | undefined,
): WidgetBackgroundImageFit {
  switch (size) {
    case "contain":
      return "contain";
    case "cover":
      return "cover";
    case "100% auto":
      return "widthFit";
    case "auto 100%":
      return "heightFit";
    case "auto":
      return "original";
    case "100% 100%":
      return "stretch";
    default:
      return "stretch";
  }
}

export function resolveWidgetBackgroundImageLayerStyle(
  bg: Pick<
    WidgetStyleConfig,
    "backgroundImage" | "backgroundImageFit" | "backgroundImagePosition"
  >,
): Pick<CSSProperties, "backgroundSize" | "backgroundPosition" | "backgroundRepeat"> {
  if (isDecorativeWidgetBackgroundUrl(bg.backgroundImage)) {
    return resolveDecorBackgroundLayerStyle(bg);
  }
  const fit = bg.backgroundImageFit ?? "stretch";
  const position =
    bg.backgroundImagePosition ??
    (defaultPositionForFit(fit) as WidgetBackgroundImagePosition);
  return {
    backgroundSize: resolveBackgroundSize(fit),
    backgroundPosition: position,
    backgroundRepeat: "no-repeat",
  };
}
