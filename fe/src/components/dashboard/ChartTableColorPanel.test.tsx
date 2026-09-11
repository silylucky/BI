import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartTableColorPanel } from "./ChartTableColorPanel";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import type { LayoutWidget } from "./layoutUtils";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: vi.fn().mockResolvedValue({ items: [] }) };
});

vi.mock("@/lib/chartRegistry", () => ({
  fetchChartTypeCatalog: vi.fn().mockResolvedValue([]),
  getChartTypeDisplayName: (id: string) => id,
}));

const tableWidget: LayoutWidget = {
  id: "w-table",
  type: "chart",
  title: "明细表",
  order: 1,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    chartType: "table-normal",
    styleVariant: "default",
    mode: "sql",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    sql: "SELECT 1",
    dimensions: [{ field: "region" }],
    metrics: [],
  },
};

afterEach(cleanup);

describe("ChartTableColorPanel", () => {
  it("renders DE-aligned table color fields", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={tableWidget} onChange={onChange}>
          <ChartTableColorPanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "表格配色" }));

    expect(screen.getByTestId("table-style-color")).toBeInTheDocument();
    expect(screen.getAllByText("表格配色")).toHaveLength(1);
    expect(screen.getByText("表头/行背景")).toBeInTheDocument();
    expect(screen.getByText("表头字体")).toBeInTheDocument();
    expect(screen.getByText("表格背景")).toBeInTheDocument();
    expect(screen.getByText("表格字体")).toBeInTheDocument();
    expect(screen.getByText("配色方案")).toBeInTheDocument();
    expect(screen.getByText("表头字号")).toBeInTheDocument();
    expect(screen.getByText("表格字号")).toBeInTheDocument();
    expect(screen.getByText("分页器字号")).toBeInTheDocument();
  });

  it("opens color picker popover on grid cell click", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={tableWidget} onChange={onChange}>
          <ChartTableColorPanel />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "表格配色" }));
    fireEvent.click(screen.getByLabelText("表头字体取色器"));
    expect(screen.getByText("推荐")).toBeInTheDocument();
    expect(screen.getByLabelText("表头字体取色器")).toHaveAttribute("aria-expanded", "true");
  });
});
