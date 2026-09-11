import {
  TAB_CHILD_DEFAULT_COL_SPAN,
  TAB_CHILD_DEFAULT_ROW_SPAN,
  normalizeWidgetIds,
  sortWidgets,
  type DashboardLayout,
  type DashboardLayoutV1,
  type DashboardLayoutV2,
  type LayoutWidget,
  type PixelLayoutWidget,
} from "./layoutUtils";
import { normalizeWidgetLayout } from "./gridLayoutAdapter";
import { normalizeDashboardGapConfig } from "./gapPolicy";
import { styleConfigHasPersistedFields, type DashboardStyleConfig } from "./dashboardStyleConfig";
import { bootstrapDashboardStyleConfig } from "./dashboardThemeVariants";
import { fitCanvasHeightToContent } from "./pixelCanvas/pixelCanvasHost";
import { sanitizePixelLayoutGeometry } from "./pixelCanvas/layoutSanitize";
import {
  clampCanvasHeightForPersist,
  resolvePersistedCanvasMinHeight,
} from "@/lib/canvasPersistPolicy";
import { sanitizeChartFieldsForValidate } from "@/lib/chartFieldRules";
import { sanitizeCustomVizDataBinding } from "./custom-viz/customVizExecute";
import { stripLinkedWidgetForPersist } from "@/lib/vizComponentEdit";

const CANVAS_WIDTH = 1440 as const;
const MIN_CANVAS_HEIGHT = 900;
const PIXEL_COLUMN_WIDTH = 120;
const PIXEL_ROW_HEIGHT = 32;
const PIXEL_ROW_MARGIN = 12;

export type DashboardCanvasEditor = "grid" | "pixel" | "pixel-readonly";

/** grid = RGL 卡片壳；shape = 像素画布 shape-inner 内容区（对标 DE） */
export type DashboardWidgetShell = "grid" | "shape";

export type PreparedDashboardLayout = {
  editor: DashboardCanvasEditor;
  canSave: boolean;
  layout: DashboardLayout;
};

export function isPixelCanvasEnabled(_value?: string): boolean {
  return true;
}

export function migrateDashboardLayoutV1(layout: DashboardLayoutV1): DashboardLayoutV2 {
  let height = MIN_CANVAS_HEIGHT;
  const widgets = layout.widgets.map((widget) => {
    const { colSpan, rowSpan, gridX, gridY, ...base } = widget;
    const y = (gridY ?? widget.order) * (PIXEL_ROW_HEIGHT + PIXEL_ROW_MARGIN);
    const pixelHeight = rowSpan * PIXEL_ROW_HEIGHT + (rowSpan - 1) * PIXEL_ROW_MARGIN;
    height = Math.max(height, y + pixelHeight);
    return {
      ...base,
      x: (gridX ?? 0) * PIXEL_COLUMN_WIDTH,
      y,
      width: colSpan * PIXEL_COLUMN_WIDTH,
      height: pixelHeight,
    };
  });
  return {
    version: 2,
    canvas: { width: CANVAS_WIDTH, height },
    widgets,
    globalFilters: structuredClone(layout.globalFilters),
    styleConfig: layout.styleConfig
      ? bootstrapDashboardStyleConfig(layout.styleConfig)
      : undefined,
  };
}

/** 载入 / resetLayout 与 save 单路径：Tab 修复；重叠 pack 须显式 packOverlaps */
function preparePixelLayoutGeometry(
  layout: DashboardLayoutV2,
  options?: { packOverlaps?: boolean },
): DashboardLayoutV2 {
  return sanitizePixelLayoutGeometry(layout, layout.styleConfig, options);
}

export function prepareDashboardLayout(
  layout: DashboardLayout,
  pixelEnabled: boolean,
): PreparedDashboardLayout {
  const withStyle = layoutWithHydratedStyle(layout);
  if (withStyle.version === 2) {
    const displayLayout = preparePixelLayoutGeometry(withStyle);
    return {
      editor: pixelEnabled ? "pixel" : "pixel-readonly",
      canSave: pixelEnabled,
      layout: displayLayout,
    };
  }
  if (pixelEnabled) {
    const migrated = migrateDashboardLayoutV1(withStyle);
    return {
      editor: "pixel",
      canSave: true,
      layout: preparePixelLayoutGeometry(migrated),
    };
  }
  return { editor: "grid", canSave: true, layout: withStyle };
}

function layoutWithHydratedStyle(layout: DashboardLayout): DashboardLayout {
  if (!layout.styleConfig) return layout;
  return { ...layout, styleConfig: bootstrapDashboardStyleConfig(layout.styleConfig) };
}

/** DashboardWidget 仍消费栅格 shape；此适配只提供内容渲染所需的显式兼容字段。 */
export function pixelWidgetToLayoutWidget(widget: PixelLayoutWidget): LayoutWidget {
  if (widget.parentTabsId) {
    return {
      ...widget,
      colSpan: TAB_CHILD_DEFAULT_COL_SPAN,
      rowSpan: TAB_CHILD_DEFAULT_ROW_SPAN,
      gridX: 0,
      gridY: 0,
    };
  }
  return {
    ...widget,
    colSpan: Math.max(1, Math.min(12, Math.round(widget.width / PIXEL_COLUMN_WIDTH))),
    rowSpan: Math.max(
      1,
      Math.round((widget.height + PIXEL_ROW_MARGIN) / (PIXEL_ROW_HEIGHT + PIXEL_ROW_MARGIN)),
    ),
    gridX: Math.max(0, Math.min(11, Math.round(widget.x / PIXEL_COLUMN_WIDTH))),
    gridY: Math.max(0, Math.round(widget.y / (PIXEL_ROW_HEIGHT + PIXEL_ROW_MARGIN))),
  };
}

