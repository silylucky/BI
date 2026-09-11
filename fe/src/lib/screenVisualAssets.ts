import {
  defaultTextConfig,
  defaultMediaConfig,
  type LayoutWidget,
} from "@/components/dashboard/layoutUtils";
import { formatScreenWeekday } from "@/lib/screenTokens";
import { randomId } from "@/lib/randomId";
import type {
  ScreenBorderVariant,
  ScreenShapeKind,
} from "@/lib/screenVisualStyle";
import {
  normalizeScreenBorderStyle,
  normalizeScreenIconStyle,
  normalizeScreenShapeStyle,
} from "@/lib/screenVisualStyle";

/** 文本组件 content 魔术标记（无需后端 schema 扩展） */
export const SCREEN_CLOCK_MARKER = "__vs_screen_clock__";
export const SCREEN_BORDER_MARKER = "__vs_screen_border__";
export const SCREEN_TITLE_BAR_MARKER = "__vs_screen_title_bar__";
export const SCREEN_DATETIME_MARKER = "__vs_screen_datetime__";
export const SCREEN_SHAPE_MARKER = "__vs_screen_shape__";
export const SCREEN_ICON_MARKER = "__vs_screen_icon__";

export type ScreenVisualInsertType =
  | "screen-clock"
  | "screen-border"
  | "screen-title-bar"
  | "screen-datetime";

export type ScreenMaterialInsertType = ScreenVisualInsertType | "screen-webpage";

export function isScreenVisualInsertType(
  type: string,
): type is ScreenVisualInsertType {
  return (
    type === "screen-clock" ||
    type === "screen-border" ||
    type === "screen-title-bar" ||
    type === "screen-datetime"
  );
}

export function isScreenMaterialInsertType(
  type: string,
): type is ScreenMaterialInsertType {
  return isScreenVisualInsertType(type) || type === "screen-webpage";
}

export function isScreenClockWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    widget.type === "text" &&
    widget.textConfig?.content === SCREEN_CLOCK_MARKER
  );
}

export function isScreenBorderWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    widget.type === "text" &&
    widget.textConfig?.content === SCREEN_BORDER_MARKER
  );
}

export function isScreenTitleBarWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    widget.type === "text" &&
    widget.textConfig?.content === SCREEN_TITLE_BAR_MARKER
  );
}

export function isScreenDateTimeWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    widget.type === "text" &&
    widget.textConfig?.content === SCREEN_DATETIME_MARKER
  );
}

export function isScreenShapeWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    widget.type === "text" &&
    widget.textConfig?.content === SCREEN_SHAPE_MARKER
  );
}

export function isScreenIconWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    widget.type === "text" &&
    widget.textConfig?.content === SCREEN_ICON_MARKER
  );
}

export function isScreenWebpageWidget(
  widget: Pick<LayoutWidget, "type" | "mediaConfig">,
): boolean {
  return widget.type === "media" && widget.mediaConfig?.kind === "webpage";
}

export function isScreenVisualWidget(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): boolean {
  return (
    isScreenClockWidget(widget) ||
    isScreenBorderWidget(widget) ||
    isScreenDateTimeWidget(widget) ||
    isScreenShapeWidget(widget) ||
    isScreenIconWidget(widget)
  );
}

/** 素材库 catalog 项 payload（边框/图形/图标） */
export type ScreenMaterialPresetPayload = {
  insert: "screen-border" | "screen-shape" | "screen-icon";
  preset: string;
};

export function isScreenMaterialPresetPayload(
  value: unknown,
): value is ScreenMaterialPresetPayload {
  if (typeof value !== "object" || value === null || !("insert" in value) || !("preset" in value)) {
    return false;
  }
  const insert = (value as ScreenMaterialPresetPayload).insert;
  return insert === "screen-border" || insert === "screen-shape" || insert === "screen-icon";
}

