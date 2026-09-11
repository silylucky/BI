import { describe, expect, it } from "vitest";
import { canUnparkTabChildAtPoint, unparkPixelWidgetFromTab } from "./tabParking";
import type { DashboardLayoutV2, PixelLayoutWidget } from "../layoutUtils";

function defaultTabsConfig(id: string) {
  const paneId = "pane-1";
  return {
    panes: [{ id: paneId, title: "页签 1", childWidgetIds: [] as string[] }],
    activePaneId: paneId,
  };
}

function baseLayout(widgets: PixelLayoutWidget[]): DashboardLayoutV2 {
  return { version: 2, canvas: { width: 1440, height: 900 }, widgets, globalFilters: [] };
}

describe("tabParking", () => {
  it("unpark restores top-level footprint and removes childWidgetIds", () => {
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
    const child: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "热力图",
      order: 1,
      x: 100,
      y: 100,
      width: 0,
      height: 0,
      parentTabsId: "tabs",
      tabPaneId: "pane-1",
      chartConfig: {
        chartType: "heatmap",
        dataSourceId: "ds",
        mode: "sql",
        sql: "select 1",
        dimensions: [],
        metrics: [],
      },
    };
    host.tabsConfig!.panes[0]!.childWidgetIds = ["chart-1"];
    const layout = baseLayout([host, child]);

    const next = unparkPixelWidgetFromTab(layout, "chart-1", { x: 600, y: 400 });
    const unparked = next.widgets.find((w) => w.id === "chart-1");
    const tabs = next.widgets.find((w) => w.id === "tabs");

    expect(unparked?.parentTabsId).toBeUndefined();
    expect(unparked?.width).toBeGreaterThan(0);
    expect(unparked?.height).toBeGreaterThan(0);
    expect(tabs?.tabsConfig?.panes[0]?.childWidgetIds).not.toContain("chart-1");
  });

  it("canUnparkTabChildAtPoint is false while still inside parent tab", () => {
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
    const child: PixelLayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "图表",
      order: 1,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      parentTabsId: "tabs",
      tabPaneId: "pane-1",
    };
    const layout = baseLayout([host, child]);
    expect(canUnparkTabChildAtPoint(layout, "chart-1", { x: 200, y: 200 }, 0)).toBe(false);
    expect(canUnparkTabChildAtPoint(layout, "chart-1", { x: 700, y: 500 }, 0)).toBe(true);
  });
});
