import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabsWidget } from "./TabsWidget";
import type { LayoutWidget } from "./layoutUtils";

const tabsWidget: LayoutWidget & { tabsConfig: NonNullable<LayoutWidget["tabsConfig"]> } = {
  id: "tabs-1",
  type: "tabs",
  title: "页签容器",
  order: 1,
  x: 0,
  y: 0,
  width: 800,
  height: 400,
  tabsConfig: {
    activePaneId: "pane-a",
    panes: [
      { id: "pane-a", title: "页签 A", childWidgetIds: ["child-a"] },
      { id: "pane-b", title: "页签 B", childWidgetIds: ["child-b"] },
    ],
    carousel: { enabled: true, intervalSec: 3 },
  },
};

const allWidgets: LayoutWidget[] = [
  tabsWidget,
  {
    id: "child-a",
    type: "chart",
    title: "图表 A",
    order: 2,
    parentTabsId: "tabs-1",
    tabPaneId: "pane-a",
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    chartConfig: {
      chartType: "bar",
      chartId: "child-a",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT 1",
      dimensions: [],
      metrics: [],
    },
  },
  {
    id: "child-b",
    type: "chart",
    title: "图表 B",
    order: 3,
    parentTabsId: "tabs-1",
    tabPaneId: "pane-b",
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    chartConfig: {
      chartType: "line",
      chartId: "child-b",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT 2",
      dimensions: [],
      metrics: [],
    },
  },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TabsWidget carousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("advances active pane in view mode when carousel is enabled", () => {
    const onTabsConfigChange = vi.fn();
    render(
      <TabsWidget
        widget={tabsWidget}
        allWidgets={allWidgets}
        mode="view"
        onTabsConfigChange={onTabsConfigChange}
        renderChild={(child) => <div data-testid={`child-${child.id}`}>{child.title}</div>}
      />,
    );

    expect(screen.getByTestId("child-child-a")).toBeInTheDocument();
    vi.advanceTimersByTime(3000);
    expect(onTabsConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ activePaneId: "pane-b" }),
    );
  });

  it("does not auto-advance panes in edit mode", () => {
    const onTabsConfigChange = vi.fn();
    render(
      <TabsWidget
        widget={tabsWidget}
        allWidgets={allWidgets}
        mode="edit"
        onTabsConfigChange={onTabsConfigChange}
        renderChild={(child) => <div>{child.title}</div>}
      />,
    );

    vi.advanceTimersByTime(10000);
    expect(onTabsConfigChange).not.toHaveBeenCalled();
  });
});
