import type { CSSProperties } from "react";
import { parseWidgetBackgroundImageUrl } from "@/components/dashboard/imageSourceUtils";
import {
  findTemplateAssetByUrl,
  resolveTemplateAssetUrl,
} from "@/lib/templateAssetCatalog";
import type {
  WidgetBackgroundImageFit,
  WidgetBackgroundImagePosition,
} from "@/lib/widgetBackgroundImageFit";
import {
  defaultPositionForFit,
  effectiveDecorBackgroundFit,
  inferFitFromBackgroundSize,
  isDecorativeWidgetBackgroundUrl,
} from "@/lib/widgetBackgroundImageFit";

/** 底图 overlay 层：CSS 字段 + 适应方式元数据（img 渲染读取） */
export type WidgetBackgroundImageLayerStyle = CSSProperties & {
  widgetBackgroundFit?: WidgetBackgroundImageFit;
  widgetBackgroundPosition?: WidgetBackgroundImagePosition | string;
};

export function resolveDecorImageObjectPosition(
  position: WidgetBackgroundImagePosition | string | undefined,
): string {
  const normalized = (position ?? "center").trim();
  if (normalized === "top") return "top center";
  if (normalized === "bottom") return "bottom center";
  if (normalized === "left") return "center left";
  if (normalized === "right") return "center right";
  return normalized;
}

/** widthFit / heightFit / original：用 flex 对齐，object-position 对块级 img 无效 */
export function resolveDecorFlexLayout(
  position: WidgetBackgroundImagePosition | string | undefined,
): Pick<CSSProperties, "alignItems" | "justifyContent"> {
  const normalized = resolveDecorImageObjectPosition(position);
  let alignItems: CSSProperties["alignItems"] = "center";
  let justifyContent: CSSProperties["justifyContent"] = "center";

  if (normalized.includes("top")) alignItems = "flex-start";
  else if (normalized.includes("bottom")) alignItems = "flex-end";

  if (normalized.endsWith(" left") || normalized === "left") justifyContent = "flex-start";
  else if (normalized.endsWith(" right") || normalized === "right") justifyContent = "flex-end";

  return { alignItems, justifyContent };
}

export function resolveDecorImagePresentation(
  fit: WidgetBackgroundImageFit,
  position?: WidgetBackgroundImagePosition | string,
): Pick<
  CSSProperties,
  "objectFit" | "objectPosition" | "width" | "height" | "maxWidth" | "maxHeight"
> {
  const objectPosition = resolveDecorImageObjectPosition(position ?? defaultPositionForFit(fit));
  switch (fit) {
    case "contain":
      return { width: "100%", height: "100%", objectFit: "contain", objectPosition };
    case "cover":
      return { width: "100%", height: "100%", objectFit: "cover", objectPosition };
    case "widthFit":
      return {
        width: "100%",
        height: "auto",
        maxHeight: "100%",
        objectPosition,
      };
    case "heightFit":
      return {
        width: "auto",
        height: "100%",
        maxWidth: "100%",
        objectPosition,
      };
    case "original":
      return {
        width: "auto",
        height: "auto",
        maxWidth: "100%",
        maxHeight: "100%",
        objectPosition,
      };
    case "stretch":
    default:
      return { width: "100%", height: "100%", objectFit: "fill", objectPosition };
  }
}

export function decorImageUsesAxisFit(fit: WidgetBackgroundImageFit): boolean {
  return fit === "widthFit" || fit === "heightFit" || fit === "original";
}

export function shouldUseDecorImageLayer(
  layer: WidgetBackgroundImageLayerStyle | null | undefined,
): boolean {
  return shouldUseWidgetBackgroundImageLayer(layer);
}

/** 所有 widget 底图均用 <img> 渲染，避免 CSS background-size 非 cover 失效 */
export function shouldUseWidgetBackgroundImageLayer(
  layer: WidgetBackgroundImageLayerStyle | null | undefined,
): boolean {
  if (!layer?.backgroundImage) return false;
  const url = parseWidgetBackgroundImageUrl(
    typeof layer.backgroundImage === "string" ? layer.backgroundImage : undefined,
  );
  return Boolean(url);
}

function resolveLayerFit(
  layer: WidgetBackgroundImageLayerStyle,
  url: string,
): WidgetBackgroundImageFit {
  if (layer.widgetBackgroundFit) return layer.widgetBackgroundFit;
  const inferred = inferFitFromBackgroundSize(
    typeof layer.backgroundSize === "string" ? layer.backgroundSize : undefined,
  );
  if (isDecorativeWidgetBackgroundUrl(url)) {
    return effectiveDecorBackgroundFit(inferred);
  }
  return inferred;
}

function resolveLayerPosition(
  layer: WidgetBackgroundImageLayerStyle,
  fit: WidgetBackgroundImageFit,
): string {
  if (layer.widgetBackgroundPosition) return layer.widgetBackgroundPosition;
  if (typeof layer.backgroundPosition === "string") return layer.backgroundPosition;
  return defaultPositionForFit(fit);
}

export function resolveWidgetBackgroundImageSrc(url: string): string {
  const asset = findTemplateAssetByUrl(url);
  return resolveTemplateAssetUrl(asset?.url ?? url);
}

export function resolveDecorImageLayerPresentation(
  layer: WidgetBackgroundImageLayerStyle,
): {
  url: string;
  displayUrl: string;
  fit: WidgetBackgroundImageFit;
  position: string;
  opacity?: number;
  borderRadius?: CSSProperties["borderRadius"];
} | null {
  return resolveWidgetBackgroundImageLayerPresentation(layer);
}

export function resolveWidgetBackgroundImageLayerPresentation(
  layer: WidgetBackgroundImageLayerStyle,
): {
  url: string;
  displayUrl: string;
  fit: WidgetBackgroundImageFit;
  position: string;
  opacity?: number;
  borderRadius?: CSSProperties["borderRadius"];
} | null {
  const url = parseWidgetBackgroundImageUrl(
    typeof layer.backgroundImage === "string" ? layer.backgroundImage : undefined,
  );
  if (!url) return null;
  const fit = resolveLayerFit(layer, url);
  const position = resolveLayerPosition(layer, fit);
  const opacity = typeof layer.opacity === "number" ? layer.opacity : undefined;
  return {
    url,
    displayUrl: resolveWidgetBackgroundImageSrc(url),
    fit,
    position,
    opacity,
    borderRadius: layer.borderRadius,
  };
}
