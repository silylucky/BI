import { describe, expect, it } from "vitest";
import type { DashboardLayoutV1, DashboardLayoutV2 } from "./layoutUtils";
import {
  buildDashboardLayoutForSave,
  dashboardPersistFingerprint,
  isPixelCanvasEnabled,
  mergeLayoutWidgetIntoPixel,
  migrateDashboardLayoutV1,
  pixelWidgetToLayoutWidget,
  prepareDashboardLayout,
} from "./dashboardCanvasMode";
import { TAB_CHILD_DEFAULT_COL_SPAN, TAB_CHILD_DEFAULT_ROW_SPAN } from "./layoutUtils";
import { layoutsOverlap, packPixelLayoutSeamless } from "./pixelCanvas/collisionLayout";
import { persistDashboardLayout } from "./stylePipeline";
import { bootstrapDashboardStyleConfig } from "./dashboardThemeVariants";

const v1: DashboardLayoutV1 = {
  version: 1,
  widgets: [
    {
      id: "w1",
      type: "chart",
      title: "图表",
      order: 0,
      colSpan: 6,
      rowSpan: 2,
      gridX: 2,
      gridY: 3,
    },
  ],
  globalFilters: [{ id: "f1" }],
  styleConfig: { widgetGap: 8 },
};

const v2: DashboardLayoutV2 = {
  version: 2,
  canvas: { width: 1440, height: 900 },
  widgets: [
    {
      id: "w1",
      type: "chart",
      title: "图表",
      order: 0,
      x: 120,
      y: 100,
      width: 480,
      height: 320,
    },
  ],
  globalFilters: [],
};

