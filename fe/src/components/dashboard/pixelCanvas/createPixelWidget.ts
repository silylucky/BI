import {
  isScreenBorderWidget,
  isScreenClockWidget,
  isScreenDateTimeWidget,
  isScreenIconWidget,
  isScreenShapeWidget,
  isScreenTitleBarWidget,
  isScreenWebpageWidget,
} from "@/lib/screenVisualAssets";
import {
  createPaletteWidget,
  type PaletteInsertType,
} from "../createLayoutWidget";
import { cloneLayoutWidget } from "../cloneLayoutWidget";
import {
  COLLISION_COMMIT_MIN_OVERLAP_PX,
  resolvePixelLayoutWithActiveRect,
} from "./collisionLayout";
import { pixelWidgetToLayoutWidget } from "../dashboardCanvasMode";
import type { DashboardCanvas, DashboardLayoutV2, LayoutWidget, PixelLayoutWidget } from "../layoutUtils";
import { insertPixelWidgetIntoTab } from "../layoutUtils";
import type { PaletteDragPayload } from "@/lib/dashboardDnd";
import {
  isScreenMaterialInsertType,
  isScreenVisualInsertType,
} from "@/lib/screenVisualAssets";
import type { PixelPoint, PixelRect } from "./geometry";

/** 1440 基准画布上的默认插入尺寸（约 1/3 宽 × 适中高，编辑态更易辨认） */
export const PIXEL_DEFAULT_CHART_SIZE = { width: 480, height: 300 };
export const PIXEL_DEFAULT_FILTER_SIZE = { width: 320, height: 140 };
export const PIXEL_DEFAULT_TEXT_SIZE = { width: 480, height: 180 };
export const PIXEL_DEFAULT_MEDIA_SIZE = { width: 480, height: 300 };
export const PIXEL_DEFAULT_TABS_SIZE = { width: 720, height: 320 };
export const PIXEL_DEFAULT_SCREEN_CLOCK_SIZE = { width: 420, height: 72 };
export const PIXEL_DEFAULT_SCREEN_BORDER_SIZE = { width: 320, height: 240 };
export const PIXEL_DEFAULT_SCREEN_TITLE_BAR_SIZE = { width: 1920, height: 100 };
export const PIXEL_DEFAULT_SCREEN_DATETIME_SIZE = { width: 320, height: 96 };
export const PIXEL_DEFAULT_SCREEN_WEBPAGE_SIZE = { width: 560, height: 360 };
export const PIXEL_DEFAULT_SCREEN_SHAPE_SIZE = { width: 200, height: 160 };
export const PIXEL_DEFAULT_SCREEN_ICON_SIZE = { width: 96, height: 96 };

export function defaultPixelSizeForWidget(
  widget: Pick<LayoutWidget, "type">,
): { width: number; height: number } {
  return defaultSize({ type: widget.type } as LayoutWidget);
}

