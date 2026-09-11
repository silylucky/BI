import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { WidgetViewDataDialog } from "@/components/dashboard/widget-actions/WidgetViewDataDialog";

const useChartExecuteMock = vi.fn(() => ({
  columns: ["sale_date", "amount"],
  rows: [
    ["2025-01-05", 8999],
    ["2025-07-01", 1200],
  ],
  loading: false,
  error: null,
  slowHint: false,
  rerun: vi.fn(),
}));

vi.mock("@/components/charts/useChartExecute", () => ({
  useChartExecute: (...args: unknown[]) => useChartExecuteMock(...args),
}));

describe("WidgetViewDataDialog", () => {
  afterEach(() => {
    cleanup();
    useChartExecuteMock.mockClear();
  });

  it("renders table headers and export actions", () => {
    render(
      <WidgetViewDataDialog
        open
        onOpenChange={vi.fn()}
        title="基础折线图"
        chartConfig={{ ...defaultChartConfig("line"), chartId: "w1" }}
      />,
    );

    expect(screen.getByTestId("widget-view-data-dialog")).toBeInTheDocument();
    expect(screen.getByText("基础折线图")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导出 Excel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /导出原始明细/i })).toBeInTheDocument();
    expect(screen.getByText("sale_date")).toBeInTheDocument();
    expect(screen.getByText("amount")).toBeInTheDocument();
    expect(screen.getByText("8999")).toBeInTheDocument();
  });

  it("uses component result limit for execute (default 20)", () => {
    const chartConfig = defaultChartConfig("line");
    render(
      <WidgetViewDataDialog
        open
        onOpenChange={vi.fn()}
        title="基础折线图"
        chartConfig={{ ...chartConfig, chartId: "w1" }}
      />,
    );

    expect(useChartExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({ chartId: "w1" }),
      expect.objectContaining({ limit: 20 }),
    );
  });
});
