import { describe, expect, it } from "vitest";
import { defaultTabsConfig, movePixelWidgetIntoTab } from "../layoutUtils";
import type { PixelLayoutWidget } from "../dashboardLayoutContracts";
import { insertPaletteWidgetIntoTabHost } from "./createPixelWidget";
import {
  TAB_PALETTE_DROP_BUFFER_PX,
  activePaneIdForTabHost,
  resolveTabHostForWidgetDrop,
  resolvePaletteInsertTabHost,
  resolveTabPaletteInsertHost,
  tryAbsorbTopLevelWidgetIntoTab,
} from "./tabInsertResolver";

function tabHost(id = "tabs"): PixelLayoutWidget {
  return {
    id,
    type: "tabs",
    title: "页签",
    order: 0,
    x: 100,
    y: 80,
    width: 480,
    height: 280,
    tabsConfig: defaultTabsConfig(id),
  };
}

function layoutWith(host: PixelLayoutWidget) {
  return {
    version: 2 as const,
    canvas: { width: 1440, height: 900 },
    widgets: [host],
    globalFilters: [],
  };
}

describe("resolvePaletteInsertTabHost", () => {
  it("skips tab host for screen border preset (素材库边框落画布)", () => {
    const host = tabHost();
    const layout = layoutWith(host);
    const resolved = resolvePaletteInsertTabHost(
      { insert: "screen-border", preset: "border-1" },
      layout,
      {
        selectedWidgetId: host.id,
        intent: {
          tabsWidgetId: host.id,
          paneId: host.tabsConfig!.activePaneId,
        },
      },
    );
    expect(resolved).toBeUndefined();
  });
});

describe("resolveTabPaletteInsertHost", () => {
  const host = tabHost();
  const layout = layoutWith(host);

  it("prefers explicit tabsWidgetId", () => {
    const resolved = resolveTabPaletteInsertHost(layout, { tabsWidgetId: host.id });
    expect(resolved?.id).toBe(host.id);
  });

  it("uses tabInsertIntent when drop point is outside buffer", () => {
    const paneId = host.tabsConfig!.panes[1]!.id;
    const resolved = resolveTabPaletteInsertHost(layout, {
      point: { x: 0, y: 0 },
      intent: { tabsWidgetId: host.id, paneId },
      dropBufferPx: TAB_PALETTE_DROP_BUFFER_PX,
    });
    expect(resolved?.id).toBe(host.id);
  });

  it("resolves selected tab host when point misses", () => {
    const resolved = resolveTabPaletteInsertHost(layout, {
      point: { x: 0, y: 0 },
      selectedWidgetId: host.id,
      dropBufferPx: TAB_PALETTE_DROP_BUFFER_PX,
    });
    expect(resolved?.id).toBe(host.id);
  });

  it("resolves parent tab when a tab child is selected", () => {
    const child: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图",
      order: 1,
      x: host.x,
      y: host.y,
      width: 0,
      height: 0,
      parentTabsId: host.id,
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
    const nestedLayout = { ...layout, widgets: [host, child] };
    const resolved = resolveTabPaletteInsertHost(nestedLayout, {
      point: { x: 0, y: 0 },
      selectedWidgetId: child.id,
      dropBufferPx: TAB_PALETTE_DROP_BUFFER_PX,
    });
    expect(resolved?.id).toBe(host.id);
  });
});

describe("activePaneIdForTabHost", () => {
  const host = tabHost();

  it("uses intent pane when host matches", () => {
    const paneId = host.tabsConfig!.panes[2]!.id;
    expect(activePaneIdForTabHost(host, { tabsWidgetId: host.id, paneId })).toBe(paneId);
  });

  it("uses selected child pane when intent missing", () => {
    const paneId = host.tabsConfig!.panes[1]!.id;
    const child: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图",
      order: 1,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      parentTabsId: host.id,
      tabPaneId: paneId,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    expect(activePaneIdForTabHost(host, null, child)).toBe(paneId);
  });
});

describe("insertPaletteWidgetIntoTabHost", () => {
  it("parks new widget into active pane without canvas slot search", () => {
    const host = tabHost();
    const layout = layoutWith(host);
    const paneId = host.tabsConfig!.activePaneId;
    const next = insertPaletteWidgetIntoTabHost("bar", layout, host, paneId);
    const child = next.widgets.find((w) => w.id !== host.id);
    expect(child?.parentTabsId).toBe(host.id);
    expect(child?.tabPaneId).toBe(paneId);
    expect(child).toMatchObject({ width: 0, height: 0 });
    const pane = next.widgets
      .find((w) => w.id === host.id)
      ?.tabsConfig?.panes.find((p) => p.id === paneId);
    expect(pane?.childWidgetIds).toContain(child?.id);
  });
});

describe("resolveTabHostForWidgetDrop", () => {
  it("detects tab when widget center is inside host", () => {
    const host = tabHost();
    const layout = layoutWith(host);
    const chart: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图",
      order: 1,
      x: host.x + 40,
      y: host.y + 40,
      width: 200,
      height: 120,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const resolved = resolveTabHostForWidgetDrop(layout, chart, {
      dropBufferPx: TAB_PALETTE_DROP_BUFFER_PX,
    });
    expect(resolved?.id).toBe(host.id);
  });

  it("detects tab when widget overlaps host even if center is outside inner rect", () => {
    const host = tabHost();
    const layout = layoutWith(host);
    const chart: PixelLayoutWidget = {
      id: "chart-2",
      type: "chart",
      title: "图",
      order: 1,
      x: host.x + host.width - 80,
      y: host.y + host.height - 60,
      width: 200,
      height: 120,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const resolved = resolveTabHostForWidgetDrop(layout, chart, {
      dropBufferPx: 0,
      minOverlapPx: 24,
    });
    expect(resolved?.id).toBe(host.id);
  });
});

describe("tryAbsorbTopLevelWidgetIntoTab", () => {
  it("parks existing top-level chart into tab pane", () => {
    const host = tabHost();
    const chart: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图",
      order: 1,
      x: host.x + 60,
      y: host.y + 50,
      width: 240,
      height: 160,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const layout = { ...layoutWith(host), widgets: [host, chart] };
    const next = tryAbsorbTopLevelWidgetIntoTab(layout, chart, {
      dropBufferPx: TAB_PALETTE_DROP_BUFFER_PX,
    });
    expect(next).not.toBeNull();
    const parked = next!.widgets.find((w) => w.id === chart.id);
    expect(parked?.parentTabsId).toBe(host.id);
    expect(parked).toMatchObject({ width: 0, height: 0 });
  });
});

describe("movePixelWidgetIntoTab", () => {
  it("moves chart from canvas into tab and updates childWidgetIds", () => {
    const host = tabHost();
    const chart: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图",
      order: 1,
      x: 20,
      y: 20,
      width: 320,
      height: 200,
      chartConfig: {
        chartType: "bar",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    const layout = { ...layoutWith(host), widgets: [host, chart] };
    const paneId = host.tabsConfig!.activePaneId;
    const next = movePixelWidgetIntoTab(layout, chart.id, host, paneId);
    const parked = next.widgets.find((w) => w.id === chart.id);
    expect(parked?.parentTabsId).toBe(host.id);
    expect(
      next.widgets.find((w) => w.id === host.id)?.tabsConfig?.panes[0]?.childWidgetIds,
    ).toContain(chart.id);
  });
});
