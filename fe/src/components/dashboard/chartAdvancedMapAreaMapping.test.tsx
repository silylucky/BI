import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import { ChartAdvancedMapAreaMappingSection } from "./ChartGeoAreaMappingPanel";
import { defaultChartConfig, type LayoutWidget } from "./layoutUtils";
import { readChartDeStyle } from "@/lib/chartDeStyle";
import { readChartGeoAreaMapping } from "@/lib/chartGeoAreaMapping";

const useChartExecuteMock = vi.fn();

vi.mock("@/components/charts/useChartExecute", () => ({
  useChartExecute: (...args: unknown[]) => useChartExecuteMock(...args),
}));

const mapWidget: LayoutWidget = {
  id: "map-1",
  type: "chart",
  title: "区域地图",
  order: 0,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    ...defaultChartConfig("map"),
    dataSourceId: "ds-1",
    configId: "cfg-1",
    dimensions: [{ field: "province" }],
    metrics: [{ field: "value" }],
  },
};

const mapWidgetWithMapping: LayoutWidget = {
  ...mapWidget,
  chartConfig: {
    ...mapWidget.chartConfig!,
    nativeBody: {
      deStyle: {
        geo: {
          areaMapping: [{ id: "existing-1", from: "OLD", to: "北京市" }],
        },
      },
    },
  },
};

function renderSection(widget: LayoutWidget, onChange = vi.fn()) {
  useChartExecuteMock.mockReturnValue({
    columns: ["province", "value"],
    rows: [
      ["EAST_01", 1],
      ["江苏省", 2],
    ],
    loading: false,
    error: null,
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ChartInspectorProvider widget={widget} onChange={onChange}>
        <ChartAdvancedMapAreaMappingSection />
      </ChartInspectorProvider>
    </QueryClientProvider>,
  );
  return onChange;
}

afterEach(() => {
  cleanup();
  useChartExecuteMock.mockReset();
});

describe("ChartAdvancedMapAreaMappingSection", () => {
  it("shows province names in 图形 column on first page", () => {
    renderSection(mapWidget);
    expect(screen.getByText("安徽省")).toBeInTheDocument();
    expect(screen.getByText("北京市")).toBeInTheDocument();
    expect(screen.getByText("图形")).toBeInTheDocument();
    expect(screen.getByText("属性")).toBeInTheDocument();
  });

  it("auto-suggests areaMapping when data is ready and mapping is empty", async () => {
    const onChange = renderSection(mapWidget);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const lastCfg = onChange.mock.calls.at(-1)?.[0];
    const entries = readChartDeStyle(lastCfg).geo?.areaMapping ?? [];
    expect(entries.some((entry) => entry.from === "江苏省" && entry.to === "江苏省")).toBe(
      true,
    );
  });

  it("updates attribute field in chartConfig", async () => {
    const onChange = renderSection(mapWidgetWithMapping);
    const attrInput = screen.getByLabelText("北京市 属性");
    fireEvent.change(attrInput, { target: { value: "EAST_01" } });

    const lastCfg = onChange.mock.calls.at(-1)?.[0];
    expect(readChartDeStyle(lastCfg).geo?.areaMapping?.[0]?.from).toBe("EAST_01");
    expect(readChartGeoAreaMapping(readChartDeStyle(lastCfg))).toEqual([
      { id: "existing-1", from: "EAST_01", to: "北京市" },
    ]);
  });

  it("clears mapping when attribute is emptied", async () => {
    const onChange = renderSection(mapWidgetWithMapping);
    const attrInput = screen.getByLabelText("北京市 属性");
    fireEvent.change(attrInput, { target: { value: "" } });

    const lastCfg = onChange.mock.calls.at(-1)?.[0];
    expect(readChartDeStyle(lastCfg).geo?.areaMapping ?? []).toHaveLength(0);
  });

  it("re-syncs mappings from preview data", async () => {
    const user = userEvent.setup();
    const onChange = renderSection(mapWidgetWithMapping);

    await user.click(screen.getByRole("button", { name: "重新匹配" }));
    const lastCfg = onChange.mock.calls.at(-1)?.[0];
    const entries = readChartDeStyle(lastCfg).geo?.areaMapping ?? [];
    expect(entries.some((entry) => entry.from === "江苏省" && entry.to === "江苏省")).toBe(
      true,
    );
  });

  it("shows match status from preview data", async () => {
    renderSection(mapWidget);
    await waitFor(() => {
      expect(screen.getByText(/已匹配 1\/2 条/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 个取值未匹配/)).toBeInTheDocument();
  });

  it("paginates province list", async () => {
    const user = userEvent.setup();
    renderSection(mapWidget);

    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(screen.queryByText("安徽省")).not.toBeInTheDocument();
  });
});
