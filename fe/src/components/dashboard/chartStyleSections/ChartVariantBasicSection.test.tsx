import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartVariantBasicSection } from "./ChartVariantBasicSection";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import type { LayoutWidget } from "../layoutUtils";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: vi.fn().mockResolvedValue({ items: [] }) };
});

vi.mock("@/lib/chartRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartRegistry")>();
  return {
    ...actual,
    fetchChartTypeCatalog: vi.fn().mockResolvedValue([
      {
        type: "pie",
        displayName: "饼图",
        category: "basic",
        renderer: "antv",
        styleVariants: ["default", "donut"],
        fieldRule: {},
      },
    ]),
  };
});

const pieWidget: LayoutWidget = {
  id: "w-pie",
  type: "chart",
  title: "占比",
  order: 1,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    chartType: "pie",
    styleVariant: "donut",
    mode: "sql",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    sql: "SELECT 1",
    dimensions: [{ field: "category" }],
    metrics: [{ field: "amount" }],
  },
};

afterEach(cleanup);

describe("ChartVariantBasicSection", () => {
  it("shows inner radius slider for pie donut", async () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={pieWidget} onChange={onChange}>
          <ChartVariantBasicSection />
        </ChartInspectorProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("chart-variant-basic")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /基础样式/i }));

    await waitFor(() => {
      expect(screen.getByText("内径 %")).toBeInTheDocument();
    });

    const slider = screen.getByRole("slider", { name: "内径 %" });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "50" } });
    fireEvent.pointerUp(slider);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeBody: expect.objectContaining({
          deStyle: expect.objectContaining({
            pie: expect.objectContaining({ innerRadiusPercent: 50 }),
          }),
        }),
      }),
    );
  });
});