function defaultSize(widget: LayoutWidget) {
  switch (widget.type) {
    case "filter":
      return PIXEL_DEFAULT_FILTER_SIZE;
    case "text":
      if (isScreenClockWidget(widget)) return PIXEL_DEFAULT_SCREEN_CLOCK_SIZE;
      if (isScreenBorderWidget(widget)) return PIXEL_DEFAULT_SCREEN_BORDER_SIZE;
      if (isScreenTitleBarWidget(widget)) return PIXEL_DEFAULT_SCREEN_TITLE_BAR_SIZE;
      if (isScreenDateTimeWidget(widget)) return PIXEL_DEFAULT_SCREEN_DATETIME_SIZE;
      if (isScreenShapeWidget(widget)) return PIXEL_DEFAULT_SCREEN_SHAPE_SIZE;
      if (isScreenIconWidget(widget)) return PIXEL_DEFAULT_SCREEN_ICON_SIZE;
      return PIXEL_DEFAULT_TEXT_SIZE;
    case "media":
      if (isScreenWebpageWidget(widget)) return PIXEL_DEFAULT_SCREEN_WEBPAGE_SIZE;
      return PIXEL_DEFAULT_MEDIA_SIZE;
    case "tabs":
      return PIXEL_DEFAULT_TABS_SIZE;
    default:
      return PIXEL_DEFAULT_CHART_SIZE;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function viewportCenterPoint(
  canvas: DashboardCanvas,
  visibleViewport?: PixelRect,
): PixelPoint {
  if (visibleViewport && visibleViewport.width > 0 && visibleViewport.height > 0) {
    return {
      x: visibleViewport.x + visibleViewport.width / 2,
      y: visibleViewport.y + visibleViewport.height / 2,
    };
  }
  return { x: canvas.width / 2, y: canvas.height / 2 };
}

/** 调色板点击（非拖放）落点：优先视口中心，否则居中画布（大屏允许叠放，不再挤左下角空位） */
function placeForPaletteClick(
  size: { width: number; height: number },
  canvas: DashboardCanvas,
  visibleViewport?: PixelRect,
): Pick<PixelLayoutWidget, "x" | "y" | "width" | "height"> {
  if (visibleViewport && visibleViewport.width > 0 && visibleViewport.height > 0) {
    return placeAtPoint(size, canvas, viewportCenterPoint(canvas, visibleViewport));
  }
  return placeAtPoint(size, canvas, viewportCenterPoint(canvas));
}

export function defaultPixelSizeForPalettePayload(
  payload: PaletteDragPayload,
): { width: number; height: number } {
  if (payload === "filter") return PIXEL_DEFAULT_FILTER_SIZE;
  if (payload === "text") return PIXEL_DEFAULT_TEXT_SIZE;
  if (payload === "media") return PIXEL_DEFAULT_MEDIA_SIZE;
  if (payload === "tabs") return PIXEL_DEFAULT_TABS_SIZE;
  if (isScreenMaterialInsertType(payload)) {
    if (typeof payload === "object" && "insert" in payload) {
      switch (payload.insert) {
        case "screen-border":
          return PIXEL_DEFAULT_SCREEN_BORDER_SIZE;
        case "screen-shape":
          return PIXEL_DEFAULT_SCREEN_SHAPE_SIZE;
        case "screen-icon":
          return PIXEL_DEFAULT_SCREEN_ICON_SIZE;
        default:
          break;
      }
    }
    switch (payload) {
      case "screen-clock":
        return PIXEL_DEFAULT_SCREEN_CLOCK_SIZE;
      case "screen-border":
        return PIXEL_DEFAULT_SCREEN_BORDER_SIZE;
      case "screen-title-bar":
        return PIXEL_DEFAULT_SCREEN_TITLE_BAR_SIZE;
      case "screen-datetime":
        return PIXEL_DEFAULT_SCREEN_DATETIME_SIZE;
      case "screen-webpage":
        return PIXEL_DEFAULT_SCREEN_WEBPAGE_SIZE;
      default:
        break;
    }
  }
  if (isScreenVisualInsertType(payload)) {
    return PIXEL_DEFAULT_TEXT_SIZE;
  }
  return PIXEL_DEFAULT_CHART_SIZE;
}

export const PALETTE_DROP_PREVIEW_WIDGET_ID = "__palette-drop-preview__";

export function buildPaletteDropPreviewWidget(
  _payload: PaletteDragPayload,
  rect: PixelRect,
  order: number,
): PixelLayoutWidget {
  return {
    id: PALETTE_DROP_PREVIEW_WIDGET_ID,
    type: "chart",
    title: "",
    order,
    ...rect,
  };
}

export function resolvePaletteDropPreviewRect(
  point: PixelPoint,
  payload: PaletteDragPayload,
  canvas: DashboardCanvas,
): PixelRect {
  return placeAtPoint(defaultPixelSizeForPalettePayload(payload), canvas, point);
}

function placeAtPoint(
  size: { width: number; height: number },
  canvas: DashboardCanvas,
  point: PixelPoint,
): Pick<PixelLayoutWidget, "x" | "y" | "width" | "height"> {
  const width = Math.min(size.width, canvas.width);
  const height = Math.min(size.height, canvas.height);
  const x = clamp(Math.round(point.x - width / 2), 0, Math.max(0, canvas.width - width));
  const y = clamp(Math.round(point.y - height / 2), 0, Math.max(0, canvas.height - height));
  return { x, y, width, height };
}

function buildDraftWidget(
  type: PaletteInsertType,
  widgets: PixelLayoutWidget[],
  placement: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
): PixelLayoutWidget {
  const legacy = createPaletteWidget(
    type,
    widgets.map((widget) => ({
      ...widget,
      colSpan: 1,
      rowSpan: 1,
      gridX: undefined,
      gridY: undefined,
    })),
  );
  const { colSpan: _colSpan, rowSpan: _rowSpan, gridX: _gridX, gridY: _gridY, ...base } =
    legacy;
  return { ...base, ...placement };
}

function resolveInsert(
  layout: DashboardLayoutV2,
  draft: PixelLayoutWidget,
): DashboardLayoutV2 {
  return resolvePixelLayoutWithActiveRect(
    { ...layout, widgets: [...layout.widgets, draft] },
    draft.id,
    {
      x: draft.x,
      y: draft.y,
      width: draft.width,
      height: draft.height,
    },
    { minOverlap: COLLISION_COMMIT_MIN_OVERLAP_PX },
  );
}

export function clonePixelLayoutWidget(
  source: PixelLayoutWidget,
  widgets: PixelLayoutWidget[],
): PixelLayoutWidget {
  const legacyWidgets = widgets.map(pixelWidgetToLayoutWidget);
  const cloned = cloneLayoutWidget(pixelWidgetToLayoutWidget(source), legacyWidgets);
  const {
    colSpan: _colSpan,
    rowSpan: _rowSpan,
    gridX: _gridX,
    gridY: _gridY,
    ...base
  } = cloned;
  return {
    ...base,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
  };
}

export function insertPixelPaletteWidget(
  type: PaletteInsertType,
  layout: DashboardLayoutV2,
  visibleViewport?: PixelRect,
): DashboardLayoutV2 {
  const legacyWidgets = layout.widgets.map((widget) => ({
    ...widget,
    colSpan: 1,
    rowSpan: 1,
    gridX: undefined,
    gridY: undefined,
  }));
  const legacy = createPaletteWidget(type, legacyWidgets);
  const placement = placeForPaletteClick(
    defaultSize(legacy),
    layout.canvas,
    visibleViewport,
  );
  const draft = buildDraftWidget(type, layout.widgets, placement);
  return resolveInsert(layout, draft);
}

export function insertPixelPaletteWidgetAt(
  type: PaletteInsertType,
  layout: DashboardLayoutV2,
  point: PixelPoint,
): DashboardLayoutV2 {
  const legacyWidgets = layout.widgets.map((widget) => ({
    ...widget,
    colSpan: 1,
    rowSpan: 1,
    gridX: undefined,
    gridY: undefined,
  }));
  const legacy = createPaletteWidget(type, legacyWidgets);
  const placement = placeAtPoint(defaultSize(legacy), layout.canvas, point);
  const draft = buildDraftWidget(type, layout.widgets, placement);
  return resolveInsert(layout, draft);
}

/** 直接向 Tab 页签插入（折叠占位，不经画布开放槽位） */
export function insertPaletteWidgetIntoTabHost(
  type: PaletteInsertType,
  layout: DashboardLayoutV2,
  host: PixelLayoutWidget,
  tabPaneId: string,
): DashboardLayoutV2 {
  const draft = buildDraftWidget(type, layout.widgets, {
    x: host.x,
    y: host.y,
    width: 0,
    height: 0,
  });
  return insertPixelWidgetIntoTab(
    { ...layout, widgets: [...layout.widgets, draft] },
    draft,
    host,
    tabPaneId,
  );
}

export function createPixelPaletteWidget(
  type: PaletteInsertType,
  widgets: PixelLayoutWidget[],
  canvas: DashboardCanvas,
  visibleViewport?: PixelRect,
): PixelLayoutWidget {
  const layout: DashboardLayoutV2 = {
    version: 2,
    canvas,
    widgets,
    globalFilters: [],
  };
  const beforeIds = new Set(widgets.map((widget) => widget.id));
  const resolved = insertPixelPaletteWidget(type, layout, visibleViewport);
  return resolved.widgets.find((item) => !beforeIds.has(item.id))!;
}

export function insertClonedPixelWidget(
  widget: LayoutWidget,
  layout: DashboardLayoutV2,
  visibleViewport?: PixelRect,
  sourcePixel?: PixelLayoutWidget,
): DashboardLayoutV2 {
  const size = sourcePixel
    ? {
        width: Math.min(sourcePixel.width, layout.canvas.width),
        height: Math.min(sourcePixel.height, layout.canvas.height),
      }
    : defaultSize(widget);
  const placement = placeForPaletteClick(
    size,
    layout.canvas,
    visibleViewport,
  );
  const {
    colSpan: _colSpan,
    rowSpan: _rowSpan,
    gridX: _gridX,
    gridY: _gridY,
    ...base
  } = widget;
  const draft: PixelLayoutWidget = { ...base, ...placement };
  return resolveInsert(layout, draft);
}

export function placeClonedPixelWidget(
  widget: LayoutWidget,
  widgets: PixelLayoutWidget[],
  canvas: DashboardCanvas,
  visibleViewport?: PixelRect,
  sourcePixel?: PixelLayoutWidget,
): PixelLayoutWidget {
  const resolved = insertClonedPixelWidget(
    widget,
    { version: 2, canvas, widgets, globalFilters: [] },
    visibleViewport,
    sourcePixel,
  );
  return resolved.widgets.find((item) => item.id === widget.id)!;
}
