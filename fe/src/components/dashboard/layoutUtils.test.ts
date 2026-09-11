import { describe, expect, it } from "vitest";
import {
  coerceLayoutWidget,
  coerceLayoutWidgets,
  defaultFilterConfig,
  defaultTabsConfig,
  findTabsHostAtPoint,
  getTabChildWidgets,
  getTopLevelPixelWidgets,
  insertPixelWidgetIntoTab,
  moveWidget,
  moveWidgetToExtreme,
  normalizeLayerOrders,
  reconcileTabPaneChildIds,
  resolvePixelTabsHost,
  normalizeWidgetIds,
  parkPixelWidgetInTab,
  sortWidgets,
} from "./layoutUtils";
import type { PixelLayoutWidget } from "./dashboardLayoutContracts";

describe("layoutUtils filter type", () => {
  it("defaults missing type to chart", () => {
    const w = coerceLayoutWidget({
      id: "w1",
      title: "旧组件",
      colSpan: 6,
      rowSpan: 2,
      order: 0,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    } as Parameters<typeof coerceLayoutWidget>[0]);
    expect(w.type).toBe("chart");
    expect(w.chartConfig?.chartType).toBe("bar");
  });

  it("coerces filter widgets with default filterConfig", () => {
    const w = coerceLayoutWidget({ id: "f1", type: "filter", title: "区域", order: 0, colSpan: 4, rowSpan: 2 });
    expect(w.type).toBe("filter");
    expect(w.filterConfig?.filterId).toBe("f1");
    expect(w.filterConfig?.controlType).toBe("text");
  });

  it("normalizeWidgetIds skips filter widgets", () => {
    const filter = coerceLayoutWidget({
      id: "f1",
      type: "filter",
      title: "筛选",
      order: 0,
      colSpan: 4,
      rowSpan: 2,
      filterConfig: defaultFilterConfig("f1"),
    });
    const next = normalizeWidgetIds([filter]);
    expect(next[0].filterConfig?.filterId).toBe("f1");
    expect(next[0].chartConfig).toBeUndefined();
  });

  it("coerceLayoutWidgets batch", () => {
    const list = coerceLayoutWidgets([
      { id: "a", title: "A", order: 0, colSpan: 6, rowSpan: 1 },
      { id: "b", type: "filter", title: "B", order: 1, colSpan: 4, rowSpan: 2 },
    ]);
    expect(list[0].type).toBe("chart");
    expect(list[1].type).toBe("filter");
  });

  it("coerceLayoutWidget migrates slug chart titles to Chinese", () => {
    const w = coerceLayoutWidget({
      id: "w-mix",
      title: "chart-mix-dual-line",
      order: 0,
      colSpan: 6,
      rowSpan: 2,
      chartConfig: {
        chartType: "chart-mix-dual-line",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    } as Parameters<typeof coerceLayoutWidget>[0]);
    expect(w.title).toBe("双线组合图");
  });
});

describe("layoutUtils tabs", () => {
  it("defaultTabsConfig seeds three panes", () => {
    const cfg = defaultTabsConfig("tabs-1");
    expect(cfg.panes).toHaveLength(3);
    expect(cfg.panes[0]?.title).toBe("页签 1");
  });

  it("getTabChildWidgets prefers parentTabsId over stale childWidgetIds", () => {
    const tabsCfg = defaultTabsConfig("tabs-1");
    const paneA = tabsCfg.panes[0]!.id;
    const paneB = tabsCfg.panes[1]!.id;
    const chart: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "销量趋势",
      order: 1,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      parentTabsId: "tabs-1",
      tabPaneId: paneB,
      chartConfig: {
        chartType: "line",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const tabs: PixelLayoutWidget = {
      id: "tabs-1",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      tabsConfig: {
        ...tabsCfg,
        panes: tabsCfg.panes.map((pane) =>
          pane.id === paneA ? { ...pane, childWidgetIds: ["chart-1"] } : pane,
        ),
      },
    };
    expect(getTabChildWidgets([tabs, chart], "tabs-1", paneA)).toEqual([]);
    expect(getTabChildWidgets([tabs, chart], "tabs-1", paneB)).toEqual([chart]);
  });

  it("reconcileTabPaneChildIds repairs childWidgetIds from widget relations", () => {
    const tabsCfg = defaultTabsConfig("tabs-1");
    const paneB = tabsCfg.panes[1]!.id;
    const chart: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "销量趋势",
      order: 1,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      parentTabsId: "tabs-1",
      tabPaneId: paneB,
      chartConfig: {
        chartType: "line",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const tabs: PixelLayoutWidget = {
      id: "tabs-1",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 0,
      y: 0,
      width: 400,
      height: 240,
      tabsConfig: {
        ...tabsCfg,
        panes: tabsCfg.panes.map((pane) =>
          pane.id === tabsCfg.panes[0]!.id ? { ...pane, childWidgetIds: ["chart-1"] } : pane,
        ),
      },
    };
    const next = reconcileTabPaneChildIds([tabs, chart]);
    const repaired = next.find((w) => w.id === "tabs-1")?.tabsConfig?.panes.find((p) => p.id === paneB);
    expect(repaired?.childWidgetIds).toEqual(["chart-1"]);
    expect(
      next.find((w) => w.id === "tabs-1")?.tabsConfig?.panes[0]?.childWidgetIds,
    ).toEqual([]);
  });

  it("getTopLevelPixelWidgets excludes tab children", () => {
    const host: PixelLayoutWidget = {
      id: "tabs",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 10,
      y: 20,
      width: 400,
      height: 240,
      tabsConfig: defaultTabsConfig("tabs"),
    };
    const child: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图表",
      order: 1,
      x: 0,
      y: 0,
      width: 320,
      height: 200,
      parentTabsId: "tabs",
      tabPaneId: host.tabsConfig!.panes[0]!.id,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    expect(getTopLevelPixelWidgets([host, child])).toEqual([host]);
  });

  it("parkPixelWidgetInTab collapses child rect into host", () => {
    const host: PixelLayoutWidget = {
      id: "tabs",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 48,
      y: 96,
      width: 720,
      height: 320,
      tabsConfig: defaultTabsConfig("tabs"),
    };
    const child: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图表",
      order: 1,
      x: 200,
      y: 300,
      width: 480,
      height: 300,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const paneId = host.tabsConfig!.panes[0]!.id;
    const parked = parkPixelWidgetInTab(child, host, paneId);
    expect(parked.parentTabsId).toBe("tabs");
    expect(parked.tabPaneId).toBe(paneId);
    expect(parked).toMatchObject({ x: 48, y: 96, width: 0, height: 0 });
  });

  it("findTabsHostAtPoint returns smallest overlapping tab host", () => {
    const outer: PixelLayoutWidget = {
      id: "tabs-outer",
      type: "tabs",
      title: "外",
      order: 0,
      x: 0,
      y: 0,
      width: 600,
      height: 400,
      tabsConfig: defaultTabsConfig("tabs-outer"),
    };
    const inner: PixelLayoutWidget = {
      id: "tabs-inner",
      type: "tabs",
      title: "内",
      order: 1,
      x: 40,
      y: 40,
      width: 200,
      height: 120,
      tabsConfig: defaultTabsConfig("tabs-inner"),
    };
    expect(findTabsHostAtPoint([outer, inner], { x: 100, y: 80 })?.id).toBe("tabs-inner");
  });

  it("insertPixelWidgetIntoTab parks child and updates pane ids", () => {
    const host: PixelLayoutWidget = {
      id: "tabs",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 10,
      y: 20,
      width: 400,
      height: 240,
      tabsConfig: defaultTabsConfig("tabs"),
    };
    const draft: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图表",
      order: 1,
      x: 200,
      y: 300,
      width: 480,
      height: 300,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const paneId = host.tabsConfig!.panes[0]!.id;
    const layout = {
      version: 2 as const,
      canvas: { width: 1440, height: 900 },
      widgets: [host, draft],
      globalFilters: [],
    };
    const next = insertPixelWidgetIntoTab(layout, draft, host, paneId);
    const child = next.widgets.find((w) => w.id === "chart-1");
    const tabs = next.widgets.find((w) => w.id === "tabs");
    expect(child?.parentTabsId).toBe("tabs");
    expect(child).toMatchObject({ width: 0, height: 0, x: 10, y: 20 });
    expect(tabs?.tabsConfig?.panes[0]?.childWidgetIds).toContain("chart-1");
  });

  it("findTabsHostAtPoint matches collision buffer ring outside strict bounds", () => {
    const host: PixelLayoutWidget = {
      id: "tabs",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 100,
      y: 100,
      width: 400,
      height: 240,
      tabsConfig: defaultTabsConfig("tabs"),
    };
    const layout = {
      version: 2 as const,
      canvas: { width: 1440, height: 900 },
      widgets: [host],
      globalFilters: [],
    };
    expect(findTabsHostAtPoint(layout.widgets, { x: 95, y: 150 }, 0)?.id).toBeUndefined();
    expect(findTabsHostAtPoint(layout.widgets, { x: 95, y: 150 }, 40)?.id).toBe("tabs");
    expect(
      resolvePixelTabsHost(layout, "other-chart", { x: 95, y: 150 }, null, 120)?.id,
    ).toBe("tabs");
  });

  it("resolvePixelTabsHost prefers selected tab over point miss", () => {
    const host: PixelLayoutWidget = {
      id: "tabs",
      type: "tabs",
      title: "页签",
      order: 0,
      x: 100,
      y: 100,
      width: 400,
      height: 240,
      tabsConfig: defaultTabsConfig("tabs"),
    };
    const layout = {
      version: 2 as const,
      canvas: { width: 1440, height: 900 },
      widgets: [host],
      globalFilters: [],
    };
    expect(resolvePixelTabsHost(layout, "tabs", { x: 0, y: 0 })?.id).toBe("tabs");
  });
});

describe("layoutUtils layer siblings", () => {
  const canvasWidgets = [
    { id: "a", type: "chart" as const, title: "A", colSpan: 6, rowSpan: 4, order: 0 },
    { id: "b", type: "chart" as const, title: "B", colSpan: 6, rowSpan: 4, order: 1 },
    { id: "c", type: "chart" as const, title: "C", colSpan: 6, rowSpan: 4, order: 2 },
  ];

  it("moveWidget only swaps among canvas-level siblings", () => {
    const tabChild = {
      id: "tab-child",
      type: "chart" as const,
      title: "Tab 图",
      colSpan: 6,
      rowSpan: 4,
      order: 1,
      parentTabsId: "tabs",
      tabPaneId: "p1",
    };
    const widgets = [...canvasWidgets, tabChild];
    const moved = moveWidget(widgets, "b", "up");
    expect(sortWidgets(moved).filter((w) => !w.parentTabsId).map((w) => w.id)).toEqual(["b", "a", "c"]);
    expect(moved.find((w) => w.id === "tab-child")?.order).toBe(0);
  });

  it("normalizeLayerOrders compacts duplicate orders within sibling groups", () => {
    const widgets = [
      { id: "a", type: "chart" as const, title: "A", colSpan: 6, rowSpan: 4, order: 0 },
      { id: "b", type: "chart" as const, title: "B", colSpan: 6, rowSpan: 4, order: 0 },
      { id: "c", type: "chart" as const, title: "C", colSpan: 6, rowSpan: 4, order: 2 },
    ];
    const normalized = normalizeLayerOrders(widgets);
    expect(normalized.map((w) => ({ id: w.id, order: w.order }))).toEqual([
      { id: "a", order: 0 },
      { id: "b", order: 1 },
      { id: "c", order: 2 },
    ]);
  });

  it("moveWidgetToExtreme send-to-back keeps unique strict orders", () => {
    const widgets = [
      { id: "a", type: "chart" as const, title: "A", colSpan: 6, rowSpan: 4, order: 0 },
      { id: "b", type: "chart" as const, title: "B", colSpan: 6, rowSpan: 4, order: 1 },
      { id: "c", type: "chart" as const, title: "C", colSpan: 6, rowSpan: 4, order: 2 },
    ];
    const once = moveWidgetToExtreme(widgets, "c", "bottom");
    const twice = moveWidgetToExtreme(once, "b", "bottom");
    expect(sortWidgets(twice).filter((w) => !w.parentTabsId).map((w) => w.order)).toEqual([0, 1, 2]);
    expect(sortWidgets(twice).filter((w) => !w.parentTabsId).map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  it("getTopLevelPixelWidgets returns widgets sorted by layer order", () => {
    const widgets: PixelLayoutWidget[] = [
      { id: "back", type: "chart", title: "Back", order: 0, x: 0, y: 0, width: 100, height: 100, chartConfig: { chartType: "bar", dimensions: [], metrics: [] } },
      { id: "front", type: "chart", title: "Front", order: 2, x: 0, y: 0, width: 100, height: 100, chartConfig: { chartType: "bar", dimensions: [], metrics: [] } },
      { id: "mid", type: "chart", title: "Mid", order: 1, x: 0, y: 0, width: 100, height: 100, chartConfig: { chartType: "bar", dimensions: [], metrics: [] } },
    ];
    expect(getTopLevelPixelWidgets(widgets).map((w) => w.id)).toEqual(["back", "mid", "front"]);
  });
});
