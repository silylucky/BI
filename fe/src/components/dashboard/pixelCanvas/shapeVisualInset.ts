import type { WidgetStyleConfig } from "@/components/dashboard/dashboardStyleConfig";

export type ShapeEdgeInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const ZERO_SHAPE_INSET: ShapeEdgeInset = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/** shape-inner 相对外框的内缩：边框 + 内边距（不含 curGap，curGap 单独传入） */
export function resolveWidgetChromeInset(
  widgetStyle?: WidgetStyleConfig,
): ShapeEdgeInset {
  if (!widgetStyle) return ZERO_SHAPE_INSET;
  const border =
    widgetStyle.borderEnabled !== false ? Math.max(0, widgetStyle.borderWidth ?? 1) : 0;
  const mode = widgetStyle.paddingMode ?? "unified";
  if (mode === "individual") {
    return {
      top: border + (widgetStyle.paddingTop ?? widgetStyle.padding ?? 0),
      right: border + (widgetStyle.paddingRight ?? widgetStyle.padding ?? 0),
      bottom: border + (widgetStyle.paddingBottom ?? widgetStyle.padding ?? 0),
      left: border + (widgetStyle.paddingLeft ?? widgetStyle.padding ?? 0),
    };
  }
  const pad = widgetStyle.padding ?? 0;
  const edge = border + pad;
  if (!edge) return ZERO_SHAPE_INSET;
  return { top: edge, right: edge, bottom: edge, left: edge };
}