describe("dashboard canvas mode", () => {
  it("像素画布固定开启", () => {
    expect(isPixelCanvasEnabled(undefined)).toBe(true);
    expect(isPixelCanvasEnabled("")).toBe(true);
    expect(isPixelCanvasEnabled("0")).toBe(true);
    expect(isPixelCanvasEnabled("false")).toBe(true);
  });

  it.each([
    [true, v1, "pixel", true, 2],
    [true, v2, "pixel", true, 2],
    [false, v1, "grid", true, 1],
    [false, v2, "pixel-readonly", false, 2],
  ] as const)(
    "按 flag/layout 选择四象限编辑策略",
    (enabled, source, editor, canSave, version) => {
      const result = prepareDashboardLayout(source, enabled);
      expect(result.editor).toBe(editor);
      expect(result.canSave).toBe(canSave);
      expect(result.layout.version).toBe(version);
    },
  );

  it("v1 内存迁移保持配置并使用与后端一致的确定性像素几何", () => {
    const migrated = migrateDashboardLayoutV1(v1);
    expect(migrated).toMatchObject({
      version: 2,
      canvas: { width: 1440, height: 900 },
      globalFilters: [{ id: "f1" }],
      styleConfig: { widgetGap: 8 },
      widgets: [
        {
          id: "w1",
          x: 240,
          y: 132,
          width: 720,
          height: 76,
        },
      ],
    });
    expect(migrated.widgets[0]).not.toHaveProperty("colSpan");
  });

  it("buildDashboardLayoutForSave strips v1 geometry from v2 widgets", () => {
    const mixed: DashboardLayoutV2 = {
      ...v2,
      widgets: [
        {
          ...v2.widgets[0]!,
          colSpan: 6,
          rowSpan: 2,
          gridX: 1,
          gridY: 2,
        },
      ],
    };
    const saved = buildDashboardLayoutForSave(mixed, { widgetGap: 8 });
    expect(saved.version).toBe(2);
    if (saved.version !== 2) return;
    expect(saved.widgets[0]).not.toHaveProperty("colSpan");
    expect(saved.widgets[0]).not.toHaveProperty("gridX");
    expect(saved.widgets[0]).toMatchObject({ x: 120, y: 100, width: 480, height: 320 });
  });

  it("prepareDashboardLayout preserves overlapping top-level widgets on load", () => {
    const overlapping: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "a",
          type: "chart",
          title: "A",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 300,
        },
        {
          id: "b",
          type: "chart",
          title: "B",
          order: 1,
          x: 100,
          y: 100,
          width: 400,
          height: 300,
        },
      ],
      globalFilters: [],
    };
    const prepared = prepareDashboardLayout(overlapping, true);
    expect(prepared.layout.version).toBe(2);
    if (prepared.layout.version !== 2) return;
    expect(layoutsOverlap(prepared.layout, 0)).toBe(true);
  });

  it("persistDashboardLayout preserves overlapping widgets without implicit pack", () => {
    const overlapping: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "a",
          type: "chart",
          title: "A",
          order: 0,
          x: 0,
          y: 0,
          width: 400,
          height: 300,
        },
        {
          id: "b",
          type: "chart",
          title: "B",
          order: 1,
          x: 100,
          y: 100,
          width: 400,
          height: 300,
        },
      ],
      globalFilters: [],
    };
    const saved = persistDashboardLayout(overlapping, { widgetGap: 8 });
    expect(saved.version).toBe(2);
    if (saved.version !== 2) return;
    expect(layoutsOverlap(saved, 0)).toBe(true);
  });

  it("save 往返保持稀疏布局坐标（不隐式 pack）", () => {
    const sparse: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "a",
          type: "chart",
          title: "A",
          order: 0,
          x: 600,
          y: 400,
          width: 320,
          height: 240,
        },
        {
          id: "b",
          type: "text",
          title: "B",
          order: 1,
          x: 100,
          y: 80,
          width: 200,
          height: 120,
        },
      ],
      globalFilters: [],
    };
    const style = { widgetGap: 8 };
    const saved = buildDashboardLayoutForSave(sparse, style);
    expect(saved.version).toBe(2);
    if (saved.version !== 2) return;
    for (const widget of sparse.widgets) {
      const persisted = saved.widgets.find((w) => w.id === widget.id)!;
      expect(persisted).toMatchObject({
        x: widget.x,
        y: widget.y,
        width: widget.width,
        height: widget.height,
      });
    }
    const fingerprint = dashboardPersistFingerprint(sparse, style, true);
    expect(fingerprint).toBe(JSON.stringify(saved));
  });

  it("buildDashboardLayoutForSave strips empty dimension placeholders before persist", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "map-1",
          type: "chart",
          title: "区域地图",
          order: 0,
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          chartConfig: {
            chartType: "map",
            dimensions: [{ field: "province" }, { field: "" }, { field: "  " }],
            metrics: [{ field: "value" }, { field: "" }],
          },
        },
      ],
      globalFilters: [],
    };
    const saved = buildDashboardLayoutForSave(layout, { widgetGap: 8 });
    const chart = saved.widgets[0];
    expect(chart.type).toBe("chart");
    if (chart.type !== "chart" || !chart.chartConfig) throw new Error("expected chart widget");
    expect(chart.chartConfig.dimensions).toEqual([{ field: "province", label: "省份" }]);
    expect(chart.chartConfig.metrics).toEqual([{ field: "value", label: "数值" }]);
    expect(chart.chartConfig.chartId).toBe("map-1");
  });

  it("buildDashboardLayoutForSave strips linked chart to geo instance overlay only", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "map-linked",
          type: "chart",
          title: "区域地图",
          order: 0,
          x: 0,
          y: 0,
          width: 480,
          height: 360,
          componentRef: { componentId: "550e8400-e29b-41d4-a716-446655440099" },
          chartConfig: {
            chartId: "map-linked",
            chartType: "map",
            mode: "sql",
            dataSourceId: "ds-1",
            sql: "select 1",
            dimensions: [{ field: "province" }],
            metrics: [{ field: "total" }],
            nativeBody: {
              deStyle: {
                geo: {
                  manualDrillStack: [
                    { field: "province", value: "内蒙古自治区", label: "内蒙古自治区" },
                  ],
                },
              },
            },
          },
        },
      ],
      globalFilters: [],
    };
    const saved = buildDashboardLayoutForSave(layout, { widgetGap: 8 });
    const chart = saved.widgets[0];
    expect(chart.type).toBe("chart");
    if (chart.type !== "chart") throw new Error("expected chart widget");
    expect(chart.componentRef).toEqual({
      componentId: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(chart.chartConfig?.dataSourceId).toBeUndefined();
    expect(chart.chartConfig?.nativeBody?.deStyle?.geo?.manualDrillStack).toEqual([
      { field: "province", value: "内蒙古自治区", label: "内蒙古自治区" },
    ]);
    expect(chart.chartConfig?.chartId).toBe("map-linked");
  });

  it("buildDashboardLayoutForSave persists themeVariants for DE dual-theme round-trip", () => {
    const layout: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [],
      globalFilters: [],
    };
    const style = bootstrapDashboardStyleConfig({ colorScheme: "dark" });
    const saved = buildDashboardLayoutForSave(layout, style);
    expect(saved.styleConfig?.themeVariants?.light?.canvasBackground).toBe("#ffffff");
    expect(saved.styleConfig?.themeVariants?.dark?.canvasBackground).toBe("#0f172a");
    expect(saved.styleConfig?.colorScheme).toBe("dark");
  });

  it("pixelWidgetToLayoutWidget 为 Tab 子组件提供默认栅格占位", () => {
    const parked = pixelWidgetToLayoutWidget({
      id: "child",
      type: "chart",
      title: "图表",
      order: 1,
      x: 10,
      y: 20,
      width: 0,
      height: 0,
      parentTabsId: "tabs",
      tabPaneId: "pane-1",
    });
    expect(parked.colSpan).toBe(TAB_CHILD_DEFAULT_COL_SPAN);
    expect(parked.rowSpan).toBe(TAB_CHILD_DEFAULT_ROW_SPAN);
  });

  it("pack 会改变非紧凑布局（说明 hydrate 不可默认 pack）", () => {
    const sparse: DashboardLayoutV2 = {
      version: 2,
      canvas: { width: 1440, height: 900 },
      widgets: [
        {
          id: "a",
          type: "chart",
          title: "A",
          order: 0,
          x: 600,
          y: 400,
          width: 320,
          height: 240,
        },
      ],
      globalFilters: [],
    };
    const packed = packPixelLayoutSeamless(sparse);
    expect(packed.widgets[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("mergeLayoutWidgetIntoPixel 内容未变时复用 previous 引用", () => {
    const previous = v2.widgets[0];
    const edited = pixelWidgetToLayoutWidget(previous);
    expect(mergeLayoutWidgetIntoPixel(previous, edited)).toBe(previous);
  });

  it("mergeLayoutWidgetIntoPixel 同步 hidden/locked/order 图层元数据", () => {
    const previous = v2.widgets[0]!;
    const edited = {
      ...pixelWidgetToLayoutWidget(previous),
      hidden: true,
      locked: true,
      order: 9,
    };
    const merged = mergeLayoutWidgetIntoPixel(previous, edited);
    expect(merged).not.toBe(previous);
    expect(merged).toMatchObject({
      hidden: true,
      locked: true,
      order: 9,
      x: previous.x,
      y: previous.y,
      width: previous.width,
      height: previous.height,
    });
  });

  it("mergeLayoutWidgetIntoPixel 同步 customVizConfig 变更", () => {
    const previous = {
      ...v2.widgets[0]!,
      type: "customViz" as const,
      customVizConfig: {
        artifactId: "art-1",
        dataBinding: { status: "manual" as const },
      },
    };
    const edited = {
      ...pixelWidgetToLayoutWidget(previous),
      customVizConfig: {
        artifactId: "art-1",
        dataBinding: {
          status: "connected" as const,
          datasetId: "ds-1",
          configId: "cfg-1",
          dimensions: [{ field: "grid_name" }],
          metrics: [{ field: "event_count", agg: "sum" as const }],
        },
      },
    };
    const merged = mergeLayoutWidgetIntoPixel(previous, edited);
    expect(merged).not.toBe(previous);
    expect(merged.customVizConfig?.dataBinding?.datasetId).toBe("ds-1");
  });
});
