import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartDataSlots } from "./ChartDataSlots";

vi.mock("./chartInspectorContext", () => ({
  useChartInspector: () => ({
    cfg: {
      chartType: "gauge",
      dimensions: [],
      metrics: ["amount"],
      axes: {
        yAxis: [{ field: "amount", agg: "sum" }],
      },
    },
    onChange: vi.fn(),
    columns: ["region", "amount"],
    columnsLoading: false,
    columnsReady: true,
    activeSlot: null,
    setActiveSlot: vi.fn(),
    assignField: vi.fn(),
    fieldAssignError: null,
    clearFieldAssignError: vi.fn(),
  }),
}));

describe("ChartDataSlots aggregation suffix", () => {
  it("renders metric aggregation suffix without runtime error", () => {
    cleanup();
    render(<ChartDataSlots hideMapHint />);
    expect(screen.getByText(/\(求和\)/)).toBeInTheDocument();
  });
});
