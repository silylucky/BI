import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import * as chartViewConfig from "@/lib/chartViewConfig";
import { WidgetEnlargeDialog } from "./WidgetEnlargeDialog";

vi.mock("@/components/charts/ChartRenderer", () => ({
  ChartRenderer: () => <div data-testid="mock-chart-renderer">chart</div>,
}));

vi.mock("@/components/charts/ChartDrillContext", () => ({
  ChartDrillProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const exportChartPngFromContainer = vi.fn();

vi.mock("./exportChartImage", () => ({
  exportChartPngFromContainer: (...args: unknown[]) => exportChartPngFromContainer(...args),
}));

const barConfig: ChartViewConfig = {
  chartType: "bar",
  chartId: "w1",
  mode: "sql",
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  sql: "SELECT 1",
  dimensions: [],
  metrics: [],
};

afterEach(() => {
  cleanup();
  exportChartPngFromContainer.mockReset();
});

describe("WidgetEnlargeDialog", () => {
  it("exports PNG for echarts chart types", () => {
    render(
      <WidgetEnlargeDialog
        open
        onOpenChange={vi.fn()}
        widgetId="w1"
        title="销售趋势"
        chartConfig={barConfig}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "导出图片" }));
    expect(exportChartPngFromContainer).toHaveBeenCalledTimes(1);
    expect(exportChartPngFromContainer.mock.calls[0]?.[1]).toBe("销售趋势");
  });

  it("disables export when chart type cannot export png", () => {
    vi.spyOn(chartViewConfig, "isEchartsChartType").mockReturnValue(false);
    render(
      <WidgetEnlargeDialog
        open
        onOpenChange={vi.fn()}
        widgetId="w-table"
        title="表格"
        chartConfig={{ ...barConfig, chartType: "table-pivot" }}
      />,
    );

    expect(screen.getByRole("button", { name: "导出图片" })).toBeDisabled();
  });
});