/** 工具栏点击素材库：装饰类素材落画布视口，不进 Tab 0×0 折叠位 */
export function toolbarScreenMaterialSkipsTabHost(type: unknown): boolean {
  if (isScreenMaterialPresetPayload(type)) return true;
  if (typeof type === "string" && isScreenMaterialInsertType(type)) return true;
  return false;
}

/** 已选同类型素材组件时，素材库点击切换样式而非再插一层 */
export function patchScreenMaterialPreset(
  widget: LayoutWidget,
  payload: ScreenMaterialPresetPayload,
): LayoutWidget | null {
  if (!widget.textConfig) return null;
  const screenStyle = widget.textConfig.screenStyle ?? {};
  if (payload.insert === "screen-border" && isScreenBorderWidget(widget)) {
    return {
      ...widget,
      textConfig: {
        ...widget.textConfig,
        screenStyle: {
          ...screenStyle,
          border: {
            ...normalizeScreenBorderStyle(screenStyle.border),
            variant: payload.preset as ScreenBorderVariant,
          },
        },
      },
    };
  }
  if (payload.insert === "screen-shape" && isScreenShapeWidget(widget)) {
    return {
      ...widget,
      textConfig: {
        ...widget.textConfig,
        screenStyle: {
          ...screenStyle,
          shape: {
            ...normalizeScreenShapeStyle(screenStyle.shape),
            shape: payload.preset as ScreenShapeKind,
          },
        },
      },
    };
  }
  if (payload.insert === "screen-icon" && isScreenIconWidget(widget)) {
    return {
      ...widget,
      textConfig: {
        ...widget.textConfig,
        screenStyle: {
          ...screenStyle,
          icon: {
            ...normalizeScreenIconStyle(screenStyle.icon),
            icon: payload.preset,
          },
        },
      },
    };
  }
  return null;
}

/** PixelWidgetSlot：screenStyle 变更须触发画布重渲染 */
export function screenVisualContentRevisionSuffix(
  widget: Pick<LayoutWidget, "type" | "textConfig">,
): string {
  if (!widget.textConfig?.screenStyle) return "";
  if (isScreenBorderWidget(widget)) {
    const border = normalizeScreenBorderStyle(widget.textConfig.screenStyle.border);
    const sparkleKey = border.sparkle.sparkles.map((s) => s.id).join(",");
    return `:sv:border:${border.variant}:${border.accentColor}:${border.glowEnabled}:${border.innerBorderOpacity}:${border.sparkle.enabled}:${sparkleKey}`;
  }
  if (isScreenShapeWidget(widget)) {
    const shape = normalizeScreenShapeStyle(widget.textConfig.screenStyle.shape);
    return `:sv:shape:${shape.shape}:${shape.fillColor}:${shape.strokeColor}:${shape.strokeWidth}`;
  }
  if (isScreenIconWidget(widget)) {
    const icon = normalizeScreenIconStyle(widget.textConfig.screenStyle.icon);
    return `:sv:icon:${icon.icon}:${icon.color}:${icon.size}`;
  }
  return "";
}

export function formatScreenClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatScreenClockWithWeekday(date: Date): { time: string; weekday: string } {
  return {
    time: formatScreenClock(date),
    weekday: formatScreenWeekday(date),
  };
}

export function resolveScreenWidgetLayerLabel(
  widget: Pick<LayoutWidget, "type" | "title" | "textConfig" | "mediaConfig">,
): string {
  if (isScreenClockWidget(widget)) return "素材 · 时钟";
  if (isScreenBorderWidget(widget)) return "素材 · 边框";
  if (isScreenTitleBarWidget(widget)) return widget.title || "标题条";
  if (isScreenDateTimeWidget(widget)) return "素材 · 日期时间";
  if (isScreenShapeWidget(widget)) return "素材 · 图形";
  if (isScreenIconWidget(widget)) return "素材 · 图标";
  if (isScreenWebpageWidget(widget)) return "素材 · 网页";
  if (widget.type === "chart") return widget.title || "图表";
  return widget.title || widgetTypeFallback(widget.type);
}

