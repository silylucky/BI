import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import type { LayoutWidget } from "../layoutUtils";
import { ChartAxisStyleSection } from "./ChartCartesianStyleSections";

const lineWidget: LayoutWidget = {
  id: "w1",
  type: "chart",
  title: "销售趋势",
  order: 1,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    chartType: "line",
    styleVariant: "default",
    mode: "sql",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    sql: "SELECT 1",
    dimensions: [{ field: "dt" }],
    metrics: [{ field: "amount" }],
  },
};

const scatterWidget: LayoutWidget = {
  ...lineWidget,
  id: "w2",
  chartConfig: {
    ...lineWidget.chartConfig!,
    chartType: "scatter",
  },
};

afterEach(cleanup);

describe("ChartAxisStyleSection", () => {
  it("shows label direction on category x-axis for line charts", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={lineWidget} onChange={vi.fn()} dashboardStyle={{}}>
          <ChartAxisStyleSection />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "坐标轴" }));
    expect(screen.getByLabelText("横轴标签方向")).toHaveTextContent("水平");
    expect(screen.queryByLabelText("纵轴标签方向")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("横轴标签方向"));
    expect(screen.getByRole("option", { name: "水平" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "倾斜" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "垂直" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "自动" })).toBeInTheDocument();
  });

  it("hides label direction for numeric dual-axis scatter charts", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={scatterWidget} onChange={vi.fn()} dashboardStyle={{}}>
          <ChartAxisStyleSection />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByLabelText("横轴标签方向")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("纵轴标签方向")).not.toBeInTheDocument();
  });

  it("patches labelRotate when selecting tilt", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={lineWidget} onChange={onChange} dashboardStyle={{}}>
          <ChartAxisStyleSection />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "坐标轴" }));
    await user.click(screen.getByLabelText("横轴标签方向"));
    await user.click(screen.getByRole("option", { name: "倾斜" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeBody: expect.objectContaining({
          deStyle: expect.objectContaining({
            axis: expect.objectContaining({
              x: expect.objectContaining({ labelRotate: -45 }),
            }),
          }),
        }),
      }),
    );
  });
});
