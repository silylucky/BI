import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChartEditRail } from "./ChartEditRail";
import { defaultChartConfig, type LayoutWidget } from "./layoutUtils";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

const widget: LayoutWidget = {
  id: "w-chart-1",
  type: "chart",
  title: "销量趋势",
  order: 0,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    ...defaultChartConfig("line"),
    mode: "dataset",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
  },
};

describe("ChartEditRail", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
  });

  it("mounts inspector tabs with built-in ChartInspectorProvider", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) return { items: [] };
      if (path.includes("/datasources")) return { items: [] };
      if (path.includes("/charts/types")) {
        return [{ type: "line", displayName: "折线图", styleVariants: ["default"], fieldRule: {} }];
      }
      return { columns: [], rows: [] };
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <ChartEditRail widget={widget} onChange={vi.fn()} />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("tab", { name: "数据" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "样式" })).toBeInTheDocument();
    expect(screen.getByText("数据集")).toBeInTheDocument();
    expect(screen.queryByText(/useChartInspector must be used/)).not.toBeInTheDocument();
  });

  it("shows ChartStylePanel fields after switching to the style tab", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) return { items: [] };
      if (path.includes("/datasources")) return { items: [] };
      if (path.includes("/charts/types")) {
        return [{ type: "line", displayName: "折线图", styleVariants: ["default"], fieldRule: {} }];
      }
      return { columns: [], rows: [] };
    });

    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <ChartEditRail widget={widget} onChange={vi.fn()} />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("tab", { name: "样式" }));
    const panel = await screen.findByTestId("chart-style-panel");
    expect(panel).toBeVisible();
    expect(screen.getByRole("switch", { name: "显示标题" })).toBeInTheDocument();
  });
});
