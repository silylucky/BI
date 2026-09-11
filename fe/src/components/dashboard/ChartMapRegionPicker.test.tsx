import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartDrillProvider } from "@/components/charts/ChartDrillContext";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import { ChartMapDataPanel } from "./ChartMapDataPanel";
import { defaultChartConfig, type LayoutWidget } from "./layoutUtils";
import { applySalesGeoDrillMapConfig } from "@/lib/mapChartSalesGeo";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

const mapWidget: LayoutWidget = {
  id: "map-widget-1",
  type: "chart",
  title: "区域地图",
  order: 0,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: applySalesGeoDrillMapConfig(defaultChartConfig("map-3d"), "ds-sample"),
};

function renderMapDataPanel(onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === "/api/v1/datasources") {
      return { items: [{ id: "ds-sample", name: "sample_db", code: "sample_db" }] };
    }
    if (path.includes("/columns")) {
      return { columns: ["province", "city", "district", "total"] };
    }
    return {};
  });

  return render(
    <QueryClientProvider client={client}>
      <ChartDrillProvider>
        <ChartInspectorProvider widget={mapWidget} onChange={onChange}>
          <ChartMapDataPanel />
        </ChartInspectorProvider>
      </ChartDrillProvider>
    </QueryClientProvider>,
  );
}

describe("ChartMapRegionPicker", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
  });

  it("renders region picker at top of map data panel", () => {
    renderMapDataPanel();
    expect(screen.getByTestId("chart-map-region-section")).toBeInTheDocument();
    expect(screen.getByTestId("chart-map-region-picker")).toBeInTheDocument();
    expect(screen.getByTestId("chart-map-region-picker-trigger")).toHaveTextContent("全国");
  });

  it("persists guangdong selection into chart config", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMapDataPanel(onChange);

    await user.click(screen.getByTestId("chart-map-region-picker-trigger"));
    await user.click(await screen.findByRole("button", { name: "广东省" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.nativeBody?.deStyle?.geo?.manualDrillStack).toEqual([
        { field: "province", value: "广东省", label: "广东省" },
      ]);
    });
  });

  it("persists empty manualDrillStack when selecting national", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMapDataPanel(onChange);

    await user.click(screen.getByTestId("chart-map-region-picker-trigger"));
    await user.click(await screen.findByRole("button", { name: "广东省" }));
    await user.click(screen.getByTestId("chart-map-region-picker-trigger"));
    await user.click(await screen.findByRole("button", { name: "全国" }));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.nativeBody?.deStyle?.geo?.manualDrillStack).toBeUndefined();
    });
  });

});
