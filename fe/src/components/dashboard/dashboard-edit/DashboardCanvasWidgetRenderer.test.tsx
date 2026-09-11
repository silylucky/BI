import { cleanup, render, screen } from "@testing-library/react";
import { forwardRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultChartConfig, type LayoutWidget } from "../layoutUtils";
import { DashboardCanvasWidgetRenderer } from "./DashboardCanvasWidgetRenderer";

const contextMenuSpy = vi.fn();

vi.mock("../WidgetContextMenu", () => ({
  DashboardWidgetContextMenu: ({
    widget,
    actions,
    children,
  }: {
    widget: { id: string };
    actions: { onCopy?: () => void; onDelete?: () => void };
    children: ReactNode;
  }) => {
    contextMenuSpy({ widgetId: widget.id, actions });
    return <div data-testid={`context-menu-stub-${widget.id}`}>{children}</div>;
  },
}));

vi.mock("../DashboardWidget", () => ({
  DashboardWidget: forwardRef<
    HTMLDivElement,
    { showToolbarDelete?: boolean }
  >(function DashboardWidgetMock({ showToolbarDelete }, ref) {
    return (
      <div
        ref={ref}
        data-testid="grid-widget-mock"
        data-show-toolbar-delete={showToolbarDelete ? "true" : "false"}
      >
        widget
      </div>
    );
  }),
}));

const chartWidget: LayoutWidget = {
  id: "w-grid",
  type: "chart",
  title: "图表",
  colSpan: 6,
  rowSpan: 3,
  order: 0,
  chartConfig: defaultChartConfig("bar"),
};

const widgetActions = { onCopy: vi.fn(), onDelete: vi.fn() };

const baseProps = {
  mode: "edit" as const,
  selected: true,
  linkage: { filters: [], linkageRules: [] },
  filterValues: {},
  onFilterValueChange: vi.fn(),
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  setWidgets: vi.fn(),
  shell: "grid" as const,
};

describe("DashboardCanvasWidgetRenderer context menu", () => {
  afterEach(() => {
    cleanup();
    contextMenuSpy.mockClear();
  });

  it("mounts widget context menu for grid edit widgets and hides toolbar delete", () => {
    render(
      <DashboardCanvasWidgetRenderer
        {...baseProps}
        widget={chartWidget}
        widgetActions={widgetActions}
      />,
    );

    expect(screen.getByTestId("context-menu-stub-w-grid")).toBeInTheDocument();
    expect(contextMenuSpy).toHaveBeenCalledWith({
      widgetId: "w-grid",
      actions: widgetActions,
    });
    expect(screen.getByTestId("grid-widget-mock")).toHaveAttribute(
      "data-show-toolbar-delete",
      "false",
    );
  });

  it("shows toolbar delete when context menu chrome is off", () => {
    render(
      <DashboardCanvasWidgetRenderer
        {...baseProps}
        widget={chartWidget}
        widgetActions={widgetActions}
        dashboardStyle={{ chrome: { showFloatingActions: false } }}
      />,
    );

    expect(screen.queryByTestId("context-menu-stub-w-grid")).not.toBeInTheDocument();
    expect(contextMenuSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("grid-widget-mock")).toHaveAttribute(
      "data-show-toolbar-delete",
      "true",
    );
  });
});
