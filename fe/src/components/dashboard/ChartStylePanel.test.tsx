import { useState, type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChartStylePanel } from "./ChartStylePanel";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import { readChartDeStyle } from "@/lib/chartDeStyle";
import type { LayoutWidget } from "./layoutUtils";

function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: vi.fn().mockResolvedValue({ items: [] }),
  };
});

vi.mock("@/lib/chartRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartRegistry")>();
  return {
    ...actual,
    fetchChartTypeCatalog: vi.fn().mockResolvedValue([
      {
        type: "bar",
        displayName: "柱状图",
        category: "basic",
        renderer: "antv",
        styleVariants: ["default", "stacked"],
        fieldRule: {},
      },
    ]),
  };
});

const widget: LayoutWidget = {
  id: "w1",
  type: "chart",
  title: "销售趋势",
  order: 1,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    chartType: "bar",
    styleVariant: "default",
    mode: "sql",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    sql: "SELECT 1",
    dimensions: [{ field: "region" }],
    metrics: [{ field: "amount" }],
  },
};

afterEach(cleanup);

describe("ChartStylePanel", () => {
  it("renders DE-style accordion sections for cartesian charts", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widget} onChange={onChange}>
          <ChartStylePanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "图表配色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图例" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "背景" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "图表配色" }));
    expect(screen.getByRole("button", { name: "配色方案" })).toBeInTheDocument();
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "渐变颜色" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "显示图表标签" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "显示图表提示" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "标签" }));
    expect(screen.getByRole("switch", { name: "显示数据标签" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "提示" }));
    expect(screen.getByRole("switch", { name: "显示提示" })).toBeInTheDocument();

    const backgroundSwitch = screen.getByRole("switch", { name: "启用背景" });
    expect(backgroundSwitch).toBeChecked();
    expect(screen.getByRole("button", { name: "背景" })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "背景" }));
    expect(screen.getByRole("button", { name: "背景" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "图片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "装饰边框" })).toBeInTheDocument();

    await user.click(backgroundSwitch);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeBody: expect.objectContaining({
          deStyle: expect.objectContaining({
            background: expect.objectContaining({ backgroundShow: false }),
          }),
        }),
      }),
    );
  });

  it("patches chart palette when selecting a preset in the inspector", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widget} onChange={onChange}>
          <ChartStylePanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "图表配色" }));
    await user.click(screen.getByRole("button", { name: "配色方案" }));
    await user.click(screen.getByRole("option", { name: /浅韵/ }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeBody: expect.objectContaining({
          deStyle: expect.objectContaining({ paletteId: "pastel" }),
        }),
      }),
    );
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
  });

  it("re-renders palette display after provider onChange updates widget", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onChange = vi.fn();

    function StatefulPanel() {
      const [currentWidget, setCurrentWidget] = useState(widget);
      return (
        <ChartInspectorProvider
          widget={currentWidget}
          onChange={(chartConfig) => {
            onChange(chartConfig);
            setCurrentWidget((prev) => ({ ...prev, chartConfig }));
          }}
        >
          <ChartStylePanel />
        </ChartInspectorProvider>
      );
    }

    render(
      <QueryClientProvider client={qc}>
        <StatefulPanel />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "图表配色" }));
    await user.click(screen.getByRole("button", { name: "配色方案" }));
    await user.click(screen.getByRole("option", { name: /浅韵/ }));

    const lastConfig = onChange.mock.calls.at(-1)?.[0];
    expect(readChartDeStyle(lastConfig).paletteId).toBe("pastel");
    expect(screen.getByRole("button", { name: "配色方案" })).toHaveTextContent("浅韵");
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
  });

  it("table shows only table-specific sections", () => {
    const tableWidget: LayoutWidget = {
      ...widget,
      chartConfig: { ...widget.chartConfig!, chartType: "table" },
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={tableWidget} onChange={vi.fn()}>
          <ChartStylePanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: /明细表（旧） · 基础样式/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "表格配色" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "背景" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "备注" })).not.toBeInTheDocument();
  });
});