function pixelWidgetContentEqual(
  previous: PixelLayoutWidget,
  edited: LayoutWidget,
): boolean {
  return (
    previous.id === edited.id &&
    previous.type === edited.type &&
    previous.title === edited.title &&
    previous.order === edited.order &&
    previous.hidden === edited.hidden &&
    previous.locked === edited.locked &&
    previous.parentTabsId === edited.parentTabsId &&
    previous.tabPaneId === edited.tabPaneId &&
    previous.chartConfig === edited.chartConfig &&
    previous.textConfig === edited.textConfig &&
    previous.tabsConfig === edited.tabsConfig &&
    previous.filterConfig === edited.filterConfig &&
    previous.mediaConfig === edited.mediaConfig &&
    previous.customVizConfig === edited.customVizConfig &&
    previous.componentRef === edited.componentRef
  );
}

export function mergeLayoutWidgetIntoPixel(
  previous: PixelLayoutWidget,
  edited: LayoutWidget,
): PixelLayoutWidget {
  if (pixelWidgetContentEqual(previous, edited)) {
    return previous;
  }
  const {
    colSpan: _colSpan,
    rowSpan: _rowSpan,
    gridX: _gridX,
    gridY: _gridY,
    ...content
  } = edited;
  return {
    ...previous,
    ...content,
    x: previous.x,
    y: previous.y,
    width: previous.width,
    height: previous.height,
  };
}

const V1_LAYOUT_GEOMETRY_KEYS = [
  "colSpan",
  "rowSpan",
  "gridX",
  "gridY",
  "col_span",
  "row_span",
  "grid_x",
  "grid_y",
] as const;

/** v2 持久化禁止携带栅格几何字段，否则后端 422 */
function stripV1LayoutGeometry<T extends Record<string, unknown>>(widget: T): T {
  const next = { ...widget };
  for (const key of V1_LAYOUT_GEOMETRY_KEYS) {
    delete next[key];
  }
  return next;
}

function persistedStyle(styleConfig: DashboardStyleConfig): DashboardStyleConfig | undefined {
  const hydrated = normalizeDashboardGapConfig(
    bootstrapDashboardStyleConfig(styleConfig),
  );
  return styleConfigHasPersistedFields(hydrated) ? hydrated : undefined;
}

function prepareChartWidgetForPersist<W extends LayoutWidget>(
  widget: W,
  options?: { attachChartId?: boolean },
): W {
  if (widget.type !== "chart" || !widget.chartConfig) return widget;
  const chartConfig = sanitizeChartFieldsForValidate(widget.chartConfig);
  return {
    ...widget,
    chartConfig: options?.attachChartId ? { ...chartConfig, chartId: widget.id } : chartConfig,
  };
}

function prepareCustomVizWidgetForPersist<W extends LayoutWidget>(widget: W): W {
  if (widget.type !== "customViz" || !widget.customVizConfig?.dataBinding) return widget;
  return {
    ...widget,
    customVizConfig: {
      ...widget.customVizConfig,
      dataBinding: sanitizeCustomVizDataBinding(widget.customVizConfig.dataBinding),
    },
  };
}

function prepareWidgetForPersist<W extends LayoutWidget>(
  widget: W,
  options?: { attachChartId?: boolean },
): W {
  return prepareCustomVizWidgetForPersist(
    prepareChartWidgetForPersist(stripLinkedWidgetForPersist(widget), options),
  );
}

/** v1 可规范化栅格；v2 只补公共 ID，严格保留数组顺序、order 与像素几何。 */
export function buildDashboardLayoutForSave(
  layout: DashboardLayout,
  styleConfig: DashboardStyleConfig,
): DashboardLayout {
  if (layout.version === 1) {
    return {
      ...layout,
      widgets: normalizeWidgetIds(
        normalizeWidgetLayout(sortWidgets(layout.widgets)).map((widget) =>
          prepareWidgetForPersist(widget),
        ),
      ),
      styleConfig: persistedStyle(styleConfig),
    };
  }
  const minCanvasHeight = resolvePersistedCanvasMinHeight({ styleConfig });
  const fitted = fitCanvasHeightToContent(
    {
      ...layout,
      widgets: layout.widgets.map((widget) =>
        stripV1LayoutGeometry(
          prepareWidgetForPersist(widget, { attachChartId: true }) as Record<string, unknown>,
        ) as typeof widget,
      ),
      styleConfig: persistedStyle(styleConfig),
    },
    minCanvasHeight,
  );
  return clampCanvasHeightForPersist(fitted, minCanvasHeight);
}

/** 与保存后内存态一致的指纹（不再 pack，保证 WYSIWYG 与 DB 一致） */
export function dashboardPersistFingerprint(
  layout: DashboardLayout,
  styleConfig: DashboardStyleConfig,
  _pixelEnabled: boolean,
): string {
  return JSON.stringify(buildDashboardLayoutForSave(layout, styleConfig));
}