function widgetTypeFallback(type: LayoutWidget["type"]): string {
  switch (type) {
    case "filter":
      return "筛选";
    case "text":
      return "文本";
    case "media":
      return "媒体";
    case "tabs":
      return "页签";
    default:
      return type;
  }
}

export function createScreenClockWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "text",
    title: "时钟",
    colSpan: at?.colSpan ?? 6,
    rowSpan: at?.rowSpan ?? 1,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: {
      ...defaultTextConfig(),
      content: SCREEN_CLOCK_MARKER,
      variant: "plain",
    },
  };
}

export function createScreenBorderWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
  variant: string = "border-1",
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "text",
    title: "边框装饰",
    colSpan: at?.colSpan ?? 8,
    rowSpan: at?.rowSpan ?? 4,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: {
      ...defaultTextConfig(),
      content: SCREEN_BORDER_MARKER,
      variant: "plain",
      screenStyle: {
        border: { variant: variant as ScreenBorderVariant },
      },
    },
  };
}

export function createScreenTitleBarWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "text",
    title: "标题条",
    colSpan: at?.colSpan ?? 12,
    rowSpan: at?.rowSpan ?? 1,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: {
      ...defaultTextConfig(),
      content: SCREEN_TITLE_BAR_MARKER,
      variant: "plain",
      widgetStyle: {
        backgroundShow: true,
        backgroundMode: "image",
        backgroundImage:
          "/template-assets/packs/gov-enterprise-v1/top-decor-clear/title-clear-diamond-flank-cyan.svg",
        backgroundImageFit: "widthFit",
        backgroundImagePosition: "center",
      },
    },
  };
}

export function createScreenDateTimeWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "text",
    title: "日期时间",
    colSpan: at?.colSpan ?? 6,
    rowSpan: at?.rowSpan ?? 1,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: {
      ...defaultTextConfig(),
      content: SCREEN_DATETIME_MARKER,
      variant: "plain",
    },
  };
}

export function createScreenWebpageWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "media",
    title: "网页",
    colSpan: at?.colSpan ?? 8,
    rowSpan: at?.rowSpan ?? 4,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    mediaConfig: {
      ...defaultMediaConfig(),
      kind: "webpage",
      url: "",
      alt: "网页",
      fit: "fill",
    },
  };
}

export function createScreenShapeWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
  shape: string = "rect",
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  const shapeKind = shape as ScreenShapeKind;
  const label = shapeKind === "rect" ? "矩形" : shapeKind === "triangle" ? "三角形" : "圆形";
  return {
    id: widgetId,
    type: "text",
    title: label,
    colSpan: at?.colSpan ?? 4,
    rowSpan: at?.rowSpan ?? 3,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: {
      ...defaultTextConfig(),
      content: SCREEN_SHAPE_MARKER,
      variant: "plain",
      screenStyle: {
        shape: { shape: shapeKind },
      },
    },
  };
}

export function createScreenIconWidget(
  widgets: LayoutWidget[],
  at?: { gridX: number; gridY: number; colSpan?: number; rowSpan?: number },
  icon: string = "star",
): LayoutWidget {
  const widgetId = randomId();
  const maxOrder = widgets.reduce((m, w) => Math.max(m, w.order), -1);
  return {
    id: widgetId,
    type: "text",
    title: "图标",
    colSpan: at?.colSpan ?? 2,
    rowSpan: at?.rowSpan ?? 2,
    order: maxOrder + 1,
    gridX: at?.gridX,
    gridY: at?.gridY,
    textConfig: {
      ...defaultTextConfig(),
      content: SCREEN_ICON_MARKER,
      variant: "plain",
      screenStyle: {
        icon: { icon },
      },
    },
  };
}
