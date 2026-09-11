import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardWidget } from "./DashboardWidget";
import { defaultChartConfig, defaultTextConfig, type LayoutWidget } from "./layoutUtils";

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: () => <div data-testid="chart-renderer">chart</div>,
}));

const DS_ID = "00000000-0000-4000-8000-000000000010";

describe("dashboard field drag integration", () => {
  afterEach(() => cleanup());

  it("chart + text widgets coexist without crashing after config update", () => {
    const chartWidget: LayoutWidget = {
      id: "chart-1",
      type: "chart",
      title: "销售趋势",
      colSpan: 6,
      rowSpan: 2,
      order: 0,
      chartConfig: {
        ...defaultChartConfig("line"),
        dataSourceId: DS_ID,
        mode: "sql",
        sql: "SELECT 1",
        dimensions: [{ field: "sale_date" }],
        metrics: [{ field: "amount" }],
      },
    };
    const textWidget: LayoutWidget = {
      id: "text-1",
      type: "text",
      title: "说明",
      colSpan: 6,
      rowSpan: 2,
      order: 1,
      textConfig: defaultTextConfig(),
    };

    const { rerender } = render(
      <>
        <DashboardWidget widget={chartWidget} mode="edit" onTitleChange={() => {}} />
        <DashboardWidget widget={textWidget} mode="edit" onTitleChange={() => {}} />
      </>,
    );

    expect(screen.getByTestId("chart-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("text-widget-content")).toBeInTheDocument();

    rerender(
      <>
        <DashboardWidget
          widget={{
            ...chartWidget,
            chartConfig: {
              ...chartWidget.chartConfig!,
              metrics: [{ field: "qty" }],
            },
          }}
          mode="edit"
          onTitleChange={() => {}}
        />
        <DashboardWidget widget={textWidget} mode="edit" onTitleChange={() => {}} />
      </>,
    );

    expect(screen.getByTestId("chart-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("text-widget-content")).toBeInTheDocument();
  });
});
